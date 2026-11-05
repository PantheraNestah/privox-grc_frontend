import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { api, refreshAccessToken } from "./api";
import { setAccessToken } from "./token";

/** Replaces the transport so requests are recorded instead of sent. */
function stubAdapter(status: number) {
  const calls: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    calls.push(config as InternalAxiosRequestConfig);
    if (status >= 400) {
      throw new AxiosError("failed", String(status), config, undefined, {
        status,
        data: {},
        headers: {},
        config,
        statusText: "error",
      } as never);
    }
    return { data: {}, status, statusText: "OK", headers: {}, config } as never;
  };
  return calls;
}

describe("public calls", () => {
  afterEach(() => {
    setAccessToken(null);
    api.defaults.adapter = undefined as never;
    vi.restoreAllMocks();
  });

  it("does not attach a bearer token to skipAuth calls", async () => {
    setAccessToken("stale-token");
    const calls = stubAdapter(200);

    await api.post("/v1/auth/login", {}, { skipAuth: true });
    await api.get("/v1/me");

    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[1].headers.Authorization).toBe("Bearer stale-token");
  });

  it("answers a 401 on a public call without attempting a refresh", async () => {
    sessionStorage.setItem("grc_refresh_token", "refresh-1");
    const calls = stubAdapter(401);

    await expect(
      api.post("/v1/auth/invitations/token-1/accept", { fullName: "A", password: "x" }, { skipAuth: true }),
    ).rejects.toThrow();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/v1/auth/invitations/token-1/accept");
    sessionStorage.clear();
  });
});

describe("cross-tab refresh lock", () => {
  afterEach(() => {
    delete (navigator as { locks?: unknown }).locks;
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("runs the refresh inside a per-scope Web Lock when one is available", async () => {
    sessionStorage.setItem("grc_refresh_token", "refresh-1");
    const requested: string[] = [];
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: (name: string, task: () => Promise<unknown>) => {
          requested.push(name);
          return task();
        },
      },
    });
    const response = {
      accessToken: "access-2",
      refreshToken: "refresh-2",
      tokenType: "Bearer",
      expiresIn: 300,
      accessTokenExpiresAt: "2026-01-01T00:05:00.000Z",
    };
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: response } as never);

    await expect(refreshAccessToken()).resolves.toEqual(response);

    expect(requested).toEqual(["grc-refresh-tenant"]);
    expect(post).toHaveBeenCalledWith(
      "/v1/auth/refresh",
      { refreshToken: "refresh-1" },
      { skipAuth: true },
    );
    expect(sessionStorage.getItem("grc_refresh_token")).toBe("refresh-2");
  });
});
