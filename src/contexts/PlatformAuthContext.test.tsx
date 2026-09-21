import { useState } from "react";
import { AxiosError, type AxiosResponse } from "axios";
import { act, render, screen } from "@testing-library/react";
import { PlatformAuthProvider, usePlatformAuth } from "./PlatformAuthContext";

const mocks = vi.hoisted(() => ({
  platformApiPost: vi.fn(),
  refreshAccessToken: vi.fn(),
  getStoredRefreshToken: vi.fn(),
  setAccessToken: vi.fn(),
  storeRefreshToken: vi.fn(),
  clearStoredTokens: vi.fn(),
  getStoredProfile: vi.fn(),
  storeProfile: vi.fn(),
  loginPlatformAdmin: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  platformApi: { post: mocks.platformApiPost },
  refreshAccessToken: mocks.refreshAccessToken,
}));

vi.mock("@/lib/token", () => ({
  getAccessToken: vi.fn(),
  setAccessToken: mocks.setAccessToken,
  getStoredRefreshToken: mocks.getStoredRefreshToken,
  storeRefreshToken: mocks.storeRefreshToken,
  clearStoredTokens: mocks.clearStoredTokens,
  getStoredProfile: mocks.getStoredProfile,
  storeProfile: mocks.storeProfile,
}));

vi.mock("@/lib/platformAdmin", () => ({
  loginPlatformAdmin: mocks.loginPlatformAdmin,
}));

const loginResponse = {
  accessToken: "p-access-1",
  refreshToken: "p-refresh-1",
  tokenType: "Bearer",
  expiresIn: 300,
  accessTokenExpiresAt: "2026-01-01T00:05:00.000Z",
  user: { id: "p1", email: "admin@privox.io", username: "gift.admin", fullName: "Gift Superadmin" },
  organization: null,
  permissions: ["platform.organization.view", "platform.module.assign"],
};

function Probe() {
  const auth = usePlatformAuth();
  return (
    <>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="token">{auth.accessToken ?? ""}</span>
      <span data-testid="permissions">{auth.permissions.join(",")}</span>
      <button
        onClick={() =>
          auth.login({ identifier: "admin@privox.io", password: "secret", rememberMe: true })
        }
      >
        login
      </button>
    </>
  );
}

describe("PlatformAuthProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.clearAllMocks();
    mocks.getStoredRefreshToken.mockReturnValue(null);
    mocks.loginPlatformAdmin.mockResolvedValue(loginResponse);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("logs in and persists the refresh token under the platform scope", async () => {
    render(
      <PlatformAuthProvider>
        <Probe />
      </PlatformAuthProvider>,
    );

    await act(async () => screen.getByText("login").click());

    expect(mocks.loginPlatformAdmin).toHaveBeenCalledWith({
      identifier: "admin@privox.io",
      password: "secret",
      rememberMe: true,
    });
    expect(mocks.storeRefreshToken).toHaveBeenCalledWith("p-refresh-1", true, "platform");
    expect(mocks.storeProfile).toHaveBeenCalledWith(loginResponse.user, "platform");
    expect(mocks.setAccessToken).toHaveBeenCalledWith("p-access-1", "platform");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("token")).toHaveTextContent("p-access-1");
    expect(screen.getByTestId("permissions")).toHaveTextContent(
      "platform.organization.view,platform.module.assign",
    );
  });

  it("refreshes the platform scope one minute before expiry", async () => {
    mocks.refreshAccessToken.mockResolvedValue({
      accessToken: "p-access-2",
      refreshToken: "p-refresh-2",
      tokenType: "Bearer",
      expiresIn: 300,
      accessTokenExpiresAt: "2026-01-01T00:09:00.000Z",
    });

    render(
      <PlatformAuthProvider>
        <Probe />
      </PlatformAuthProvider>,
    );
    await act(async () => screen.getByText("login").click());

    await act(async () => vi.advanceTimersByTimeAsync(240_000));

    expect(mocks.refreshAccessToken).toHaveBeenCalledWith("platform");
    expect(screen.getByTestId("token")).toHaveTextContent("p-access-2");
  });
});

describe("PlatformAuthProvider portal scope", () => {
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
    const auth = usePlatformAuth();
    const [error, setError] = useState("");
    return (
      <>
        <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
        <span data-testid="error">{error}</span>
        <button
          onClick={() =>
            auth
              .login({ identifier: "user@org.com", password: "secret", rememberMe: true })
              .catch((e: Error) => setError(`${e.name}: ${e.message}`))
          }
        >
          login
        </button>
      </>
    );
  }

  const tenantResponse = {
    ...loginResponse,
    accessToken: "t-access-1",
    refreshToken: "t-refresh-1",
    organization: { id: "o1", code: "ORG", name: "Org" },
    permissions: ["orgnode.view"],
  };

  it("rejects a tenant session and revokes it instead of storing it", async () => {
    mocks.loginPlatformAdmin.mockResolvedValue(tenantResponse);

    render(<PlatformAuthProvider><ScopeProbe /></PlatformAuthProvider>);
    await act(async () => screen.getByText("login").click());

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("PortalMismatchError");
    expect(mocks.storeRefreshToken).not.toHaveBeenCalled();
    expect(mocks.setAccessToken).not.toHaveBeenCalledWith("t-access-1", "platform");
    expect(mocks.platformApiPost).toHaveBeenCalledWith(
      "/v1/auth/logout",
      expect.objectContaining({ accessToken: "t-access-1", refreshToken: "t-refresh-1" }),
      { headers: { Authorization: "Bearer t-access-1" } },
    );
  });

  it("rejects a session with no organisation but no platform permissions", async () => {
    mocks.loginPlatformAdmin.mockResolvedValue({ ...loginResponse, permissions: [] });

    render(<PlatformAuthProvider><ScopeProbe /></PlatformAuthProvider>);
    await act(async () => screen.getByText("login").click());

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("PortalMismatchError");
  });

  it("accepts a genuine platform session", async () => {
    mocks.loginPlatformAdmin.mockResolvedValue(loginResponse);

    render(<PlatformAuthProvider><ScopeProbe /></PlatformAuthProvider>);
    await act(async () => screen.getByText("login").click());

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(mocks.platformApiPost).not.toHaveBeenCalled();
  });
});

describe("PlatformAuthProvider session restore", () => {
  const profile = loginResponse.user;
  const refreshed = {
    accessToken: "p-restored",
    refreshToken: "p-restored-refresh",
    tokenType: "Bearer",
    expiresIn: 300,
    accessTokenExpiresAt: "2026-01-01T00:05:00.000Z",
    permissions: ["platform.organization.view"],
  };
  const httpError = (status: number) =>
    new AxiosError("failed", String(status), undefined, undefined, { status } as AxiosResponse);

  function RestoreProbe() {
    const auth = usePlatformAuth();
    return (
      <>
        <span data-testid="loading">{String(auth.isLoading)}</span>
        <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
        <span data-testid="token">{auth.accessToken ?? ""}</span>
        <span data-testid="name">{auth.user?.fullName ?? ""}</span>
        <span data-testid="permissions">{auth.permissions.join(",")}</span>
      </>
    );
  }

  const mountWithStoredSession = async () => {
    mocks.getStoredRefreshToken.mockReturnValue("stored-refresh");
    render(<PlatformAuthProvider><RestoreProbe /></PlatformAuthProvider>);
    await act(async () => {});
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.clearAllMocks();
    mocks.refreshAccessToken.mockReset();
    mocks.getStoredProfile.mockReturnValue(profile);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("restores identity from the stored profile and permissions from the refresh", async () => {
    mocks.refreshAccessToken.mockResolvedValue(refreshed);

    await mountWithStoredSession();

    expect(mocks.refreshAccessToken).toHaveBeenCalledWith("platform");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("token")).toHaveTextContent("p-restored");
    expect(screen.getByTestId("name")).toHaveTextContent("Gift Superadmin");
    expect(screen.getByTestId("permissions")).toHaveTextContent("platform.organization.view");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("does not restore without a stored profile", async () => {
    mocks.refreshAccessToken.mockResolvedValue(refreshed);
    mocks.getStoredProfile.mockReturnValue(null);

    await mountWithStoredSession();

    expect(mocks.clearStoredTokens).toHaveBeenCalledWith("platform");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });

  it("does not restore a session that has no platform permissions", async () => {
    mocks.refreshAccessToken.mockResolvedValue({ ...refreshed, permissions: [] });

    await mountWithStoredSession();

    expect(mocks.clearStoredTokens).toHaveBeenCalledWith("platform");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });

  it("drops the session when the refresh token is rejected", async () => {
    mocks.refreshAccessToken.mockRejectedValue(httpError(401));

    await mountWithStoredSession();

    expect(mocks.clearStoredTokens).toHaveBeenCalledWith("platform");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });

  it("keeps the session when the server is unreachable", async () => {
    mocks.refreshAccessToken.mockRejectedValue(new AxiosError("Network Error"));

    await mountWithStoredSession();

    expect(mocks.clearStoredTokens).not.toHaveBeenCalled();
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });
});
