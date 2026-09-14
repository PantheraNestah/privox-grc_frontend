/**
 * Axios-based API client.
 *
 * The backend (your server) handles all PostgreSQL database operations.
 * This client talks to your backend API endpoints.
 *
 * Two independent clients are exported, one per auth scope:
 *  - `api`         — tenant/organization session (default).
 *  - `platformApi` — platform-admin session (token with no `org` claim).
 *
 * Usage:
 *   import { api } from "@/lib/api";
 *   const users = await api.get("/users");
 *   const newUser = await api.post("/users", { name: "Alice" });
 */

import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { config } from "./env";
import {
  getAccessToken,
  setAccessToken,
  getStoredRefreshToken,
  updateStoredRefreshToken,
  clearStoredTokens,
  type AuthScope,
} from "./token";
import type { RefreshResponse } from "./auth-types";

// ─── Token refresh ─────────────────────────────────────────
// A 401 from these endpoints means bad credentials or an invalid/expired
// refresh token — never try to refresh (or redirect) off the back of one,
// or a failed refresh would loop forever.
const NO_REFRESH_PATHS = ["/auth/login", "/auth/logout", "/auth/refresh"];

// One in-flight refresh per scope, shared by the interceptor and the exported
// `refreshAccessToken` helper so concurrent 401s dedupe correctly.
const refreshPromises: Record<AuthScope, Promise<RefreshResponse> | null> = {
  tenant: null,
  platform: null,
};

async function performRefresh(
  client: AxiosInstance,
  scope: AuthScope,
): Promise<RefreshResponse> {
  if (!refreshPromises[scope]) {
    refreshPromises[scope] = (async () => {
      const storedRefresh = getStoredRefreshToken(scope);
      if (!storedRefresh) {
        throw new Error("No refresh token available");
      }

      const { data } = await client.post<RefreshResponse>("/v1/auth/refresh", {
        refreshToken: storedRefresh,
      });

      setAccessToken(data.accessToken, scope);
      updateStoredRefreshToken(data.refreshToken, scope);
      return data;
    })().finally(() => {
      refreshPromises[scope] = null;
    });
  }
  return refreshPromises[scope]!;
}

// ─── Client factory ────────────────────────────────────────

function createApiClient(scope: AuthScope, onAuthFailure: () => void): AxiosInstance {
  const client = axios.create({
    baseURL: config.apiUrl,
    timeout: config.apiTimeout,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Attach this scope's access token from the auth context's in-memory store.
  client.interceptors.request.use(
    (req) => {
      const token = getAccessToken(scope);
      if (token) {
        req.headers.Authorization = `Bearer ${token}`;
      }
      return req;
    },
    (error) => Promise.reject(error),
  );

  // On a 401, refresh the access token and retry the request once. Only clear
  // the session and redirect if the refresh itself fails.
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      if (error.response?.status !== 401) {
        return Promise.reject(error);
      }

      const originalRequest = error.config as
        | (InternalAxiosRequestConfig & { _retry?: boolean })
        | undefined;
      const url = originalRequest?.url ?? "";
      const isAuthBootstrap = NO_REFRESH_PATHS.some((prefix) => url.includes(prefix));

      if (isAuthBootstrap || !originalRequest) {
        return Promise.reject(error);
      }

      if (originalRequest._retry) {
        // Already retried once with a refreshed token and still unauthorized.
        onAuthFailure();
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        const refreshResponse = await performRefresh(client, scope);
        originalRequest.headers.Authorization = `Bearer ${refreshResponse.accessToken}`;
        return client.request(originalRequest);
      } catch {
        onAuthFailure();
        return Promise.reject(error);
      }
    },
  );

  return client;
}

function forceLogout(to: string, scope: AuthScope) {
  clearStoredTokens(scope);
  setAccessToken(null, scope);
  window.location.href = to;
}

/** Tenant/organization-scoped client (original behavior). */
export const api = createApiClient("tenant", () => forceLogout("/", "tenant"));

/** Platform-admin client — a failed refresh sends the admin back to platform login. */
export const platformApi = createApiClient("platform", () =>
  forceLogout("/platform/login", "platform"),
);

/**
 * Exchanges the stored refresh token for a new access token. Deduplicates
 * concurrent callers per scope. Defaults to the tenant scope.
 */
export function refreshAccessToken(scope: AuthScope = "tenant"): Promise<RefreshResponse> {
  const client = scope === "platform" ? platformApi : api;
  return performRefresh(client, scope);
}

export default api;
