const REFRESH_EARLY_MS = 60_000;

export function getTokenRefreshDelay(
  accessTokenExpiresAt: string,
  now = Date.now(),
): number {
  return Math.max(0, new Date(accessTokenExpiresAt).getTime() - now - REFRESH_EARLY_MS);
}
