/**
 * Mutable token holder shared between AuthContext and the axios interceptor.
 *
 * AuthContext sets the current access token here after login/refresh.
 * The axios request interceptor in api.ts reads it to attach the
 * Authorization header.
 */

let _currentToken: string | null = null;

export function setAccessToken(token: string | null) {
  _currentToken = token;
}

export function getAccessToken(): string | null {
  return _currentToken;
}
