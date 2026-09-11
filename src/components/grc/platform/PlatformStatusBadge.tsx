import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrganizationStatus } from "@/lib/platformAdmin";

const STYLES: Record<string, string> = {
  ACTIVE: "border-transparent bg-success/15 text-success",
  PENDING_VALIDATION: "border-transparent bg-warn/15 text-warn",
  SUSPENDED: "border-transparent bg-destructive/15 text-destructive",
  DEACTIVATED: "border-transparent bg-muted text-muted-foreground",
  REJECTED: "border-transparent bg-destructive/15 text-destructive",
};

const LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PENDING_VALIDATION: "Pending validation",
  SUSPENDED: "Suspended",
  DEACTIVATED: "Deactivated",
  REJECTED: "Rejected",
};

export function PlatformStatusBadge({ status }: { status: OrganizationStatus }) {
  const key = (status ?? "").toUpperCase();
  return (
    <Badge variant="outline" className={cn("text-[11px] font-medium", STYLES[key])}>
      {LABELS[key] ?? status}
    </Badge>
  );
}
