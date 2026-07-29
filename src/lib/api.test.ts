import { api, refreshAccessToken } from "./api";

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
