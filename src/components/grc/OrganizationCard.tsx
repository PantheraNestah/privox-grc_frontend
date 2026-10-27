import { Building2, Check, Clock, Loader2, Star } from "lucide-react";
import {
  formatLastUsed,
  toGroupLabels,
  toModuleLabels,
} from "@/lib/organization-options";
import type { OrganizationOptionDto } from "@/lib/auth-types";
import { cn } from "@/lib/utils";

interface OrganizationCardProps {
  organization: OrganizationOptionDto;
  /** The organization this session is currently bound to. */
  current?: boolean;
  /** Most recently used card (gets the focus ring/attention border). */
  highlight?: boolean;
  /** Request for this card is in flight. */
  loading?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  /** Compact rows are used inside the header switcher. */
  compact?: boolean;
  /** Rendered in tests / on the picker to keep relative time deterministic. */
  now?: number;
}

/**
 * A single organization "widget". A real `<button>` so Enter/Space select it
 * and focus stays visible; shared by the post-login picker and the in-app
 * switcher.
 */
export function OrganizationCard({
  organization,
  current = false,
  highlight = false,
  loading = false,
  disabled = false,
  onSelect,
  compact = false,
  now,
}: OrganizationCardProps) {
  const groups = toGroupLabels(organization.groups);
  const modules = toModuleLabels(organization.modules);
  const lastUsed = formatLastUsed(organization.lastUsedAt, now);
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-current={current ? "true" : undefined}
      className={cn(
        "group relative w-full rounded-xl border bg-white text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-70",
        compact ? "px-3 py-2.5" : "p-5",
        current
          ? "border-brand-accent/60 bg-brand-accent/[0.04] shadow-card"
          : "border-border hover:-translate-y-0.5 hover:border-brand-accent/40 hover:shadow-card-hover",
        highlight && !current && "border-brand-accent/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-navy-deep/[0.06] text-navy",
            compact ? "h-8 w-8" : "h-10 w-10",
          )}
        >
          <Building2 className={compact ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate font-semibold text-navy-deep",
                  compact ? "text-[13px]" : "text-[15px]",
                )}
              >
                {organization.name}
              </p>
              <p className="mt-0.5 truncate text-[11px] uppercase tracking-wide text-brand-muted">
                {organization.code}
              </p>
            </div>

            <span className="flex shrink-0 items-center gap-1.5">
              {organization.primary && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-1.5 py-0 text-[10px] font-medium text-secondary-foreground">
                  <Star className="h-3 w-3" aria-hidden /> Primary
                </span>
              )}
              {current && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-0 text-[10px] font-medium text-success">
                  <Check className="h-3 w-3" aria-hidden /> Current
                </span>
              )}
            </span>
          </div>

          {!compact && lastUsed && (
            <p className="mt-2 flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <Clock className="h-3 w-3" aria-hidden /> {lastUsed}
            </p>
          )}

          {(groups.length > 0 || modules.length > 0) && (
            <div className={cn("flex flex-wrap gap-1.5", compact ? "mt-1.5" : "mt-3")}>
              {groups.slice(0, compact ? 1 : 3).map((label) => (
                <span
                  key={`group-${label}`}
                  className="inline-flex max-w-full truncate rounded-full border border-brand-accent/25 bg-brand-accent/[0.06] px-1.5 py-0 text-[10.5px] font-medium text-navy"
                >
                  {label}
                </span>
              ))}
              {modules
                .slice(0, compact ? (groups.length > 0 ? 0 : 1) : 3)
                .map((label) => (
                  <span
                    key={`module-${label}`}
                    className="inline-flex max-w-full truncate rounded-full bg-secondary px-1.5 py-0 text-[10.5px] font-normal text-secondary-foreground"
                  >
                    {label}
                  </span>
                ))}
              {!compact && groups.length + modules.length > 6 && (
                <span className="text-[10.5px] text-muted-foreground">
                  +{groups.length + modules.length - 6} more
                </span>
              )}
            </div>
          )}
        </div>

        {loading && (
          <Loader2
            className="mt-1 h-4 w-4 shrink-0 animate-spin text-brand-accent"
            aria-label={`Opening ${organization.name}`}
          />
        )}
      </div>
    </button>
  );
}
