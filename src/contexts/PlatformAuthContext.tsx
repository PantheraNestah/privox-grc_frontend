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
  getAccessToken,
  setAccessToken,
  getStoredRefreshToken,
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
    setState({ ...initialState, isLoading: false });
  }, []);

  // ── Restore session from refresh token ─────────────────
  const refreshSession = useCallback(async () => {
    const storedRefresh = getStoredRefreshToken("platform");
    if (!storedRefresh) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    try {
      const refreshResponse = await refreshAccessToken("platform");
      setState((s) => ({
        ...s,
        accessToken: refreshResponse.accessToken,
        refreshToken: getStoredRefreshToken("platform"),
        accessTokenExpiresAt: refreshResponse.accessTokenExpiresAt,
        isAuthenticated: true,
        isLoading: false,
      }));
    } catch {
      clearSession();
    }
  }, [clearSession]);

  // Always require an explicit platform login when the app starts (mirrors the
  // tenant context).
  useEffect(() => {
    clearStoredTokens("platform");
    setAccessToken(null, "platform");
    setState((current) => ({ ...current, isLoading: false }));
  }, []);

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

    storeRefreshToken(data.refreshToken, req.rememberMe ?? false, "platform");
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
