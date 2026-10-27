import { api, refreshAccessToken, isNoRefreshPath } from "./api";
import {
  SessionFrozenError,
  freezeTenantSession,
  resetTenantSessionFreeze,
} from "./session-broadcast";

describe("refreshAccessToken", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem("grc_refresh_token", "refresh-1");
    vi.restoreAllMocks();
  });

  it("deduplicates concurrent refresh requests and returns the full response", async () => {
    const response = {
      accessToken: "access-2",
      refreshToken: "refresh-2",
      tokenType: "Bearer",
      expiresIn: 300,
      accessTokenExpiresAt: "2026-01-01T00:05:00.000Z",
    };
    let resolveRequest!: (value: { data: typeof response }) => void;
    const request = new Promise<{ data: typeof response }>((resolve) => {
      resolveRequest = resolve;
    });
    const post = vi.spyOn(api, "post").mockReturnValue(request as never);

    const first = refreshAccessToken();
    const second = refreshAccessToken();
    expect(post).toHaveBeenCalledTimes(1);

    resolveRequest({ data: response });
    await expect(first).resolves.toEqual(response);
    await expect(second).resolves.toEqual(response);
    expect(sessionStorage.getItem("grc_refresh_token")).toBe("refresh-2");
  });
});

describe("401 handling policy", () => {
  it("never refreshes a token for the selection-organization call", () => {
    expect(isNoRefreshPath("/v1/auth/select-organization")).toBe(true);
    expect(isNoRefreshPath("/v1/auth/login")).toBe(true);
    expect(isNoRefreshPath("/v1/auth/refresh")).toBe(true);
    expect(isNoRefreshPath("/v1/auth/logout")).toBe(true);
    expect(isNoRefreshPath("/v1/organizations/1/members")).toBe(false);
  });
});

describe("frozen tenant session", () => {
  afterEach(() => resetTenantSessionFreeze());

  it("refuses to send tenant requests until the tab reloads", async () => {
    freezeTenantSession();

    await expect(api.get("/v1/me")).rejects.toBeInstanceOf(SessionFrozenError);
  });
});
