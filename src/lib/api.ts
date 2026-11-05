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
import {
  SessionFrozenError,
  isTenantSessionFrozen,
} from "./session-broadcast";
import type { RefreshResponse } from "./auth-types";

declare module "axios" {
  interface AxiosRequestConfig {
    /**
     * Public call (login, select-organization, refresh, invitation inspect or
     * new-user accept). It must not carry a bearer token, because a stale one
     * makes the server reject an otherwise valid request, and a 401 on it must
     * never trigger a refresh.
     */
    skipAuth?: boolean;
  }
}

// ─── Token refresh ─────────────────────────────────────────
// A 401 from these endpoints means bad credentials or an invalid/expired
// refresh token — never try to refresh (or redirect) off the back of one,
// or a failed refresh would loop forever. `/auth/select-organization`
// authenticates with a body token, not a bearer access token, so a 401 there
// means the selection itself expired.
const NO_REFRESH_PATHS = [
  "/auth/login",
  "/auth/logout",
  "/auth/refresh",
  "/auth/select-organization",
];

/** Exported so the "never refresh on this 401" list is unit-tested directly. */
export function isNoRefreshPath(url: string): boolean {
  return NO_REFRESH_PATHS.some((prefix) => url.includes(prefix));
}

// One in-flight refresh per scope, shared by the interceptor and the exported
// `refreshAccessToken` helper so concurrent 401s dedupe correctly.
const refreshPromises: Record<AuthScope, Promise<RefreshResponse> | null> = {
  tenant: null,
  platform: null,
};

/**
 * Runs `task` while holding a per-scope lock shared by every tab of this
 * browser. Refresh tokens rotate on each use, so two tabs refreshing with the
 * same token would log one of them out. Where Web Locks are unavailable the
 * in-tab dedupe below is the only guard.
 */
async function withCrossTabRefreshLock(
  scope: AuthScope,
  task: () => Promise<RefreshResponse>,
): Promise<RefreshResponse> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return task();
  return await locks.request(`grc-refresh-${scope}`, task);
}

async function performRefresh(
  client: AxiosInstance,
  scope: AuthScope,
): Promise<RefreshResponse> {
  if (!refreshPromises[scope]) {
    refreshPromises[scope] = withCrossTabRefreshLock(scope, async () => {
      // Read inside the lock: another tab may have rotated the token while we waited.
      const storedRefresh = getStoredRefreshToken(scope);
      if (!storedRefresh) {
        throw new Error("No refresh token available");
      }

      const { data } = await client.post<RefreshResponse>(
        "/v1/auth/refresh",
        { refreshToken: storedRefresh },
        { skipAuth: true },
      );

      // Persist the rotated token before the lock is released.
      setAccessToken(data.accessToken, scope);
      updateStoredRefreshToken(data.refreshToken, scope);
      return data;
    }).finally(() => {
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
      // Once the session moved in another tab, any tenant request from this
      // one would carry an access token bound to the old organization.
      if (scope === "tenant" && isTenantSessionFrozen()) {
        return Promise.reject(new SessionFrozenError());
      }

      const token = getAccessToken(scope);
      if (token && !req.skipAuth) {
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
      const isAuthBootstrap = isNoRefreshPath(url);

      // Public calls have no session to refresh; a 401 there is the answer.
      if (isAuthBootstrap || !originalRequest || originalRequest.skipAuth) {
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
  // Router paths are relative to Vite's base (e.g. GitHub Pages sub-path).
  window.location.href = import.meta.env.BASE_URL.replace(/\/$/, "") + to;
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
