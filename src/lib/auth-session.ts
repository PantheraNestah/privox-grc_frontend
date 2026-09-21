/**
 * Scope checks for the shared `POST /v1/auth/login` endpoint.
 *
 * The backend uses one endpoint for both portals and decides the session type
 * from the account: an account with platform permissions gets a platform
 * session (`organization: null`), otherwise it gets a tenant session bound to
 * its organisation. Each portal must therefore verify which one it received
 * instead of trusting "credentials were correct".
 */

import { isAxiosError, type AxiosInstance } from "axios";

export class PortalMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalMismatchError";
  }
}

export const PLATFORM_ACCOUNT_ON_TENANT_PORTAL =
  "This is a platform administrator account. Sign in through the Platform Admin portal instead.";

export const TENANT_ACCOUNT_ON_PLATFORM_PORTAL =
  "This account does not have platform administrator access. Sign in through your organisation's portal instead.";

interface SessionShape {
  organization: unknown;
  permissions: readonly string[];
}

/** Tenant sessions are always bound to an organisation. */
export function isTenantSession(session: SessionShape): boolean {
  return session.organization != null;
}

/** Platform sessions carry no organisation and at least one platform permission. */
export function isPlatformSession(session: SessionShape): boolean {
  return session.organization == null && session.permissions.length > 0;
}

/**
 * Best-effort server-side revocation of a session the portal refuses to use,
 * so a rejected login does not leave a live refresh token behind.
 */
export async function revokeIssuedSession(
  client: Pick<AxiosInstance, "post">,
  tokens: { accessToken: string; refreshToken: string },
): Promise<void> {
  try {
    await client.post("/v1/auth/logout", tokens, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
  } catch {
    // The token is never stored client-side, so a failed revoke is not fatal.
  }
}

/**
 * Offline / server-side failures say nothing about the stored session, so a
 * restore that fails this way must keep the refresh token for the next try.
 * Anything else (401/400/403, a wrong-scope session) means it is unusable.
 */
export function isTransientFailure(error: unknown): boolean {
  return isAxiosError(error) && (!error.response || error.response.status >= 500);
}
