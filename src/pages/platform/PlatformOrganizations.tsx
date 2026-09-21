import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Building2, Calendar, ChevronRight, MapPin, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CreateOrganizationDialog } from "@/components/grc/platform/CreateOrganizationDialog";
import { OrgAvatar } from "@/components/grc/common/OrgAvatar";
import { PageHeader } from "@/components/grc/common/PageHeader";
import { PlatformStatusBadge } from "@/components/grc/platform/PlatformStatusBadge";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/grc/common/states";
import { usePlatformOrganizations, usePrefetchPlatformOrganization } from "@/hooks/use-platform-organizations";
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

// Shared by the header row and every data row so columns line up on desktop.
const DESKTOP_COLUMNS = "lg:grid-cols-[minmax(0,2.6fr)_9.5rem_5rem_7rem_4.5rem_minmax(0,9rem)_1.25rem]";

const PlatformOrganizations = () => {
  const [statusFilter, setStatusFilter] = useState<OrganizationStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { permissions } = usePlatformAuth();
  const canCreate = canPlatform(permissions, PLATFORM_PERMISSIONS.organizationCreate);

  const prefetchOrganization = usePrefetchPlatformOrganization();

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

      <PageHeader
        crumbs={[{ label: "Organizations" }]}
        title="Organizations"
        description="Every tenant on the platform and its onboarding status."
        actions={
          canCreate && (
            <Button variant="brand" onClick={() => setCreateOpen(true)}>
              <Plus /> New organization
            </Button>
          )
        }
      />

      <Card className="mb-4 space-y-3 p-3 sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code or slug…"
            className="pl-9 pr-9"
            aria-label="Search organizations"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {STATUS_FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3.5 text-xs",
                  !active && "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label}
              </Button>
            );
          })}
        </div>
      </Card>

      {isLoading && <ListSkeleton label="Loading organizations…" />}

      {isError && (
        <ErrorState
          title="Couldn't load organizations"
          message={error instanceof Error ? error.message : "Failed to load organizations."}
        />
      )}

      {!isLoading && !isError && organizations.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No organizations found"
          description="No organizations match the current filters."
          action={
            (search || statusFilter !== "ALL") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      )}

      {!isLoading && !isError && organizations.length > 0 && (
        <Card className="overflow-hidden">
          <div
            className={cn(
              "hidden grid-cols-1 items-center gap-x-4 border-b border-border bg-muted/50 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid",
              DESKTOP_COLUMNS,
            )}
          >
            <span>Organization</span>
            <span>Status</span>
            <span>Code</span>
            <span>Plan</span>
            <span>Country</span>
            <span>Created</span>
            <span />
          </div>

          <ul className="divide-y divide-border">
            {organizations.map((org) => (
              <li key={org.id}>
                <Link
                  to={`/platform/organizations/${org.id}`}
                  aria-label={`View ${org.name}`}
                  onMouseEnter={() => void prefetchOrganization(org.id)}
                  onFocus={() => void prefetchOrganization(org.id)}
                  className={cn(
                    "group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-4 py-3.5 transition-colors hover:bg-surface/60 sm:px-5",
                    DESKTOP_COLUMNS,
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <OrgAvatar name={org.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-deep transition-colors group-hover:text-brand-accent">
                        {org.name}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{org.slug}</p>
                    </div>
                  </div>

                  <div className="justify-self-end lg:justify-self-start">
                    <PlatformStatusBadge status={org.status} />
                  </div>

                  <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground lg:contents">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-navy-dark lg:bg-transparent lg:p-0 lg:text-xs">
                      {org.code}
                    </span>
                    <span className="lg:text-sm lg:text-foreground">{org.planTier ?? "—"}</span>
                    <span className="inline-flex items-center gap-1 lg:text-sm lg:text-foreground">
                      <MapPin className="h-3 w-3 lg:hidden" />
                      {org.countryCode ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3 lg:hidden" />
                      {formatDateTime(org.createdAt)}
                    </span>
                  </div>

                  <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 lg:block" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
};

export default PlatformOrganizations;
