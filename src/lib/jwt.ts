/**
 * Minimal JWT payload reader for tenant access tokens.
 *
 * The client never verifies the signature (the backend does that); it only
 * reads non-secret claims. `modules` is used to restore module entitlements
 * after a page reload, because neither `POST /v1/auth/refresh` nor `GET /v1/me`
 * returns `allocatedModules`, but the refreshed access token still carries the
 * claim.
 */

export interface TenantJwtClaims {
  sub?: string;
  email?: string;
  /** Organization UUID (note: `org`, not `organizationId`). */
  org?: string;
  sid?: string;
  modules?: string[];
  permissions?: string[];
  exp?: number;
}

/** Base64URL → JSON, tolerant of missing padding and malformed input. */
export function decodeJwtPayload(token: string | null | undefined): TenantJwtClaims | null {
  if (!token) return null;
  const segment = token.split(".")[1];
  if (!segment) return null;

  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as TenantJwtClaims;
  } catch {
    return null;
  }
}

/** Module codes from the access token's `modules` claim (empty if absent). */
export function getJwtModules(token: string | null | undefined): string[] {
  const modules = decodeJwtPayload(token)?.modules;
  return Array.isArray(modules) ? modules.filter((code): code is string => typeof code === "string") : [];
}
