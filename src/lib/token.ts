/**
 * Token storage shared between the auth contexts and the axios interceptors
 * in api.ts.
 *
 * Two independent auth scopes coexist:
 *  - "tenant"   — organization-scoped session (the existing dashboard).
 *  - "platform" — platform-admin session (token with no `org` claim).
 *
 * Each scope owns its own in-memory access token and its own persisted refresh
 * token, so the two sessions can never clobber one another. Scope defaults to
 * "tenant" for backward compatibility with existing callers.
 */

export type AuthScope = "tenant" | "platform";

const STORAGE_KEYS: Record<AuthScope, { refresh: string; remember: string }> = {
  tenant: { refresh: "grc_refresh_token", remember: "grc_remember_me" },
  platform: { refresh: "grc_platform_refresh_token", remember: "grc_platform_remember_me" },
};

const PROFILE_KEYS: Record<AuthScope, string> = {
  tenant: "grc_profile",
  platform: "grc_platform_profile",
};

const _currentToken: Record<AuthScope, string | null> = {
  tenant: null,
  platform: null,
};

export function setAccessToken(token: string | null, scope: AuthScope = "tenant") {
  _currentToken[scope] = token;
}

export function getAccessToken(scope: AuthScope = "tenant"): string | null {
  return _currentToken[scope];
}

export function getStoredRefreshToken(scope: AuthScope = "tenant"): string | null {
  const { refresh } = STORAGE_KEYS[scope];
  return localStorage.getItem(refresh) ?? sessionStorage.getItem(refresh);
}

/** Called at login, when the user's "remember me" choice is known. */
export function storeRefreshToken(
  token: string,
  rememberMe: boolean,
  scope: AuthScope = "tenant",
) {
  const { refresh, remember } = STORAGE_KEYS[scope];
  if (rememberMe) {
    localStorage.setItem(refresh, token);
    localStorage.setItem(remember, "true");
    sessionStorage.removeItem(refresh);
  } else {
    sessionStorage.setItem(refresh, token);
    localStorage.removeItem(refresh);
    localStorage.removeItem(remember);
  }
}

/** Called after a token refresh — reuses whichever storage already held the token. */
export function updateStoredRefreshToken(token: string, scope: AuthScope = "tenant") {
  const { refresh } = STORAGE_KEYS[scope];
  if (localStorage.getItem(refresh) !== null) {
    localStorage.setItem(refresh, token);
  } else {
    sessionStorage.setItem(refresh, token);
  }
}

/**
 * Persists a small, non-secret identity snapshot beside the refresh token (same
 * storage, so it shares its "remember me" lifetime). Needed where the server
 * cannot re-supply the profile on restore (platform sessions have no `/me`).
 */
export function storeProfile(profile: unknown, scope: AuthScope = "tenant") {
  const target = localStorage.getItem(STORAGE_KEYS[scope].refresh) !== null ? localStorage : sessionStorage;
  target.setItem(PROFILE_KEYS[scope], JSON.stringify(profile));
}

export function getStoredProfile<T>(scope: AuthScope = "tenant"): T | null {
  const raw = localStorage.getItem(PROFILE_KEYS[scope]) ?? sessionStorage.getItem(PROFILE_KEYS[scope]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearStoredTokens(scope: AuthScope = "tenant") {
  const { refresh, remember } = STORAGE_KEYS[scope];
  localStorage.removeItem(refresh);
  localStorage.removeItem(remember);
  localStorage.removeItem(PROFILE_KEYS[scope]);
  sessionStorage.removeItem(refresh);
  sessionStorage.removeItem(remember);
  sessionStorage.removeItem(PROFILE_KEYS[scope]);
}
