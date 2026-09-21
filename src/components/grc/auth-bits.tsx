/**
 * Shared authentication UI primitives.
 *
 * Extracted from the tenant `AuthScreen` so the platform-admin login can reuse
 * the exact same brand panel, page shell, headers and step indicator. Form
 * controls live in shadcn (`CredentialsForm` and the forgot-password views).
 */

import { type ReactNode } from "react";
import { AuthBackdrop } from "@/components/grc/AuthBackdrop";
import { Logo, BrandName } from "@/components/grc/Logo";
import { cn } from "@/lib/utils";

// ─── Brand panel + page shell ─────────────────────────────

const DEFAULT_PANEL_TITLE = (
  <>
    Governance, Risk
    <br />
    &amp; Compliance
    <strong className="block font-semibold text-sky">Unified Platform</strong>
  </>
);

const DEFAULT_PANEL_SUBTITLE =
  "A centralised GRC solution empowering organisations to manage risk, ensure compliance, and maintain operational continuity.";

interface AuthShellProps {
  children: ReactNode;
  /** When false, plays the slide-in animation (matches AuthScreen's view transitions). */
  animating?: boolean;
  /** Key on the form container so each view re-animates. */
  formKey?: string;
  panelTitle?: ReactNode;
  panelSubtitle?: string;
}

export function AuthShell({
  children,
  animating,
  formKey,
  panelTitle = DEFAULT_PANEL_TITLE,
  panelSubtitle = DEFAULT_PANEL_SUBTITLE,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-deep text-white auth-radial">
      <AuthBackdrop />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 md:px-10 lg:px-14">
        <header className="flex items-center gap-2.5 lg:hidden">
          <Logo />
          <BrandName className="text-2xl font-semibold tracking-tight" />
        </header>

        <div className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16">
          {/* Brand message (large screens) */}
          <div className="hidden lg:block">
            <div className="mb-10 flex items-center gap-3">
              <Logo size={44} />
              <BrandName className="text-3xl font-semibold tracking-tight" />
            </div>
            <h1 className="mb-6 text-5xl font-light leading-[1.08] tracking-tight xl:text-6xl 2xl:text-7xl">
              {panelTitle}
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-brand-muted">{panelSubtitle}</p>
          </div>

          {/* Floating credentials card */}
          <main className="flex justify-center lg:justify-end">
            <div
              className={cn(
                "w-full max-w-md rounded-2xl bg-white p-6 text-foreground shadow-2xl sm:p-10",
                !animating && "animate-slide-in",
              )}
              key={formKey}
            >
              {children}
            </div>
          </main>
        </div>

        <footer>
          <p className="text-center text-[11px] text-brand-muted/60">© First Advantage 2026. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}

// ─── Form primitives ──────────────────────────────────────

export const ViewHeader = ({
  tag,
  title,
  sub,
  center,
}: {
  tag?: string;
  title: string;
  sub: string;
  center?: boolean;
}) => (
  <div className={cn("mb-7", center && "text-center")}>
    {tag && <p className="text-[10.5px] tracking-[0.15em] uppercase text-brand-accent mb-2">{tag}</p>}
    <h2 className="text-[27px] font-semibold tracking-tight text-navy-deep mb-1.5">{title}</h2>
    <p className="text-[13.5px] leading-relaxed text-brand-muted">{sub}</p>
  </div>
);

export const Steps = ({ step }: { step: 1 | 2 | 3 }) => {
  const dot = (n: 1 | 2 | 3) =>
    n < step
      ? "bg-success text-white"
      : n === step
        ? "bg-navy text-white ring-4 ring-navy/15"
        : "bg-surface text-brand-muted";
  const line = (after: 1 | 2) => (after < step ? "bg-success" : "bg-surface");
  return (
    <div className="flex items-center mb-7">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center">
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition",
              dot(n as 1 | 2 | 3),
            )}
          >
            {n < step ? "✓" : n}
          </div>
          {n < 3 && <div className={cn("h-0.5 w-10 transition", line(n as 1 | 2))} />}
        </div>
      ))}
    </div>
  );
};
