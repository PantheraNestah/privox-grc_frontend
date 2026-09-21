import { useEffect, useState, type CSSProperties } from "react";

const RING_COUNT = 6;
const FADE_MS = 2600;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

interface Spot {
  left: number;
  top: number;
  size: number;
  strong: boolean;
}

const randomSpot = (): Spot => ({
  left: rand(0, 100),
  top: rand(0, 100),
  size: rand(140, 460),
  strong: Math.random() > 0.5,
});

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * One ring: waits a random moment, jumps to a random spot while invisible, fades
 * in, holds for a random time, fades out, and repeats. Only `opacity` animates
 * (compositor-only), and the ring is never moved while it is visible.
 */
function Ring() {
  const [spot, setSpot] = useState<Spot>(randomSpot);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const start = () => {
      setSpot(randomSpot());
      timer = setTimeout(() => {
        setVisible(true);
        timer = setTimeout(() => {
          setVisible(false);
          timer = setTimeout(start, FADE_MS + rand(300, 2600));
        }, FADE_MS + rand(2000, 5500));
      }, 80);
    };

    timer = setTimeout(start, rand(0, 3500));
    return () => clearTimeout(timer);
  }, []);

  const style: CSSProperties = {
    left: `${spot.left}%`,
    top: `${spot.top}%`,
    width: spot.size,
    height: spot.size,
    transform: "translate(-50%, -50%)",
    opacity: visible ? 1 : 0,
    transition: `opacity ${FADE_MS}ms ease-in-out`,
    willChange: "opacity",
  };

  return (
    <div
      data-testid="backdrop-ring"
      aria-hidden
      className={`absolute rounded-full border ${spot.strong ? "border-accent/30" : "border-accent/20"}`}
      style={style}
    />
  );
}

/** Decorative rings that fade in and out at random places on the sign-in background. */
export function AuthBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <Ring key={i} />
      ))}
    </div>
  );
}
