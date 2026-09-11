import {
  getAccessToken,
  setAccessToken,
  getStoredRefreshToken,
  storeRefreshToken,
  updateStoredRefreshToken,
  clearStoredTokens,
} from "./token";

describe("scope-aware token storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setAccessToken(null, "tenant");
    setAccessToken(null, "platform");
  });

  it("keeps tenant and platform access tokens independent", () => {
    setAccessToken("tenant-token");
    setAccessToken("platform-token", "platform");

    expect(getAccessToken()).toBe("tenant-token");
    expect(getAccessToken("tenant")).toBe("tenant-token");
    expect(getAccessToken("platform")).toBe("platform-token");

    setAccessToken(null, "platform");
    expect(getAccessToken()).toBe("tenant-token");
    expect(getAccessToken("platform")).toBeNull();
  });

  it("persists refresh tokens under distinct storage keys", () => {
    storeRefreshToken("t-refresh", true, "tenant");
    storeRefreshToken("p-refresh", false, "platform");

    expect(localStorage.getItem("grc_refresh_token")).toBe("t-refresh");
    expect(sessionStorage.getItem("grc_platform_refresh_token")).toBe("p-refresh");
    expect(getStoredRefreshToken()).toBe("t-refresh");
    expect(getStoredRefreshToken("platform")).toBe("p-refresh");
  });

  it("updates a refresh token in the storage that already holds it", () => {
    storeRefreshToken("p-refresh", true, "platform");
    updateStoredRefreshToken("p-refresh-2", "platform");
    expect(localStorage.getItem("grc_platform_refresh_token")).toBe("p-refresh-2");
  });

  it("clears only the requested scope", () => {
    storeRefreshToken("t-refresh", true, "tenant");
    storeRefreshToken("p-refresh", true, "platform");

    clearStoredTokens("platform");

    expect(getStoredRefreshToken("platform")).toBeNull();
    expect(getStoredRefreshToken()).toBe("t-refresh");
  });
});
