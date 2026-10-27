import { useEffect, useRef, useState, type ReactNode } from "react";

interface DeferredRenderProps {
  children: ReactNode;
  /** Shown until the wrapper is close enough to the viewport. */
  fallback?: ReactNode;
  /** How far ahead of the viewport to start mounting (CSS pixels). */
  rootMargin?: string;
  className?: string;
}

/**
 * Defers mounting `children` until the wrapper approaches the viewport.
 *
 * Used for the organisation map: React Flow plus its layout engine is the
 * heaviest code on the page and sits far below the fold, so downloading and
 * laying it out on page open is wasted work for anyone who never scrolls that
 * far. Once mounted it stays mounted, so scrolling back up doesn't reload it.
 *
 * Environments without `IntersectionObserver` (jsdom, very old browsers) mount
 * immediately — a graceful degradation, never a blank box.
 */
export function DeferredRender({
  children,
  fallback = null,
  rootMargin = "400px",
  className,
}: DeferredRenderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [mounted, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {mounted ? children : fallback}
    </div>
  );
}
