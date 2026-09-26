import { useState } from "react";
import { AxiosError, type AxiosResponse } from "axios";
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

describe("AuthProvider portal scope", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.clearAllMocks();
    mocks.refreshAccessToken.mockReset();
    mocks.getStoredRefreshToken.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function ScopeProbe() {
    const auth = useAuth();
    const [error, setError] = useState("");
    return (
      <>
        <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
        <span data-testid="error">{error}</span>
        <button
          onClick={() =>
            auth
              .login({ identifier: "a", password: "secret", rememberMe: false })
              .catch((e: Error) => setError(`${e.name}: ${e.message}`))
          }
        >
          login
        </button>
      </>
    );
  }

  it("rejects a platform-admin session and revokes it instead of storing it", async () => {
    const platformResponse = {
      ...loginResponse,
      organization: null,
      permissions: ["platform.organization.view"],
    };
    mocks.apiPost.mockResolvedValue({ data: platformResponse });

    render(<AuthProvider><ScopeProbe /></AuthProvider>);
    await act(async () => screen.getByText("login").click());

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("PortalMismatchError");
    expect(mocks.storeRefreshToken).not.toHaveBeenCalled();
    expect(mocks.setAccessToken).not.toHaveBeenCalledWith("access-1");
    expect(mocks.apiPost).toHaveBeenCalledWith(
      "/v1/auth/logout",
      expect.objectContaining({ accessToken: "access-1", refreshToken: "refresh-1" }),
      { headers: { Authorization: "Bearer access-1" } },
    );
  });

  it("still surfaces the mismatch when revoking the session fails", async () => {
    mocks.apiPost
      .mockResolvedValueOnce({ data: { ...loginResponse, organization: null, permissions: ["platform.x"] } })
      .mockRejectedValueOnce(new Error("offline"));

    render(<AuthProvider><ScopeProbe /></AuthProvider>);
    await act(async () => screen.getByText("login").click());

    expect(screen.getByTestId("error")).toHaveTextContent("PortalMismatchError");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });

  it("accepts a tenant session bound to an organisation", async () => {
    mocks.apiPost.mockResolvedValue({ data: loginResponse });

    render(<AuthProvider><ScopeProbe /></AuthProvider>);
    await act(async () => screen.getByText("login").click());

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(mocks.apiPost).toHaveBeenCalledTimes(1);
  });
});

describe("AuthProvider session restore", () => {
  const meResponse = {
    id: "1",
    email: "a@example.com",
    username: "a",
    fullName: "A",
    organization: { id: "o1", code: "ORG", name: "Org" },
    permissions: ["orgnode.view"],
    accessTokenExpiresAt: "2026-01-01T00:05:00.000Z",
  };
  const refreshed = {
    accessToken: "restored-access",
    refreshToken: "restored-refresh",
    tokenType: "Bearer",
    expiresIn: 300,
    accessTokenExpiresAt: "2026-01-01T00:05:00.000Z",
    permissions: ["orgnode.view", "orgnode.manage"],
  };
  const httpError = (status: number) =>
    new AxiosError("failed", String(status), undefined, undefined, { status } as AxiosResponse);

  function RestoreProbe() {
    const auth = useAuth();
    return (
      <>
        <span data-testid="loading">{String(auth.isLoading)}</span>
        <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
        <span data-testid="token">{auth.accessToken ?? ""}</span>
        <span data-testid="org">{auth.organization?.name ?? ""}</span>
        <span data-testid="permissions">{auth.permissions.join(",")}</span>
      </>
    );
  }

  const mountWithStoredSession = async () => {
    mocks.getStoredRefreshToken.mockReturnValue("stored-refresh");
    render(<AuthProvider><RestoreProbe /></AuthProvider>);
    await act(async () => {});
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.clearAllMocks();
    mocks.refreshAccessToken.mockReset();
    mocks.apiGet.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("restores the session from the stored refresh token on load", async () => {
    mocks.refreshAccessToken.mockResolvedValue(refreshed);
    mocks.apiGet.mockResolvedValue({ data: meResponse });

    await mountWithStoredSession();

    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mocks.apiGet).toHaveBeenCalledWith("/v1/me");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("token")).toHaveTextContent("restored-access");
    expect(screen.getByTestId("org")).toHaveTextContent("Org");
    expect(screen.getByTestId("permissions")).toHaveTextContent("orgnode.view,orgnode.manage");
  });

  it("does not call the API when nothing is stored", async () => {
    mocks.getStoredRefreshToken.mockReturnValue(null);
    render(<AuthProvider><RestoreProbe /></AuthProvider>);
    await act(async () => {});

    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });

  it("drops the stored session when the server rejects the refresh token", async () => {
    mocks.refreshAccessToken.mockRejectedValue(httpError(401));

    await mountWithStoredSession();

    expect(mocks.clearStoredTokens).toHaveBeenCalled();
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("keeps the stored session when the server is unreachable", async () => {
    mocks.refreshAccessToken.mockRejectedValue(new AxiosError("Network Error"));

    await mountWithStoredSession();

    expect(mocks.clearStoredTokens).not.toHaveBeenCalled();
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("refuses to restore a session that is not bound to an organisation", async () => {
    mocks.refreshAccessToken.mockResolvedValue(refreshed);
    mocks.apiGet.mockResolvedValue({ data: { ...meResponse, organization: null } });

    await mountWithStoredSession();

    expect(mocks.clearStoredTokens).toHaveBeenCalled();
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });
});

describe("AuthProvider module entitlements", () => {
  const makeJwt = (payload: Record<string, unknown>) => {
    const encode = (value: Record<string, unknown>) =>
      btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${encode({ alg: "RS256" })}.${encode(payload)}.sig`;
  };

  function ModuleProbe() {
    const auth = useAuth();
    return (
      <>
        <span data-testid="modules">{auth.allocatedModules.join(",")}</span>
        <span data-testid="gov">{String(auth.hasModule("governance"))}</span>
        <span data-testid="risk">{String(auth.hasModule("RISK_MANAGEMENT"))}</span>
        <button onClick={() => auth.login({ identifier: "a", password: "p", rememberMe: false })}>login</button>
      </>
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.clearAllMocks();
    mocks.refreshAccessToken.mockReset();
    mocks.getStoredRefreshToken.mockReturnValue(null);
  });

  afterEach(() => vi.useRealTimers());

  it("gates modules by allocation for non-admin users", async () => {
    mocks.apiPost.mockResolvedValue({
      data: { ...loginResponse, permissions: [], allocatedModules: ["CORE", "GOVERNANCE"] },
    });

    render(<AuthProvider><ModuleProbe /></AuthProvider>);
    await act(async () => screen.getByText("login").click());

    expect(screen.getByTestId("modules")).toHaveTextContent("CORE,GOVERNANCE");
    expect(screen.getByTestId("gov")).toHaveTextContent("true");
    expect(screen.getByTestId("risk")).toHaveTextContent("false");
  });

  it("lets organization.manage bypass the allocation list", async () => {
    mocks.apiPost.mockResolvedValue({
      data: { ...loginResponse, permissions: ["organization.manage"], allocatedModules: [] },
    });

    render(<AuthProvider><ModuleProbe /></AuthProvider>);
    await act(async () => screen.getByText("login").click());

    expect(screen.getByTestId("gov")).toHaveTextContent("true");
    expect(screen.getByTestId("risk")).toHaveTextContent("true");
  });

  it("restores allocations from the refreshed JWT modules claim", async () => {
    const accessToken = makeJwt({ org: "o1", modules: ["CORE", "RISK_MANAGEMENT"], permissions: [] });
    mocks.getStoredRefreshToken.mockReturnValue("stored-refresh");
    mocks.refreshAccessToken.mockResolvedValue({
      accessToken,
      refreshToken: "restored-refresh",
      tokenType: "Bearer",
      expiresIn: 300,
      accessTokenExpiresAt: "2026-01-01T00:05:00.000Z",
      permissions: [],
    });
    mocks.apiGet.mockResolvedValue({
      data: {
        id: "1",
        email: "a@example.com",
        username: "a",
        fullName: "A",
        organization: { id: "o1", code: "ORG", name: "Org" },
        permissions: [],
        accessTokenExpiresAt: "2026-01-01T00:05:00.000Z",
      },
    });

    render(<AuthProvider><ModuleProbe /></AuthProvider>);
    await act(async () => {});

    expect(screen.getByTestId("modules")).toHaveTextContent("CORE,RISK_MANAGEMENT");
    expect(screen.getByTestId("risk")).toHaveTextContent("true");
    expect(screen.getByTestId("gov")).toHaveTextContent("false");
  });
});
