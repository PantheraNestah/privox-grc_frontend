import { type ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import {
  ASSESSMENT_STATUS_COLORS,
  RAG_COLORS,
  RAG_LABELS,
  type AssessmentStatus,
  type RagStatus,
} from "@/data/assessmentStore";
import { cn } from "@/lib/utils";

/** Outline badge tinted from a domain HSL triplet ("158 53% 49%"). */
export function TintedBadge({
  color,
  className,
  style,
  ...props
}: { color: string } & ComponentProps<typeof Badge>) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 text-[11px] font-medium", className)}
      style={{
        background: `hsl(${color} / 0.12)`,
        borderColor: `hsl(${color} / 0.4)`,
        color: `hsl(${color})`,
        ...style,
      }}
      {...props}
    />
  );
}

export function RagBadge({ rag, children, ...props }: { rag: RagStatus } & Omit<ComponentProps<typeof Badge>, "color">) {
  return (
    <TintedBadge color={RAG_COLORS[rag]} {...props}>
      {children ?? RAG_LABELS[rag]}
    </TintedBadge>
  );
}

export function StatusBadge({
  status,
  children,
  ...props
}: { status: AssessmentStatus } & Omit<ComponentProps<typeof Badge>, "color">) {
  return (
    <TintedBadge color={ASSESSMENT_STATUS_COLORS[status]} {...props}>
      {children}
    </TintedBadge>
  );
}

export function RagDot({ rag, className }: { rag: RagStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 rounded-full", className)}
      style={{ background: `hsl(${RAG_COLORS[rag]})` }}
    />
  );
}

/** Horizontal meter; a tiny stand-in for a Progress primitive. */
export function MeterBar({
  value,
  color,
  label,
  className,
}: {
  value: number;
  color: string;
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `hsl(${color})` }} />
    </div>
  );
}
