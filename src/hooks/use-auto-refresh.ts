/**
 * Auto-refresh workers for data that does not live in the React Query cache
 * (e.g. the localStorage-backed org-type registry) plus a small "last synced"
 * signal pages can surface.
 *
 * React Query queries get the same treatment from `refetchInterval` — see
 * `autoRefreshInterval` in `@/lib/live-refresh` and the `refetchOnWindowFocus`
 * setting in `@/lib/query-client`. This module covers the browser-local stores,
 * which nothing else keeps in sync.
 *
 * `useAutoRefresh` polls on an interval while the tab is visible and the
 * browser is online, refreshes immediately when the tab becomes visible again
 * (the "come back to the page and see the new child nodes" case) and when
 * connectivity returns, and stops entirely while disabled.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REFRESH_INTERVALS, type RefreshCadence } from "@/lib/live-refresh";

export interface AutoRefreshOptions {
  /** Named cadence; ignored when `intervalMs` is given. */
  cadence?: RefreshCadence;
  /** Explicit interval in milliseconds. */
  intervalMs?: number;
  /** Polling and event-driven refreshes are skipped entirely when false. */
  enabled?: boolean;
  /** Same-tab `CustomEvent` names that should also trigger a refresh. */
  events?: string[];
}

export interface AutoRefreshState {
  /** Timestamp of the last completed refresh, or null if none has run yet. */
  lastRefreshedAt: number | null;
  /** True while a refresh triggered by this hook is in flight. */
  isRefreshing: boolean;
  /** Runs a refresh immediately, outside the interval. */
  refreshNow: () => void;
}

export interface SyncedResource<T> extends AutoRefreshState {
  data: T;
}

function isVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}

function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  // `onLine` is undefined in some test environments — treat that as online.
  return navigator.onLine !== false;
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    !!value && typeof (value as Promise<unknown>).then === "function"
  );
}

export function useAutoRefresh(
  refresh: () => void | Promise<unknown>,
  options: AutoRefreshOptions = {},
): AutoRefreshState {
  const { cadence = "standard", intervalMs, enabled = true, events } = options;
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Keep the latest callback without re-creating the interval: callers usually
  // pass an inline closure that captures changing props.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  // Avoid overlapping refreshes when a tick and a visibility event coincide.
  const inFlight = useRef(false);

  const run = useCallback(() => {
    if (!enabled || inFlight.current) return;
    let result: void | Promise<unknown>;
    try {
      result = refreshRef.current();
    } catch {
      return;
    }
    if (!isThenable(result)) {
      setLastRefreshedAt(Date.now());
      return;
    }
    inFlight.current = true;
    setIsRefreshing(true);
    void result
      .catch(() => undefined)
      .then(() => {
        inFlight.current = false;
        setIsRefreshing(false);
        setLastRefreshedAt(Date.now());
      });
  }, [enabled]);

  // Join the event names so callers can pass an inline array without
  // re-subscribing on every render.
  const eventKey = events?.join("|") ?? "";

  useEffect(() => {
    if (!enabled) return;
    const period = intervalMs ?? REFRESH_INTERVALS[cadence];

    const tick = () => {
      if (!isVisible() || !isOnline()) return;
      run();
    };
    const onVisible = () => {
      if (isVisible() && isOnline()) run();
    };
    const onOnline = () => {
      if (isVisible()) run();
    };
    const timer = window.setInterval(tick, period);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    const names = eventKey ? eventKey.split("|") : [];
    names.forEach((name) => window.addEventListener(name, run));

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      names.forEach((name) => window.removeEventListener(name, run));
    };
  }, [enabled, cadence, intervalMs, eventKey, run]);

  return { lastRefreshedAt, isRefreshing, refreshNow: run };
}

/**
 * Keeps a value read out of browser-local storage in sync with the rest of the
 * app: same-tab change events, other tabs writing the same key (the native
 * `storage` event) and a periodic re-read as a safety net for writes that
 * happened before this component mounted.
 */
export function useSyncedLocalResource<T>(
  load: () => T,
  options: AutoRefreshOptions & { storageKeys?: string[] } = {},
): SyncedResource<T> {
  const { storageKeys, ...autoOptions } = options;

  // Latest loader without making the state below depend on its identity.
  const loadRef = useRef(load);
  loadRef.current = load;

  const [data, setData] = useState<T>(() => load());

  const refreshNow = useCallback(() => {
    setData(loadRef.current());
  }, []);

  const state = useAutoRefresh(refreshNow, autoOptions);
  const keyList = storageKeys?.join("|") ?? "";

  useEffect(() => {
    if (!keyList) return;
    const onStorage = (event: StorageEvent) => {
      // A null key means the whole store was cleared.
      if (event.key === null || keyList.split("|").includes(event.key)) refreshNow();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [keyList, refreshNow]);

  return useMemo(() => ({ data, ...state }), [data, state]);
}
