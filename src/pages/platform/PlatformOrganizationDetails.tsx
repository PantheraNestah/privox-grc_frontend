import { type ReactNode, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Globe2,
  Hash,
  Layers,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { OrgAvatar } from "@/components/grc/common/OrgAvatar";
import { PageHeader } from "@/components/grc/common/PageHeader";
import { PlatformStatusBadge } from "@/components/grc/platform/PlatformStatusBadge";
import { ErrorState } from "@/components/grc/common/states";
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
import { cn } from "@/lib/utils";

function Field({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-offwhite/60 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1.5 break-words text-sm font-medium text-navy-deep">{value}</div>
    </div>
  );
}

function TimelineItem({
  label,
  value,
  detail,
  done,
  last,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  done: boolean;
  last?: boolean;
}) {
  return (
    <li className={cn("relative pl-6", last ? "pb-0" : "pb-5")}>
      {!last && <span aria-hidden className="absolute bottom-0 left-[5px] top-4 w-px bg-border" />}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2",
          done ? "border-brand-accent bg-brand-accent" : "border-border bg-card",
        )}
      />
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-navy-deep">{value}</p>
      {detail && <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>}
    </li>
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
  const enabledCount = moduleRows.filter((row) => row.enabled).length;
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

      {organization.isLoading && (
        <div className="space-y-6" role="status">
          <span className="sr-only">Loading organization…</span>
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      )}

      {organization.isError && (
        <>
          <PageHeader crumbs={[{ label: "Organizations", to: "/platform/organizations" }, { label: "Not found" }]} title="Organization" />
          <ErrorState
            title="Couldn't load organization"
            message={
              organization.error instanceof Error ? organization.error.message : "Failed to load organization."
            }
          />
        </>
      )}

      {org && (
        <>
          <PageHeader
            crumbs={[{ label: "Organizations", to: "/platform/organizations" }, { label: org.name }]}
            leading={<OrgAvatar name={org.name} className="h-14 w-14 rounded-2xl text-lg" />}
            eyebrow={<PlatformStatusBadge status={org.status} />}
            title={org.name}
            description={
              <span className="font-mono text-xs">
                {org.code} · {org.slug}
              </span>
            }
            actions={
              <>
                {status === "PENDING_VALIDATION" && canApprove && (
                  <Button variant="brand" onClick={() => setApproveOpen(true)}>
                    <BadgeCheck /> Approve
                  </Button>
                )}
                {status === "ACTIVE" && canSuspend && (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAction("suspend")}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Ban /> Suspend
                  </Button>
                )}
                {status === "SUSPENDED" && canReactivate && (
                  <Button variant="brand" onClick={() => setConfirmAction("reactivate")}>
                    <RefreshCw /> Reactivate
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link to="/platform/organizations">
                    <ArrowLeft /> Back
                  </Link>
                </Button>
              </>
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base text-navy-deep">Profile</CardTitle>
                  <CardDescription className="text-xs">Registration details for this tenant.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field icon={<Hash className="h-3.5 w-3.5" />} label="Name" value={org.name} />
                    <Field icon={<Hash className="h-3.5 w-3.5" />} label="Code" value={org.code} />
                    <Field icon={<Globe2 className="h-3.5 w-3.5" />} label="Slug" value={org.slug} />
                    <Field icon={<Layers className="h-3.5 w-3.5" />} label="Plan tier" value={org.planTier ?? "—"} />
                    <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Country" value={org.countryCode ?? "—"} />
                    <Field
                      icon={<BadgeCheck className="h-3.5 w-3.5" />}
                      label="Status"
                      value={<PlatformStatusBadge status={org.status} />}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-navy-deep">Modules</CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        Toggle which platform modules {org.name} can use.
                      </CardDescription>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="shrink-0 text-brand-accent hover:text-navy">
                      <Link to="/platform/modules">View catalogue</Link>
                    </Button>
                  </div>
                  {moduleRows.length > 0 && (
                    <div className="pt-3">
                      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {enabledCount} of {moduleRows.length} enabled
                        </span>
                        <span className="font-mono">{Math.round((enabledCount / moduleRows.length) * 100)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-primary transition-all"
                          style={{ width: `${(enabledCount / moduleRows.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {modules.isLoading && (
                    <div className="space-y-3" role="status">
                      <span className="sr-only">Loading module assignments…</span>
                      {Array.from({ length: 4 }, (_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-3.5 w-1/3" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                          <Skeleton className="h-5 w-9 rounded-full" />
                        </div>
                      ))}
                    </div>
                  )}
                  {modules.isError && (
                    <ErrorState
                      title="Couldn't load modules"
                      message={modules.error instanceof Error ? modules.error.message : "Failed to load modules."}
                    />
                  )}
                  {!modules.isLoading && !modules.isError && moduleRows.length === 0 && (
                    <p className="py-2 text-sm text-muted-foreground">
                      No modules are available on the platform catalogue yet.
                    </p>
                  )}
                  {moduleRows.length > 0 && (
                    <ul className="-mx-2 divide-y divide-border">
                      {moduleRows
                        .slice()
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((row) => {
                          const { icon: Icon, color } = platformModuleStyle(row.code);
                          const rowPending =
                            setModule.isPending && setModule.variables?.moduleId === row.moduleId;
                          return (
                            <li key={row.id} className="flex items-center gap-3 px-2 py-3">
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                                style={{ background: `hsl(${color} / 0.12)` }}
                              >
                                <Icon className="h-4 w-4" style={{ color: `hsl(${color})` }} strokeWidth={1.6} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-navy-deep">{row.name}</div>
                                <div className="line-clamp-1 text-xs text-muted-foreground">
                                  {row.description ?? "No description"}
                                </div>
                              </div>
                              <span
                                className={cn(
                                  "hidden text-[11px] font-medium sm:inline",
                                  row.enabled ? "text-success" : "text-muted-foreground",
                                )}
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
                    <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      You don't have the <span className="font-mono">platform.module.assign</span> permission.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base text-navy-deep">Lifecycle</CardTitle>
                  <CardDescription className="text-xs">Key moments for this organization.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ol>
                    <TimelineItem label="Created" value={formatDateTime(org.createdAt)} done />
                    <TimelineItem label="Updated" value={formatDateTime(org.updatedAt)} done />
                    <TimelineItem
                      label="Validated"
                      value={formatDateTime(org.validatedAt, "Not validated yet")}
                      detail={
                        org.validatedByUserId && (
                          <>
                            by <span className="break-all font-mono">{org.validatedByUserId}</span>
                          </>
                        )
                      }
                      done={!!org.validatedAt}
                    />
                    <TimelineItem
                      label="Deactivated"
                      value={formatDateTime(org.deactivatedAt, "Never")}
                      done={!!org.deactivatedAt}
                      last
                    />
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-navy-deep">Validation notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-navy-dark">
                    {org.validationNotes ?? <span className="text-muted-foreground">No notes recorded.</span>}
                  </p>
                </CardContent>
              </Card>
            </div>
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
