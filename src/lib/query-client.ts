import { QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

const NON_RETRYABLE_CLIENT_ERRORS = new Set([408, 429]);

/**
 * Don't hammer the API with requests that cannot succeed: 4xx responses (bad
 * id, forbidden, expired session handled by the axios interceptor) fail fast,
 * while network/5xx failures get two retries.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isAxiosError(error) && error.response) {
    const { status } = error.response;
    if (status < 500 && !NON_RETRYABLE_CLIENT_ERRORS.has(status)) return false;
  }
  return failureCount < 2;
}

/**
 * App-wide query cache. Data is treated as fresh for a minute and kept for ten
 * after the last subscriber leaves, so moving between pages re-uses results
 * instead of refetching. Individual hooks override `staleTime` where a
 * resource changes more or less often.
 *
 * It is a module singleton (not created inside `<App>`) so the auth layer can
 * `clear()` it on login/logout: cached tenant data must never survive into the
 * next session.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
    },
    mutations: { retry: false },
  },
});
