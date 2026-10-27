import { Loader2 } from "lucide-react";

/**
 * Placeholder shown while a lazily-loaded route (or a heavy widget such as the
 * organisation map) is being fetched. It renders inside the page's content area
 * rather than replacing the app chrome, so switching pages never flashes the
 * shell. `min-h` keeps the layout from jumping when the real page arrives.
 */
export function RouteFallback({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[45vh] items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-brand-accent" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}
