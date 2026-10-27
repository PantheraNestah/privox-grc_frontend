import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { api, refreshAccessToken } from "@/lib/api";
import { getTokenRefreshDelay } from "@/lib/auth-refresh";
import { isAxiosError } from "axios";
import {
  PLATFORM_ACCOUNT_ON_TENANT_PORTAL,
  PortalMismatchError,
  isTenantSession,
  isTransientFailure,
  isUnauthorized,
  revokeIssuedSession,
} from "@/lib/auth-session";
import { queryClient } from "@/lib/query-client";
import { getJwtModules } from "@/lib/jwt";
import {
  getAccessToken,
  setAccessToken,
  getStoredRefreshToken,
  storeRefreshToken,
  updateStoredRefreshToken,
  clearStoredTokens,
} from "@/lib/token";
import {
  freezeTenantSession,
  publishSessionChange,
  subscribeSessionChange,
} from "@/lib/session-broadcast";
import {
  SELECTION_EXPIRED_MESSAGE,
  rememberLastOrganization,
} from "@/lib/organization-options";
import type {
  AuthenticatedLoginResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  LogoutRequest,
  AuthState,
  OrganizationOptionDto,
} from "@/lib/auth-types";

// ─── Organization selection ──────────────────────────────

/** A login that stopped at the organization picker. Lives in memory only. */
export interface OrganizationSelectionState {
  selectionToken: string;
  organizations: OrganizationOptionDto[];
  expiresAt: string | null;
  rememberMe: boolean;
}

/** `authenticated` navigates on; `organization-required` shows the picker. */
export type LoginResult =
  | { status: "authenticated" }
  | { status: "organization-required" };

/** Set when this tab learned that another tab changed the shared session. */
export interface SessionConflict {
  kind: "switched" | "login";
  organizationName?: string;
}

// ─── Context ─────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login: (req: LoginRequest) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  /** Login stopped at the picker; `null` at every other time. */
  organizationSelection: OrganizationSelectionState | null;
  /** Finishes a selection-required login and commits the returned session. */
  selectOrganization: (organizationId: string) => Promise<void>;
  /** Abandons the picker (e.g. "Not you?") and drops the in-memory token. */
  cancelOrganizationSelection: (notice?: string) => void;
  /** Moves the signed-in user to another of their organizations. */
  switchOrganization: (organizationId: string) => Promise<void>;
  /** One-off message for the credentials form (e.g. selection expired). */
  authNotice: string | null;
  clearAuthNotice: () => void;
  /** Non-null while this tab waits for a reload after a cross-tab change. */
  sessionConflict: SessionConflict | null;
  /**
   * Question 1 of the V3 entitlement model — can the user SEE this module?
   * Mirrors the backend `@userModuleAccess`: `organization.manage` bypasses the
   * allocation list and grants every module.
   */
  hasModule: (moduleCode: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const emptyState: AuthState = {
  user: null,
  organization: null,
  permissions: [],
  allocatedModules: [],
  orgNodeIds: [],
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  isAuthenticated: false,
  isLoading: true,
};

// ─── Provider ────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(emptyState);
  const [organizationSelection, setOrganizationSelection] =
    useState<OrganizationSelectionState | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [sessionConflict, setSessionConflict] = useState<SessionConflict | null>(null);

  // Read by the cross-tab listener without re-subscribing on every change.
  const stateRef = useRef(state);
  const hasPendingSelectionRef = useRef(organizationSelection !== null);
  stateRef.current = state;
  hasPendingSelectionRef.current = organizationSelection !== null;

  const clearSession = useCallback(() => {
    clearStoredTokens();
    setAccessToken(null);
    queryClient.clear();
    setOrganizationSelection(null);
    setState({ ...emptyState, isLoading: false });
  }, []);

  /**
   * Commits a completed session (login, organization selection, or switch).
   * `rememberMe` is only passed when it is known (a fresh login); a switch
   * keeps whichever storage currently holds the refresh token.
   */
  const commitSession = useCallback(
    (data: AuthenticatedLoginResponse, rememberMe?: boolean) => {
      queryClient.clear();
      if (rememberMe === undefined) {
        updateStoredRefreshToken(data.refreshToken);
      } else {
        storeRefreshToken(data.refreshToken, rememberMe);
      }
      setAccessToken(data.accessToken);

      setState({
        user: data.user,
        organization: data.organization,
        permissions: data.permissions ?? [],
        allocatedModules: data.allocatedModules ?? getJwtModules(data.accessToken),
        orgNodeIds: data.orgNodeIds ?? [],
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        accessTokenExpiresAt: data.accessTokenExpiresAt,
        isAuthenticated: true,
        isLoading: false,
      });

      if (data.organization) {
        rememberLastOrganization(data.organization);
      }
    },
    [],
  );

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
        // Refresh/me omit allocations; the refreshed JWT carries the `modules` claim.
        allocatedModules: data.allocatedModules ?? getJwtModules(refreshResponse.accessToken),
        orgNodeIds: data.orgNodeIds ?? [],
        accessToken: refreshResponse.accessToken,
        refreshToken: getStoredRefreshToken(),
        accessTokenExpiresAt: refreshResponse.accessTokenExpiresAt,
        isAuthenticated: true,
        isLoading: false,
      });
      rememberLastOrganization(data.organization);
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

        setState((current) => {
          const refreshedModules = getJwtModules(refreshResponse.accessToken);
          return {
            ...current,
            accessToken: refreshResponse.accessToken,
            refreshToken: refreshResponse.refreshToken,
            accessTokenExpiresAt: refreshResponse.accessTokenExpiresAt,
            permissions: refreshResponse.permissions ?? current.permissions,
            allocatedModules: refreshedModules.length ? refreshedModules : current.allocatedModules,
          };
        });
      } catch {
        if (active) clearSession();
      }
    }, getTokenRefreshDelay(state.accessTokenExpiresAt));

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [state.isAuthenticated, state.accessTokenExpiresAt, clearSession]);

  // The selection token is short-lived: drop it locally when it runs out so
  // the picker cannot offer a choice that is guaranteed to 401.
  useEffect(() => {
    if (!organizationSelection?.expiresAt) return;
    const delay = new Date(organizationSelection.expiresAt).getTime() - Date.now();
    const expire = () => {
      setOrganizationSelection(null);
      setAuthNotice(SELECTION_EXPIRED_MESSAGE);
    };
    if (delay <= 0) {
      expire();
      return;
    }
    const timer = window.setTimeout(expire, delay);
    return () => window.clearTimeout(timer);
  }, [organizationSelection]);

  // ── Cross-tab session changes ──────────────────────────
  useEffect(
    () =>
      subscribeSessionChange((message) => {
        const current = stateRef.current;

        if (message.type === "logout") {
          // Nothing to do on a tab that has no session (or a pending picker).
          if (!current.isAuthenticated && !hasPendingSelectionRef.current) return;
          clearSession();
          window.location.href =
            import.meta.env.BASE_URL.replace(/\/$/, "") + "/";
          return;
        }

        // Only a signed-in tab can be writing to the wrong organization.
        if (!current.isAuthenticated) return;

        // Re-signing in as the same user in the same organization is not a
        // conflict; it is often just another tab finishing the login flow.
        if (
          message.type === "login" &&
          message.userId === current.user?.id &&
          message.organizationId === current.organization?.id
        ) {
          return;
        }

        freezeTenantSession();
        setSessionConflict({
          kind: message.type,
          organizationName: message.organizationName,
        });
      }),
    [clearSession],
  );

  // ── Login ──────────────────────────────────────────────
  const login = useCallback(
    async (req: LoginRequest): Promise<LoginResult> => {
      const { data } = await api.post<LoginResponse>("/v1/auth/login", {
        identifier: req.identifier,
        password: req.password,
        rememberMe: req.rememberMe,
        // Opt in: accounts with 2+ organizations get the picker instead of a
        // session bound to their primary organization.
        supportsOrganizationSelection: true,
        ...(req.organizationId ? { organizationId: req.organizationId } : {}),
      });

      if (data.status === "ORGANIZATION_SELECTION_REQUIRED") {
        // No tokens, no organization: keep the short-lived selection token in
        // memory only and let the UI show the organization cards.
        setOrganizationSelection({
          selectionToken: data.selectionToken,
          organizations: data.organizations ?? [],
          expiresAt: data.selectionTokenExpiresAt ?? null,
          rememberMe: req.rememberMe,
        });
        setAuthNotice(null);
        return { status: "organization-required" };
      }

      // organizationId is intentionally omitted on a normal login: the backend
      // auto-resolves the user's primary/active organization. The same
      // server-side resolution mints a platform session (organization: null)
      // for platform admins, which the tenant portal must not accept.
      if (
        !isTenantSession({
          organization: data.organization,
          permissions: data.permissions ?? [],
        })
      ) {
        await revokeIssuedSession(api, data);
        throw new PortalMismatchError(PLATFORM_ACCOUNT_ON_TENANT_PORTAL);
      }

      commitSession(data, req.rememberMe);
      setOrganizationSelection(null);
      setAuthNotice(null);
      publishSessionChange({
        type: "login",
        organizationName: data.organization?.name,
        organizationId: data.organization?.id,
        userId: data.user?.id,
      });
      return { status: "authenticated" };
    },
    [commitSession],
  );

  // ── Finish a selection-required login ──────────────────
  const selectOrganization = useCallback(
    async (organizationId: string) => {
      const pending = organizationSelection;
      if (!pending) {
        throw new Error("No organization selection is in progress.");
      }

      try {
        const { data } = await api.post<LoginResponse>(
          "/v1/auth/select-organization",
          {
            selectionToken: pending.selectionToken,
            organizationId,
          },
        );

        if (
          data.status === "ORGANIZATION_SELECTION_REQUIRED" ||
          !isTenantSession({
            organization: data.organization,
            permissions: data.permissions ?? [],
          })
        ) {
          throw new PortalMismatchError(PLATFORM_ACCOUNT_ON_TENANT_PORTAL);
        }

        commitSession(data, pending.rememberMe);
        setOrganizationSelection(null);
        setAuthNotice(null);
        publishSessionChange({
          type: "login",
          organizationName: data.organization?.name,
          organizationId: data.organization?.id,
          userId: data.user?.id,
        });
      } catch (err) {
        if (isUnauthorized(err)) {
          // Expired/bad selection token: back to credentials, never a loop.
          setOrganizationSelection(null);
          setAuthNotice(SELECTION_EXPIRED_MESSAGE);
        } else if (isAxiosError(err) && err.response?.status === 403) {
          // Lost access to that organization: drop its card, keep the rest.
          setOrganizationSelection((current) =>
            current
              ? {
                  ...current,
                  organizations: current.organizations.filter(
                    (org) => org.id !== organizationId,
                  ),
                }
              : current,
          );
        }
        throw err;
      }
    },
    [organizationSelection, commitSession],
  );

  const cancelOrganizationSelection = useCallback((notice?: string) => {
    setOrganizationSelection(null);
    setAuthNotice(notice ?? null);
  }, []);

  // ── Switch organization (signed-in) ────────────────────
  const switchOrganization = useCallback(
    async (organizationId: string) => {
      // Stop queued/active reads first so no response issued against the old
      // access token can repopulate the cache with the previous org's data.
      await queryClient.cancelQueries();

      const { data } = await api.post<LoginResponse>(
        "/v1/auth/switch-organization",
        { organizationId },
      );

      if (
        data.status === "ORGANIZATION_SELECTION_REQUIRED" ||
        !isTenantSession({
          organization: data.organization,
          permissions: data.permissions ?? [],
        })
      ) {
        throw new PortalMismatchError(PLATFORM_ACCOUNT_ON_TENANT_PORTAL);
      }

      commitSession(data);
      publishSessionChange({
        type: "switched",
        organizationName: data.organization?.name ?? "another organization",
      });
    },
    [commitSession],
  );

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
    setAuthNotice(null);
    publishSessionChange({ type: "logout" });
  }, [clearSession]);

  // Question 1: baseline read entitlement. `organization.manage` is the
  // implicit bypass the backend applies in `UserModuleAccessChecker`.
  const hasModule = useCallback(
    (moduleCode: string): boolean => {
      if (!state.isAuthenticated) return false;
      if (state.permissions.includes("organization.manage")) return true;

      const normalized = moduleCode.trim().toUpperCase();
      if (!normalized) return false;
      return state.allocatedModules.some((code) => code.trim().toUpperCase() === normalized);
    },
    [state.isAuthenticated, state.permissions, state.allocatedModules],
  );

  const clearAuthNotice = useCallback(() => setAuthNotice(null), []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshSession,
        organizationSelection,
        selectOrganization,
        cancelOrganizationSelection,
        switchOrganization,
        authNotice,
        clearAuthNotice,
        sessionConflict,
        hasModule,
      }}
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
