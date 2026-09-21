import { type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Building2, ChevronRight, Clock, Layers, Network, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OrgAvatar } from "@/components/grc/common/OrgAvatar";
import { PageHeader } from "@/components/grc/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/grc/common/states";
import { PlatformStatusBadge } from "@/components/grc/platform/PlatformStatusBadge";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";
import { usePlatformOrganizations } from "@/hooks/use-platform-organizations";
import { usePlatformModules } from "@/hooks/use-platform-modules";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const StatCard = ({
  icon,
  label,
  value,
  hint,
  loading,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
  loading?: boolean;
  tone: string;
}) => (
  <Card className="p-4 transition-shadow hover:shadow-card-hover sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tone)}>{icon}</span>
    </div>
    {loading ? (
      <Skeleton className="mt-3 h-9 w-16" />
    ) : (
      <p className="mt-3 text-3xl font-semibold tracking-tight text-navy-deep">{value}</p>
    )}
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
  </Card>
);

const QUICK_LINKS = [
  { to: "/platform/organizations", label: "Manage organizations", hint: "Onboard and validate tenants", icon: Building2 },
  { to: "/platform/modules", label: "Module catalogue", hint: "See what can be assigned", icon: Layers },
  { to: "/platform/templates", label: "Org templates", hint: "Reusable starter trees", icon: Network },
];

const PlatformDashboard = () => {
  const { user, permissions } = usePlatformAuth();
  const organizations = usePlatformOrganizations();
  const modules = usePlatformModules();

  const firstName = user?.fullName?.split(" ")[0] ?? "Admin";
  const orgs = organizations.data ?? [];

  const count = (status: string) => orgs.filter((o) => o.status === status).length;
  const pendingCount = count("PENDING_VALIDATION");
  const activeCount = count("ACTIVE");
  const suspendedCount = count("SUSPENDED");
  const otherCount = orgs.length - pendingCount - activeCount - suspendedCount;

  const distribution = [
    { label: "Active", value: activeCount, bar: "bg-success" },
    { label: "Pending validation", value: pendingCount, bar: "bg-warn" },
    { label: "Suspended", value: suspendedCount, bar: "bg-destructive" },
    { label: "Other", value: otherCount, bar: "bg-muted-foreground/40" },
  ];

  const recent = orgs
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <>
      <Helmet>
        <title>Platform Overview · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Platform administration overview — organisation onboarding, approvals and module assignment."
        />
        <link rel="canonical" href="/platform/dashboard" />
      </Helmet>

      <PageHeader
        crumbs={[{ label: "Overview" }]}
        eyebrow={
          <>
            <Badge variant="outline" className="gap-1.5 text-[11px]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Platform Admin
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              {permissions.length} permission{permissions.length === 1 ? "" : "s"}
            </Badge>
          </>
        }
        title={`Welcome, ${firstName}`}
        description="Operator console for onboarding organisations, validating tenants and assigning platform modules."
        actions={
          pendingCount > 0 && (
            <Button asChild variant="brand">
              <Link to="/platform/organizations">
                <Clock /> Review {pendingCount} pending
              </Link>
            </Button>
          )
        }
      />

      {(organizations.isError || modules.isError) && (
        <div className="mb-6">
          <ErrorState
            title="Unable to load platform data"
            message="Check the API connection and try again."
          />
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          icon={<Building2 className="h-4 w-4 text-brand-accent" />}
          tone="bg-brand-accent/10"
          label="Organizations"
          value={orgs.length}
          hint="Tenants on the platform"
          loading={organizations.isLoading}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-warn" />}
          tone="bg-warn/15"
          label="Pending"
          value={pendingCount}
          hint="Awaiting approval"
          loading={organizations.isLoading}
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4 text-success" />}
          tone="bg-success/12"
          label="Active"
          value={activeCount}
          hint="Onboarded tenants"
          loading={organizations.isLoading}
        />
        <StatCard
          icon={<Layers className="h-4 w-4 text-royal" />}
          tone="bg-royal/10"
          label="Modules"
          value={(modules.data ?? []).length}
          hint="Available to assign"
          loading={modules.isLoading}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border px-5 py-4">
            <div>
              <CardTitle className="text-base text-navy-deep">Recent organizations</CardTitle>
              <CardDescription className="mt-1 text-xs">Newest tenants on the platform.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-brand-accent hover:text-navy">
              <Link to="/platform/organizations">View all</Link>
            </Button>
          </CardHeader>

          {organizations.isLoading && (
            <div className="divide-y divide-border" role="status">
              <span className="sr-only">Loading organizations…</span>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          )}
          {!organizations.isLoading && recent.length === 0 && (
            <CardContent className="p-5">
              <EmptyState icon={Building2} title="No organizations yet" description="New tenants will show up here." />
            </CardContent>
          )}
          {recent.length > 0 && (
            <ul className="divide-y divide-border">
              {recent.map((org) => (
                <li key={org.id}>
                  <Link
                    to={`/platform/organizations/${org.id}`}
                    className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface/60"
                  >
                    <OrgAvatar name={org.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-navy-deep">{org.name}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {org.code} · {formatDateTime(org.createdAt)}
                      </div>
                    </div>
                    <PlatformStatusBadge status={org.status} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base text-navy-deep">Tenant status</CardTitle>
              <CardDescription className="text-xs">Where every organization sits today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label="Organization status distribution"
              >
                {orgs.length > 0 &&
                  distribution
                    .filter((d) => d.value > 0)
                    .map((d) => (
                      <span
                        key={d.label}
                        className={cn("h-full", d.bar)}
                        style={{ width: `${(d.value / orgs.length) * 100}%` }}
                      />
                    ))}
              </div>
              <ul className="space-y-2.5">
                {distribution.map((d) => (
                  <li key={d.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-navy-dark">
                      <span className={cn("h-2 w-2 rounded-full", d.bar)} aria-hidden />
                      {d.label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {organizations.isLoading ? "…" : d.value}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-navy-deep">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-3 pt-0">
              {QUICK_LINKS.map(({ to, label, hint, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface/70"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-navy-deep">{label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default PlatformDashboard;
