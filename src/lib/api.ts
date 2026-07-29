/**
 * Axios-based API client.
 *
 * The backend (your server) handles all PostgreSQL database operations.
 * This client talks to your backend API endpoints.
 *
 * Usage:
 *   import { api } from "@/lib/api";
 *   const users = await api.get("/users");
 *   const newUser = await api.post("/users", { name: "Alice" });
 */

import axios, { type InternalAxiosRequestConfig } from "axios";
import { config } from "./env";
import {
  getAccessToken,
  setAccessToken,
  getStoredRefreshToken,
  updateStoredRefreshToken,
  clearStoredTokens,
} from "./token";
import type { RefreshResponse } from "./auth-types";

export const api = axios.create({
  baseURL: config.apiUrl,
  timeout: config.apiTimeout,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Request interceptor ──────────────────────────────────
// Attach access token from the AuthContext's in-memory store.
api.interceptors.request.use(
  (req) => {
    const token = getAccessToken();
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
  },
  (error) => Promise.reject(error),
);

// ─── Token refresh ─────────────────────────────────────────
// A 401 from these endpoints means bad credentials or an invalid/expired
// refresh token — never try to refresh (or redirect) off the back of one,
// or a failed refresh would loop forever.
const NO_REFRESH_PATHS = ["/auth/login", "/auth/logout", "/auth/refresh"];

let refreshPromise: Promise<RefreshResponse> | null = null;

/** Exchanges the stored refresh token for a new access token. Deduplicates concurrent callers. */
export async function refreshAccessToken(): Promise<RefreshResponse> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const storedRefresh = getStoredRefreshToken();
      if (!storedRefresh) {
        throw new Error("No refresh token available");
      }

      const { data } = await api.post<RefreshResponse>("/v1/auth/refresh", {
        refreshToken: storedRefresh,
      });

      setAccessToken(data.accessToken);
      updateStoredRefreshToken(data.refreshToken);
      return data;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function forceLogout() {
  clearStoredTokens();
  setAccessToken(null);
  window.location.href = "/";
}

// ─── Response interceptor ─────────────────────────────────
// On a 401, refresh the access token and retry the request once. Only clear
// the session and redirect to login if the refresh itself fails.
api.interceptors.response.use(
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
      forceLogout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      const refreshResponse = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${refreshResponse.accessToken}`;
      return api.request(originalRequest);
    } catch {
      forceLogout();
      return Promise.reject(error);
    }
  },
);

export default api;
