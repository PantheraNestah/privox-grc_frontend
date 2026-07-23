import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { setAccessToken } from "@/lib/token";
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  AuthState,
} from "@/lib/auth-types";

// Default organisation UUID — hardcoded here, not in .env
const ORGANIZATION_ID = "6d46a49f-268c-468a-a9ea-a0407db30d6b";

// ─── Token storage helpers ───────────────────────────────

const REFRESH_KEY = "grc_refresh_token";
const REMEMBER_KEY = "grc_remember_me";

function getStoredRefreshToken(): string | null {
  // Check localStorage first (remember me), then sessionStorage
  return (
    localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY)
  );
}

function storeRefreshToken(token: string, rememberMe: boolean) {
  if (rememberMe) {
    localStorage.setItem(REFRESH_KEY, token);
    localStorage.setItem(REMEMBER_KEY, "true");
    // Clear session storage in case it was there
    sessionStorage.removeItem(REFRESH_KEY);
  } else {
    sessionStorage.setItem(REFRESH_KEY, token);
    sessionStorage.setItem(REMEMBER_KEY, "true");
    // Clear local storage in case it was there
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }
}

function clearTokens() {
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(REMEMBER_KEY);
}

// ─── Context ─────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login: (req: LoginRequest) => Promise<void>;
  logout: () => void;
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
    accessTokenExpiresAt: null,
    isAuthenticated: false,
    isLoading: true, // starts loading until we check for existing session
  });

  // ── Restore session from refresh token ─────────────────
  const refreshSession = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    try {
      const { data } = await api.get<MeResponse>("/v1/me", {
        headers: { Authorization: `Bearer ${refreshToken}` },
      });

      // Use the refresh token as our current bearer token
      setAccessToken(refreshToken);

      setState({
        user: {
          id: data.id,
          email: data.email,
          username: data.username,
          fullName: data.fullName,
        },
        organization: data.organization,
        permissions: data.permissions,
        accessToken: refreshToken,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      // Token invalid or expired — clear and redirect to login
      clearTokens();
      setAccessToken(null);
      setState({
        user: null,
        organization: null,
        permissions: [],
        accessToken: null,
        accessTokenExpiresAt: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  // ── Check for existing session on mount ────────────────
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // ── Login ──────────────────────────────────────────────
  const login = useCallback(async (req: LoginRequest) => {
    const { data } = await api.post<LoginResponse>("/v1/auth/login", {
      identifier: req.identifier,
      password: req.password,
      organizationId: ORGANIZATION_ID,
      rememberMe: req.rememberMe,
    });

    // Store refresh token per remember-me preference
    storeRefreshToken(data.refreshToken, req.rememberMe);

    // Set the access token in the shared module for axios interceptors
    setAccessToken(data.accessToken);

    setState({
      user: data.user,
      organization: data.organization,
      permissions: data.permissions,
      accessToken: data.accessToken,
      accessTokenExpiresAt: data.accessTokenExpiresAt,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  // ── Logout ─────────────────────────────────────────────
  const logout = useCallback(() => {
    clearTokens();
    setAccessToken(null);
    setState({
      user: null,
      organization: null,
      permissions: [],
      accessToken: null,
      accessTokenExpiresAt: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

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
