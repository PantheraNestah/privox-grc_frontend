/**
 * Platform-admin authentication context.
 *
 * Deliberately separate from the tenant `AuthContext`: a platform session has
 * no `organization`, uses `platformApi` (token with no `org` claim), and
 * persists under its own storage keys so the two sessions never collide.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { platformApi, refreshAccessToken } from "@/lib/api";
import { getTokenRefreshDelay } from "@/lib/auth-refresh";
import {
  TENANT_ACCOUNT_ON_PLATFORM_PORTAL,
  PortalMismatchError,
  isPlatformSession,
  isTransientFailure,
  revokeIssuedSession,
} from "@/lib/auth-session";
import { queryClient } from "@/lib/query-client";
import {
  getAccessToken,
  setAccessToken,
  getStoredProfile,
  getStoredRefreshToken,
  storeProfile,
  storeRefreshToken,
  clearStoredTokens,
} from "@/lib/token";
import {
  loginPlatformAdmin,
  type PlatformLoginRequest,
  type PlatformLoginResponse,
  type PlatformUser,
} from "@/lib/platformAdmin";

// ─── Types ────────────────────────────────────────────────

export interface PlatformAuthState {
  user: PlatformUser | null;
  permissions: string[];
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface PlatformAuthContextValue extends PlatformAuthState {
  login: (req: PlatformLoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────

const initialState: PlatformAuthState = {
  user: null,
  permissions: [],
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  isAuthenticated: false,
  isLoading: true,
};

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlatformAuthState>(initialState);

  const clearSession = useCallback(() => {
    clearStoredTokens("platform");
    setAccessToken(null, "platform");
    queryClient.clear();
    setState({ ...initialState, isLoading: false });
  }, []);

  // ── Restore session from the stored refresh token ──────
  // Platform tokens have no `/me` (no `org` claim), so identity comes from the
  // snapshot saved at login and permissions from the refresh response.
  const refreshSession = useCallback(async () => {
    if (!getStoredRefreshToken("platform")) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    try {
      const refreshResponse = await refreshAccessToken("platform");
      const profile = getStoredProfile<PlatformUser>("platform");
      const permissions = refreshResponse.permissions ?? [];
      if (!profile || !isPlatformSession({ organization: null, permissions })) {
        throw new PortalMismatchError(TENANT_ACCOUNT_ON_PLATFORM_PORTAL);
      }

      setState({
        user: profile,
        permissions,
        accessToken: refreshResponse.accessToken,
        refreshToken: getStoredRefreshToken("platform"),
        accessTokenExpiresAt: refreshResponse.accessTokenExpiresAt,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
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
        const refreshResponse = await refreshAccessToken("platform");
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
  const login = useCallback(async (req: PlatformLoginRequest) => {
    const data: PlatformLoginResponse = await loginPlatformAdmin(req);

    // Correct credentials are not enough: a tenant user gets a tenant session
    // from this same endpoint and must not be admitted to the platform portal.
    if (!isPlatformSession(data)) {
      await revokeIssuedSession(platformApi, data);
      throw new PortalMismatchError(TENANT_ACCOUNT_ON_PLATFORM_PORTAL);
    }

    queryClient.clear();
    storeRefreshToken(data.refreshToken, req.rememberMe ?? false, "platform");
    storeProfile(data.user, "platform");
    setAccessToken(data.accessToken, "platform");

    setState({
      user: data.user,
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
    try {
      await platformApi.post("/v1/auth/logout", {
        accessToken: getAccessToken("platform") ?? "",
        refreshToken: getStoredRefreshToken("platform") ?? "",
      });
    } catch {
      // API may be unreachable; still clear locally.
    }

    clearSession();
  }, [clearSession]);

  return (
    <PlatformAuthContext.Provider
      value={{ ...state, login, logout, refreshSession }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────

export function usePlatformAuth(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) {
    throw new Error("usePlatformAuth must be used within a PlatformAuthProvider");
  }
  return ctx;
}
