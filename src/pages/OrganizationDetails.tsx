import { useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { BadgeCheck, Building2, Calendar, Clock, Hash, Loader2, MapPin, Network, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { OrgAvatar } from "@/components/grc/common/OrgAvatar";
import { PageHeader } from "@/components/grc/common/PageHeader";
import { TENANT_HOME } from "@/components/grc/common/home-links";
import { ErrorState } from "@/components/grc/common/states";
import { OrgTreeGraph } from "@/components/grc/OrgTreeGraph";
import { flatOrgNodesToView } from "@/components/grc/org-tree-view";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization, useUpdateOrganization } from "@/hooks/use-organization";
import { useOrgNodes } from "@/hooks/use-org-nodes";
import type { OrganizationDetailDto, UpdateOrganizationRequest } from "@/lib/auth-types";

const fallbackText = "Unknown";

function formatValue(value: unknown) {
  if (value == null || value === "") return fallbackText;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(date.getTime())) {
      return date.toLocaleString();
    }
    return value;
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallbackText;
  return JSON.stringify(value);
}

function statusLabel(org: OrganizationDetailDto) {
  if (typeof org.active === "boolean") return org.active ? "Active" : "Inactive";
  return org.status?.trim() || fallbackText;
}

function Field({ icon, label, value }: { icon: ReactNode; label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-border bg-offwhite/60 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 break-words text-sm font-medium text-navy-deep">{formatValue(value)}</p>
    </div>
  );
}

const OrganizationDetails = () => {
  const { organization: authOrganization, permissions } = useAuth();
  const orgId = authOrganization?.id;
  const canManage = permissions.includes("organization.manage");
  const organizationQuery = useOrganization(orgId);
  const updateOrganization = useUpdateOrganization(orgId ?? "");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", planTier: "", countryCode: "" });
  // Best-effort org map — hidden when the tree endpoint is unavailable
  // (e.g. the GOVERNANCE module is disabled or not allocated to this user).
  const orgNodes = useOrgNodes(orgId);

  const openEdit = () => {
    setForm({
      name: String(organization?.name ?? ""),
      slug: String(organization?.slug ?? ""),
      planTier: String(organization?.planTier ?? ""),
      countryCode: String(organization?.countryCode ?? ""),
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!orgId) return;
    const body: UpdateOrganizationRequest = {};
    if (form.name.trim()) body.name = form.name.trim();
    if (form.slug.trim()) body.slug = form.slug.trim();
    if (form.planTier.trim()) body.planTier = form.planTier.trim();
    if (form.countryCode.trim()) body.countryCode = form.countryCode.trim();
    try {
      await updateOrganization.mutateAsync(body);
      toast.success("Organization profile updated.");
      setEditOpen(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } } | null)?.response?.status;
      toast.error(status === 409 ? "That slug is already taken. Choose another." : "Failed to update the organization profile.");
    }
  };

  const organization: OrganizationDetailDto | null = organizationQuery.data
    ? { ...authOrganization, ...organizationQuery.data }
    : null;
  const pageTitle = organization?.name ?? authOrganization?.name ?? "Organization details";
  const nodes = orgNodes.data ?? [];

  const loadError = !orgId
    ? "No active organization was found for this session."
    : organizationQuery.isError
      ? organizationQuery.error instanceof Error
        ? organizationQuery.error.message
        : "Failed to load organization details"
      : null;

  return (
    <>
      <Helmet>
        <title>{pageTitle} - Rsolve GRC Platform</title>
        <meta name="description" content="View organization details from the backend organization endpoint." />
        <link rel="canonical" href="/settings/organization" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Organization details" }]}
        leading={<OrgAvatar name={pageTitle} className="h-14 w-14 rounded-2xl text-lg" />}
        eyebrow={
          organization && (
            <Badge variant="secondary" className="text-[11px]">
              {statusLabel(organization)}
            </Badge>
          )
        }
        title={pageTitle}
        description="Review and update your organization's registration details."
        actions={
          canManage &&
          organization && (
            <Button variant="outline" onClick={openEdit}>
              <Pencil /> Edit profile
            </Button>
          )
        }
      />

      {loadError ? (
        <ErrorState title="Couldn't load organization" message={loadError} />
      ) : organizationQuery.isLoading ? (
        <div className="space-y-6" role="status">
          <span className="sr-only">Loading organization details…</span>
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        organization && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base text-navy-deep">Profile</CardTitle>
                <CardDescription className="text-xs">Registration details for your organization.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Name" value={organization.name} />
                  <Field icon={<Hash className="h-3.5 w-3.5" />} label="Code" value={organization.code} />
                  <Field icon={<BadgeCheck className="h-3.5 w-3.5" />} label="Status" value={statusLabel(organization)} />
                  <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Country code" value={organization.countryCode} />
                  <Field icon={<Calendar className="h-3.5 w-3.5" />} label="Created" value={organization.createdAt} />
                  <Field icon={<Clock className="h-3.5 w-3.5" />} label="Updated" value={organization.updatedAt} />
                </div>
              </CardContent>
            </Card>

            {nodes.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base text-navy-deep">
                    <Network className="h-4 w-4 text-brand-accent" />
                    Organization map
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {nodes.length} node{nodes.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <OrgTreeGraph
                    roots={flatOrgNodesToView(nodes)}
                    className="h-[420px] border-t border-border"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit organization profile</DialogTitle>
            <DialogDescription>
              Update the registration details for {pageTitle}. Code and status are immutable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="org-slug">Slug</Label>
                <Input
                  id="org-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-plan">Plan tier</Label>
                <Input
                  id="org-plan"
                  value={form.planTier}
                  onChange={(e) => setForm((f) => ({ ...f, planTier: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-country">Country code</Label>
              <Input
                id="org-country"
                value={form.countryCode}
                maxLength={2}
                onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value.toUpperCase() }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={updateOrganization.isPending || !form.name.trim()}
              onClick={() => void submitEdit()}
            >
              {updateOrganization.isPending && <Loader2 className="animate-spin" />} Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OrganizationDetails;
