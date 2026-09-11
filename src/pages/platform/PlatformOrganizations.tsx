import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlatformStatusBadge } from "@/components/grc/platform/PlatformStatusBadge";
import { CreateOrganizationDialog } from "@/components/grc/platform/CreateOrganizationDialog";
import { usePlatformOrganizations } from "@/hooks/use-platform-organizations";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";
import { canPlatform, PLATFORM_PERMISSIONS } from "@/lib/platformPermissions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrganizationStatus } from "@/lib/platformAdmin";

const STATUS_FILTERS: { value: OrganizationStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING_VALIDATION", label: "Pending validation" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DEACTIVATED", label: "Deactivated" },
];

const PlatformOrganizations = () => {
  const [statusFilter, setStatusFilter] = useState<OrganizationStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { permissions } = usePlatformAuth();
  const canCreate = canPlatform(permissions, PLATFORM_PERMISSIONS.organizationCreate);

  const { data, isLoading, isError, error } = usePlatformOrganizations(
    statusFilter === "ALL" ? undefined : statusFilter,
  );

  const organizations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((org) =>
      [org.name, org.code, org.slug].some((field) => field?.toLowerCase().includes(term)),
    );
  }, [data, search]);

  return (
    <>
      <Helmet>
        <title>Organizations · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Platform organizations — onboard, validate and monitor tenant status."
        />
        <link rel="canonical" href="/platform/organizations" />
      </Helmet>

      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Platform Admin</span>
        <span>/</span>
        <span>Organizations</span>
      </nav>

      <header className="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Organizations</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every tenant on the platform and its onboarding status.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {canCreate && (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="bg-navy-deep text-white hover:bg-navy"
            >
              <Plus className="h-4 w-4" /> New organization
            </Button>
          )}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code or slug…"
              className="pl-9"
              aria-label="Search organizations"
            />
          </div>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-blue-600 bg-blue-100 text-blue-600"
                  : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="py-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading organizations…</p>
        </div>
      )}

      {isError && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load organizations."}
          </p>
        </Card>
      )}

      {!isLoading && !isError && organizations.length === 0 && (
        <Card className="p-8 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No organizations match the current filters.
          </p>
        </Card>
      )}

      {!isLoading && !isError && organizations.length > 0 && (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link to={`/platform/organizations/${org.id}`} className="hover:text-blue-600 transition-colors">
                      {org.name}
                    </Link>
                    <span className="block font-mono text-[11px] text-muted-foreground">{org.slug}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{org.code}</TableCell>
                  <TableCell className="text-sm">{org.planTier ?? "—"}</TableCell>
                  <TableCell className="text-sm">{org.countryCode ?? "—"}</TableCell>
                  <TableCell>
                    <PlatformStatusBadge status={org.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(org.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/platform/organizations/${org.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`View ${org.name}`}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
};

export default PlatformOrganizations;
