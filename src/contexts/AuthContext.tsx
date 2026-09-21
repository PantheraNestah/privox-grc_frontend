import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api, refreshAccessToken } from "@/lib/api";
import { getTokenRefreshDelay } from "@/lib/auth-refresh";
import {
  PLATFORM_ACCOUNT_ON_TENANT_PORTAL,
  PortalMismatchError,
  isTenantSession,
  isTransientFailure,
  revokeIssuedSession,
} from "@/lib/auth-session";
import { queryClient } from "@/lib/query-client";
import {
  getAccessToken,
  setAccessToken,
  getStoredRefreshToken,
  storeRefreshToken,
  clearStoredTokens,
} from "@/lib/token";
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  LogoutRequest,
  AuthState,
} from "@/lib/auth-types";

// ─── Context ─────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login: (req: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    organization: null,
    permissions: [],
    accessToken: null,
    refreshToken: null,
    accessTokenExpiresAt: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const clearSession = useCallback(() => {
    clearStoredTokens();
    setAccessToken(null);
    queryClient.clear();
    setState({
      user: null,
      organization: null,
      permissions: [],
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  // ── Restore session from the stored refresh token ──────
  // The access token only lives in memory, so after a reload we exchange the
  // persisted refresh token for a new one and re-read the profile from /me.
  const refreshSession = useCallback(async () => {
    if (!getStoredRefreshToken()) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    try {
      const refreshResponse = await refreshAccessToken();
      const { data } = await api.get<MeResponse>("/v1/me");
      if (!data.organization) {
        throw new PortalMismatchError(PLATFORM_ACCOUNT_ON_TENANT_PORTAL);
      }

      setState({
        user: {
          id: data.id,
          email: data.email,
          username: data.username,
          fullName: data.fullName,
        },
        organization: data.organization,
        permissions: refreshResponse.permissions ?? data.permissions,
        accessToken: refreshResponse.accessToken,
        refreshToken: getStoredRefreshToken(),
        accessTokenExpiresAt: refreshResponse.accessTokenExpiresAt,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      // Offline/5xx says nothing about the session: keep the token for the next load.
      if (isTransientFailure(err)) {
        setState((s) => ({ ...s, isLoading: false }));
      } else {
        clearSession();
      }
    }
  }, [clearSession]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  // Refresh one minute before expiry, then reschedule from the new expiry.
  useEffect(() => {
    if (!state.isAuthenticated || !state.accessTokenExpiresAt) {
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const refreshResponse = await refreshAccessToken();
        if (!active) return;

        setState((current) => ({
          ...current,
          accessToken: refreshResponse.accessToken,
          refreshToken: refreshResponse.refreshToken,
          accessTokenExpiresAt: refreshResponse.accessTokenExpiresAt,
          permissions: refreshResponse.permissions ?? current.permissions,
        }));
      } catch {
        if (active) clearSession();
      }
    }, getTokenRefreshDelay(state.accessTokenExpiresAt));

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [state.isAuthenticated, state.accessTokenExpiresAt, clearSession]);

  // ── Login ──────────────────────────────────────────────
  const login = useCallback(async (req: LoginRequest) => {
    const { data } = await api.post<LoginResponse>("/v1/auth/login", {
      identifier: req.identifier,
      password: req.password,
      rememberMe: req.rememberMe,
    });
    // organizationId is intentionally omitted: the backend auto-resolves the
    // user's primary/active organization. The same server-side resolution mints a
    // platform session (organization: null) for platform admins, which the
    // tenant portal must not accept.
    if (!isTenantSession(data)) {
      await revokeIssuedSession(api, data);
      throw new PortalMismatchError(PLATFORM_ACCOUNT_ON_TENANT_PORTAL);
    }

    queryClient.clear();
    storeRefreshToken(data.refreshToken, req.rememberMe);
    setAccessToken(data.accessToken);

    setState({
      user: data.user,
      organization: data.organization,
      permissions: data.permissions,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessTokenExpiresAt: data.accessTokenExpiresAt,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  // ── Logout (calls API then clears local state) ─────────
  const logout = useCallback(async () => {
    const body: LogoutRequest = {
      accessToken: getAccessToken() ?? "",
      refreshToken: getStoredRefreshToken() ?? "",
    };

    // Fire-and-forget — clear local state regardless of API result
    try {
      await api.post("/v1/auth/logout", body);
    } catch {
      // API may be unreachable; still clear locally
    }

    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
