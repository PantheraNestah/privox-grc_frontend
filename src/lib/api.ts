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

import axios from "axios";
import { config } from "./env";
import { getAccessToken } from "./token";

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

// ─── Response interceptor ─────────────────────────────────
// Handle 401 globally — clears session and redirects to login.
// Does NOT apply to the login endpoint so invalid credentials
// don't cause a page refresh.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? "";
      // Skip redirect for login and me endpoints
      if (!url.includes("/auth/login") && !url.includes("/v1/me")) {
        localStorage.removeItem("grc_refresh_token");
        localStorage.removeItem("grc_remember_me");
        sessionStorage.removeItem("grc_refresh_token");
        sessionStorage.removeItem("grc_remember_me");
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
