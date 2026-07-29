import { act, render, screen } from "@testing-library/react";
import { useAuth, AuthProvider } from "./AuthContext";
import { getTokenRefreshDelay } from "@/lib/auth-refresh";

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  apiGet: vi.fn(),
  refreshAccessToken: vi.fn(),
  getStoredRefreshToken: vi.fn(),
  setAccessToken: vi.fn(),
  storeRefreshToken: vi.fn(),
  clearStoredTokens: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: { post: mocks.apiPost, get: mocks.apiGet },
  refreshAccessToken: mocks.refreshAccessToken,
}));

vi.mock("@/lib/token", () => ({
  getAccessToken: vi.fn(),
  setAccessToken: mocks.setAccessToken,
  getStoredRefreshToken: mocks.getStoredRefreshToken,
  storeRefreshToken: mocks.storeRefreshToken,
  clearStoredTokens: mocks.clearStoredTokens,
}));

const loginResponse = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  tokenType: "Bearer",
  expiresIn: 300,
  accessTokenExpiresAt: "2026-01-01T00:05:00.000Z",
  user: { id: "1", email: "a@example.com", username: "a", fullName: "A" },
  organization: { id: "o1", code: "ORG", name: "Org" },
  permissions: [],
};

function Probe() {
  const auth = useAuth();
  return (
    <>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="token">{auth.accessToken ?? ""}</span>
      <button
        onClick={() =>
          auth.login({ identifier: "a", password: "secret", rememberMe: false })
        }
      >
        login
      </button>
    </>
  );
}

describe("AuthProvider proactive token refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.clearAllMocks();
    mocks.getStoredRefreshToken.mockReturnValue(null);
    mocks.apiPost.mockResolvedValue({ data: loginResponse });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates a delay one minute before expiry", () => {
    expect(
      getTokenRefreshDelay(
        "2026-01-01T00:05:00.000Z",
        new Date("2026-01-01T00:00:00.000Z").getTime(),
      ),
    ).toBe(240_000);
    expect(getTokenRefreshDelay("2025-12-31T23:59:00.000Z")).toBe(0);
  });

  it("refreshes one minute before expiry and reschedules from the new expiry", async () => {
    mocks.refreshAccessToken
      .mockResolvedValueOnce({
        accessToken: "access-2",
        refreshToken: "refresh-2",
        tokenType: "Bearer",
        expiresIn: 300,
        accessTokenExpiresAt: "2026-01-01T00:09:00.000Z",
      })
      .mockResolvedValueOnce({
        accessToken: "access-3",
        refreshToken: "refresh-3",
        tokenType: "Bearer",
        expiresIn: 300,
        accessTokenExpiresAt: "2026-01-01T00:13:00.000Z",
      });

    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => screen.getByText("login").click());

    await act(async () => vi.advanceTimersByTimeAsync(239_999));
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("token")).toHaveTextContent("access-2");

    await act(async () => vi.advanceTimersByTimeAsync(240_000));
    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("token")).toHaveTextContent("access-3");
  });

  it("clears the session when a scheduled refresh fails", async () => {
    mocks.refreshAccessToken.mockRejectedValue(new Error("expired"));

    render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => screen.getByText("login").click());
    await act(async () => vi.advanceTimersByTimeAsync(240_000));

    expect(mocks.clearStoredTokens).toHaveBeenCalled();
    expect(mocks.setAccessToken).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });
});
