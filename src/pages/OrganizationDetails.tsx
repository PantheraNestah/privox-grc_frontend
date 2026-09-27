import { type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { BadgeCheck, Building2, Calendar, Clock, Hash, MapPin, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OrgAvatar } from "@/components/grc/common/OrgAvatar";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { ErrorState } from "@/components/grc/common/states";
import { OrgTreeGraph, flatOrgNodesToView } from "@/components/grc/OrgTreeGraph";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/use-organization";
import { useOrgNodes } from "@/hooks/use-org-nodes";
import type { OrganizationDetailDto } from "@/lib/auth-types";

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
  const { organization: authOrganization } = useAuth();
  const orgId = authOrganization?.id;
  const organizationQuery = useOrganization(orgId);
  // Best-effort org map — hidden when the tree endpoint is unavailable
  // (e.g. the GOVERNANCE module is disabled or not allocated to this user).
  const orgNodes = useOrgNodes(orgId);

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
        description="Read-only organization profile. Editing is disabled until the organization update endpoint is provided."
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
    </>
  );
};

export default OrganizationDetails;
