/**
 * Shared auto-refresh ("live data") policy.
 *
 * The app deliberately caches aggressively (`staleTime` in the query client)
 * so navigation is instant. The cost is that data changed elsewhere — an
 * administrator adding a child unit, a platform admin enabling a module, an
 * approver publishing a strategy version — only appeared after a full browser
 * refresh. These cadences give the "live" pages a background worker so the
 * cache re-syncs on its own.
 *
 * Two rules keep polling cheap:
 *  - a query that errored stops polling (a 403/500 would otherwise be retried
 *    on every tick until the user reloads the page);
 *  - polling pauses whenever the tab is hidden, and the query client refetches
 *    on focus/reconnect, so background tabs cost nothing.
 */

/** Milliseconds between background re-syncs, named by how fast the resource moves. */
export const REFRESH_INTERVALS = {
  /** Placements, invitations, dashboards — things users expect to see move. */
  fast: 15_000,
  /** Org tree, risk strategy, user and group lists. */
  standard: 30_000,
  /** Structural/config data: strategy trees, catalogues, module subscriptions. */
  slow: 60_000,
} as const;

export type RefreshCadence = keyof typeof REFRESH_INTERVALS;

/** Minimal shape of the React Query observer passed to a `refetchInterval` function. */
export interface PollableQuery {
  state: { status: string };
}

/**
 * Builds a `refetchInterval` for a query hook: polls every `cadence` while the
 * query is healthy, and returns `false` (stop) once it has failed so a broken
 * or forbidden endpoint is not re-requested on every tick.
 */
export function autoRefreshInterval(cadence: RefreshCadence) {
  const intervalMs = REFRESH_INTERVALS[cadence];
  return (query: PollableQuery): number | false =>
    query.state.status === "error" ? false : intervalMs;
}
