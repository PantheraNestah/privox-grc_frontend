import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrganizationStatus } from "@/lib/platformAdmin";

const STYLES: Record<string, { badge: string; dot: string }> = {
  ACTIVE: { badge: "bg-success/12 text-success", dot: "bg-success" },
  PENDING_VALIDATION: { badge: "bg-warn/15 text-warn", dot: "bg-warn" },
  SUSPENDED: { badge: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
  DEACTIVATED: { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  REJECTED: { badge: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
};

const LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PENDING_VALIDATION: "Pending validation",
  SUSPENDED: "Suspended",
  DEACTIVATED: "Deactivated",
  REJECTED: "Rejected",
};

export function PlatformStatusBadge({ status, className }: { status: OrganizationStatus; className?: string }) {
  const key = (status ?? "").toUpperCase();
  const style = STYLES[key] ?? STYLES.DEACTIVATED;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 whitespace-nowrap border-transparent text-[11px] font-medium", style.badge, className)}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {LABELS[key] ?? status}
    </Badge>
  );
}
