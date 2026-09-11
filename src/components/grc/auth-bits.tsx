/**
 * Shared authentication UI primitives.
 *
 * Extracted from the tenant `AuthScreen` so the platform-admin login can reuse
 * the exact same brand panel, form controls, buttons and alerts.
 */

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
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

const DEFAULT_PANEL_TAGS = [
  "Governance",
  "Risk Management",
  "Compliance",
  "Data Protection",
  "Resilience",
  "Cyber Risk",
];

interface AuthShellProps {
  children: ReactNode;
  /** When false, plays the slide-in animation (matches AuthScreen's view transitions). */
  animating?: boolean;
  /** Key on the form container so each view re-animates. */
  formKey?: string;
  panelTitle?: ReactNode;
  panelSubtitle?: string;
  panelTags?: string[];
}

export function AuthShell({
  children,
  animating,
  formKey,
  panelTitle = DEFAULT_PANEL_TITLE,
  panelSubtitle = DEFAULT_PANEL_SUBTITLE,
  panelTags = DEFAULT_PANEL_TAGS,
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-offwhite">
      {/* Left brand panel */}
      <aside className="relative hidden md:flex md:w-[44%] flex-col justify-between overflow-hidden bg-navy-deep p-14 text-white shrink-0">
        <div className="absolute inset-0 auth-radial" />
        <div className="absolute inset-0 dot-grid" />
        <div className="absolute -top-32 -right-36 w-[420px] h-[420px] rounded-full border border-accent/20" />
        <div className="absolute top-10 -right-16 w-60 h-60 rounded-full border border-accent/30" />
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full border border-accent/20" />
        <div className="absolute bottom-16 left-10 w-40 h-40 rounded-full border border-accent/30" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-12">
            <Logo />
            <BrandName className="text-2xl font-semibold tracking-tight" />
          </div>
          <h1 className="text-4xl font-light leading-tight tracking-tight mb-4">{panelTitle}</h1>
          <p className="text-sm leading-relaxed text-brand-muted max-w-xs">{panelSubtitle}</p>
        </div>

        <div className="relative z-10">
          <div className="flex flex-wrap gap-2 mb-7">
            {panelTags.map((c) => (
              <span
                key={c}
                className="font-mono text-[10.5px] font-medium tracking-wider px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30 text-sky"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-brand-muted/40">© 2026 Rsolve. All rights reserved.</p>
        </div>
      </aside>

      {/* Right form panel */}
      <main className="relative flex-1 flex items-center justify-center bg-white px-6 py-12 md:px-10 md:py-12">
        <div className="absolute inset-x-0 top-0 h-1 top-stripe" />
        <div className={cn("w-full max-w-md", !animating && "animate-slide-in")} key={formKey}>
          {children}
        </div>
      </main>
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
  tag: string;
  title: string;
  sub: string;
  center?: boolean;
}) => (
  <div className={cn("mb-7", center && "text-center")}>
    <p className="font-mono text-[10.5px] tracking-[0.15em] uppercase text-brand-accent mb-2">{tag}</p>
    <h2 className="text-[27px] font-semibold tracking-tight text-navy-deep mb-1.5">{title}</h2>
    <p className="text-[13.5px] leading-relaxed text-brand-muted">{sub}</p>
  </div>
);

export const FieldLabel = ({ children }: { children: ReactNode }) => (
  <label className="block text-[12.5px] font-medium text-navy-dark mb-1.5">{children}</label>
);

export const inputCx = (err?: boolean) =>
  cn(
    "w-full rounded-[10px] border-[1.5px] bg-offwhite py-3 pl-10 pr-3 text-[14.5px] text-navy-deep outline-none transition",
    "focus:border-brand-accent focus:bg-white focus:ring-[3px] focus:ring-brand-accent/15",
    err ? "border-destructive ring-[3px] ring-destructive/15" : "border-border",
  );

export const PrimaryBtn = ({
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
  <button
    {...rest}
    disabled={loading || rest.disabled}
    className={cn(
      "w-full rounded-[10px] py-3 text-[15px] font-semibold text-white shadow-button transition",
      "bg-gradient-primary hover:opacity-90 hover:-translate-y-px hover:shadow-card-hover active:translate-y-0",
      "disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none",
      rest.className,
    )}
  >
    {loading ? (
      <span className="inline-block w-[18px] h-[18px] border-2 border-white/40 border-t-white rounded-full animate-spin align-middle" />
    ) : (
      children
    )}
  </button>
);

export const ErrAlert = ({ msg, show }: { msg: string; show: boolean }) =>
  show ? (
    <div className="flex items-center gap-2 mb-4 px-3.5 py-2.5 rounded-lg bg-destructive/8 border border-destructive/25 text-[13px] text-destructive">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>{msg}</span>
    </div>
  ) : null;

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
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-semibold transition",
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
