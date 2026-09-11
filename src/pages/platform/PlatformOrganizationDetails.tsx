import { type ReactNode, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Globe2,
  Hash,
  Layers,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlatformStatusBadge } from "@/components/grc/platform/PlatformStatusBadge";
import { ApproveOrganizationDialog } from "@/components/grc/platform/ApproveOrganizationDialog";
import {
  usePlatformOrganization,
  useReactivatePlatformOrganization,
  useSuspendPlatformOrganization,
} from "@/hooks/use-platform-organizations";
import {
  usePlatformOrganizationModules,
  useSetPlatformOrganizationModule,
} from "@/hooks/use-platform-modules";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";
import { canPlatform, PLATFORM_PERMISSIONS } from "@/lib/platformPermissions";
import { platformModuleStyle } from "@/data/platformModules";
import { formatDateTime } from "@/lib/format";

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 break-words text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

type ConfirmAction = "suspend" | "reactivate";

const PlatformOrganizationDetails = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const organization = usePlatformOrganization(orgId);
  const modules = usePlatformOrganizationModules(orgId);
  const setModule = useSetPlatformOrganizationModule(orgId ?? "");

  const { permissions } = usePlatformAuth();
  const canApprove = canPlatform(permissions, PLATFORM_PERMISSIONS.organizationApprove);
  const canSuspend = canPlatform(permissions, PLATFORM_PERMISSIONS.organizationSuspend);
  const canReactivate = canPlatform(permissions, PLATFORM_PERMISSIONS.organizationDeactivate);
  const canAssignModules = canPlatform(permissions, PLATFORM_PERMISSIONS.moduleAssign);

  const suspend = useSuspendPlatformOrganization();
  const reactivate = useReactivatePlatformOrganization();

  const [approveOpen, setApproveOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const org = organization.data;
  const moduleRows = modules.data ?? [];
  const status = (org?.status ?? "").toUpperCase();
  const statusActionPending = suspend.isPending || reactivate.isPending;

  const handleConfirm = async () => {
    if (!orgId || !confirmAction) return;
    try {
      if (confirmAction === "suspend") {
        await suspend.mutateAsync(orgId);
        toast.success("Organization suspended");
      } else {
        await reactivate.mutateAsync(orgId);
        toast.success("Organization reactivated");
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${confirmAction === "suspend" ? "suspend" : "reactivate"} organization`,
      );
    } finally {
      setConfirmAction(null);
    }
  };

  const handleModuleToggle = async (moduleId: string, name: string, enabled: boolean) => {
    if (!canAssignModules) return;
    try {
      await setModule.mutateAsync({ moduleId, enabled });
      toast.success(`${name} ${enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to update ${name}`);
    }
  };

  return (
    <>
      <Helmet>
        <title>{org?.name ?? "Organization"} · Rsolve GRC Platform</title>
        <meta name="description" content="Platform organization profile and module assignments." />
        <link rel="canonical" href={`/platform/organizations/${orgId ?? ""}`} />
      </Helmet>

      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/platform/organizations" className="text-blue-600 transition-colors hover:text-blue-700">
          Organizations
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{org?.name ?? "Organization"}</span>
      </nav>

      {organization.isLoading && (
        <div className="py-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading organization…</p>
        </div>
      )}

      {organization.isError && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {organization.error instanceof Error
              ? organization.error.message
              : "Failed to load organization."}
          </p>
        </Card>
      )}

      {org && (
        <>
          <header className="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 text-[11px]">
                  <Building2 className="h-3.5 w-3.5" />
                  Organization
                </Badge>
                <PlatformStatusBadge status={org.status} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{org.name}</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {org.code} · {org.slug}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {status === "PENDING_VALIDATION" && canApprove && (
                <Button
                  size="sm"
                  onClick={() => setApproveOpen(true)}
                  className="bg-navy-deep text-white hover:bg-navy"
                >
                  <BadgeCheck className="h-4 w-4" /> Approve
                </Button>
              )}
              {status === "ACTIVE" && canSuspend && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmAction("suspend")}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Ban className="h-4 w-4" /> Suspend
                </Button>
              )}
              {status === "SUSPENDED" && canReactivate && (
                <Button
                  size="sm"
                  onClick={() => setConfirmAction("reactivate")}
                  className="bg-navy-deep text-white hover:bg-navy"
                >
                  <RefreshCw className="h-4 w-4" /> Reactivate
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <Link to="/platform/organizations">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Link>
              </Button>
            </div>
          </header>

          <div className="space-y-5">
            <Card className="p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <DetailRow icon={<Hash className="h-3.5 w-3.5" />} label="Name" value={org.name} />
                <DetailRow icon={<Hash className="h-3.5 w-3.5" />} label="Code" value={org.code} />
                <DetailRow icon={<Globe2 className="h-3.5 w-3.5" />} label="Slug" value={org.slug} />
                <DetailRow icon={<Layers className="h-3.5 w-3.5" />} label="Plan tier" value={org.planTier ?? "—"} />
                <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Country" value={org.countryCode ?? "—"} />
                <DetailRow icon={<BadgeCheck className="h-3.5 w-3.5" />} label="Status" value={<PlatformStatusBadge status={org.status} />} />
                <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Created" value={formatDateTime(org.createdAt)} />
                <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Updated" value={formatDateTime(org.updatedAt)} />
                <DetailRow
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Deactivated"
                  value={formatDateTime(org.deactivatedAt)}
                />
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-navy-deep">Validation</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <DetailRow
                  icon={<BadgeCheck className="h-3.5 w-3.5" />}
                  label="Validated at"
                  value={formatDateTime(org.validatedAt)}
                />
                <DetailRow
                  icon={<Hash className="h-3.5 w-3.5" />}
                  label="Validated by"
                  value={org.validatedByUserId ? <span className="font-mono text-xs">{org.validatedByUserId}</span> : "—"}
                />
                <div className="rounded-md border border-border bg-muted/20 p-3 md:col-span-2">
                  <div className="text-[11px] uppercase text-muted-foreground">Validation notes</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {org.validationNotes ?? "—"}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-navy-deep">Enabled modules</h2>
                <Link
                  to="/platform/modules"
                  className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
                >
                  View catalogue
                </Link>
              </div>

              {modules.isLoading && (
                <p className="py-4 text-sm text-muted-foreground">Loading module assignments…</p>
              )}
              {modules.isError && (
                <p className="py-4 text-sm text-destructive">
                  {modules.error instanceof Error ? modules.error.message : "Failed to load modules."}
                </p>
              )}
              {!modules.isLoading && !modules.isError && moduleRows.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  No modules are assigned to this organization yet.
                </p>
              )}
              {moduleRows.length > 0 && (
                <ul className="divide-y divide-border">
                  {moduleRows
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((row) => {
                      const { icon: Icon, color } = platformModuleStyle(row.code);
                      const rowPending =
                        setModule.isPending && setModule.variables?.moduleId === row.moduleId;
                      return (
                        <li key={row.id} className="flex items-center gap-3 py-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: `hsl(${color} / 0.12)` }}
                          >
                            <Icon className="h-4 w-4" style={{ color: `hsl(${color})` }} strokeWidth={1.6} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground">{row.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {row.description ?? "No description"}
                            </div>
                          </div>
                          <span
                            className={
                              "text-[11px] font-medium " +
                              (row.enabled ? "text-success" : "text-muted-foreground")
                            }
                          >
                            {row.enabled ? "Enabled" : "Disabled"}
                          </span>
                          <Switch
                            checked={row.enabled}
                            disabled={!canAssignModules || rowPending}
                            onCheckedChange={(checked) => handleModuleToggle(row.moduleId, row.name, checked)}
                            aria-label={`Toggle ${row.name}`}
                          />
                        </li>
                      );
                    })}
                </ul>
              )}
              {!canAssignModules && (
                <p className="mt-3 text-xs text-muted-foreground">
                  You don't have the <span className="font-mono">platform.module.assign</span> permission.
                </p>
              )}
            </Card>
          </div>

          <ApproveOrganizationDialog
            open={approveOpen}
            onOpenChange={setApproveOpen}
            organizationId={org.id}
            organizationName={org.name}
          />

          <AlertDialog
            open={!!confirmAction}
            onOpenChange={(open) => !open && !statusActionPending && setConfirmAction(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirmAction === "suspend" ? "Suspend organization?" : "Reactivate organization?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmAction === "suspend"
                    ? `"${org.name}" will lose access until it is reactivated.`
                    : `"${org.name}" will regain access to the platform.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={statusActionPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    void handleConfirm();
                  }}
                  disabled={statusActionPending}
                  className={
                    confirmAction === "suspend" ? "bg-destructive hover:bg-destructive/90" : ""
                  }
                >
                  {statusActionPending
                    ? "Working…"
                    : confirmAction === "suspend"
                      ? "Suspend"
                      : "Reactivate"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
};

export default PlatformOrganizationDetails;
