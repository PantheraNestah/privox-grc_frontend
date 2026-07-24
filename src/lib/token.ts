/**
 * Token storage shared between AuthContext and the axios interceptor in api.ts.
 *
 * The in-memory access token is read by the request interceptor to attach the
 * Authorization header. The refresh token is persisted in localStorage
 * (remember me) or sessionStorage so a page reload / a background token
 * refresh can restore the session without asking the user to log in again.
 */

let _currentToken: string | null = null;

export function setAccessToken(token: string | null) {
  _currentToken = token;
}

export function getAccessToken(): string | null {
  return _currentToken;
}

const REFRESH_KEY = "grc_refresh_token";
const REMEMBER_KEY = "grc_remember_me";

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
}

/** Called at login, when the user's "remember me" choice is known. */
export function storeRefreshToken(token: string, rememberMe: boolean) {
  if (rememberMe) {
    localStorage.setItem(REFRESH_KEY, token);
    localStorage.setItem(REMEMBER_KEY, "true");
    sessionStorage.removeItem(REFRESH_KEY);
  } else {
    sessionStorage.setItem(REFRESH_KEY, token);
    sessionStorage.setItem(REMEMBER_KEY, "true");
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  }
}

/** Called after a token refresh — reuses whichever storage already held the token. */
export function updateStoredRefreshToken(token: string) {
  if (localStorage.getItem(REFRESH_KEY) !== null) {
    localStorage.setItem(REFRESH_KEY, token);
  } else {
    sessionStorage.setItem(REFRESH_KEY, token);
  }
}

export function clearStoredTokens() {
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(REMEMBER_KEY);
}
