import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  FALLBACK_TEXT,
  isInactiveStatus,
  permissionCode,
  permissionKey,
  permissionName,
  permissionScope,
  statusLabel,
  type PermissionDisplay,
} from "./user-management-utils";

/** Id of the signed-in organization; empty string when the session has none. */
export function useOrganizationId() {
  const { organization } = useAuth();
  return organization?.id ?? "";
}

export function StatusBadge({ status, active }: { status?: string; active?: boolean }) {
  const inactive = isInactiveStatus(status, active);
  const pending = status?.toLowerCase() === "pending";
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent text-[11px] font-medium capitalize",
        inactive
          ? "bg-destructive/10 text-destructive"
          : pending
            ? "bg-warn/15 text-warn"
            : "bg-success/12 text-success",
      )}
    >
      {statusLabel(status, active)}
    </Badge>
  );
}

/** Label/value tile used on profile and group detail cards. */
export function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-border bg-offwhite/60 p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 break-words text-sm font-medium text-navy-deep">{value || FALLBACK_TEXT}</p>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-4">
        <div className="space-y-1.5">
          <CardTitle className="text-base text-navy-deep">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function PermissionsList({
  permissions,
  emptyText,
  showCode = true,
}: {
  permissions: PermissionDisplay[];
  emptyText: string;
  showCode?: boolean;
}) {
  if (permissions.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {permissions.map((permission) => (
        <Badge
          key={permissionKey(permission)}
          variant="outline"
          className="max-w-full gap-1.5 px-2.5 py-1 text-[11px] font-normal"
          title={permissionName(permission)}
        >
          <span className="font-medium">{permissionName(permission)}</span>
          {showCode && permissionName(permission) !== permissionCode(permission) && (
            <span className="break-all font-mono text-muted-foreground">{permissionCode(permission)}</span>
          )}
          {permissionScope(permission) && (
            <span className="text-muted-foreground">({permissionScope(permission)})</span>
          )}
        </Badge>
      ))}
    </div>
  );
}

/** Card with a title row and edge-to-edge content, for tables and lists. */
export function TableCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border px-4 py-3.5">
        <CardTitle className="text-base text-navy-deep">{title}</CardTitle>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      {children}
    </Card>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Placeholder for a table-in-card while its query loads. */
export function TableSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div className="divide-y divide-border" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a detail/edit page body. */
export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
