import { type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, Clock, Layers, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformStatusBadge } from "@/components/grc/platform/PlatformStatusBadge";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";
import { usePlatformOrganizations } from "@/hooks/use-platform-organizations";
import { usePlatformModules } from "@/hooks/use-platform-modules";
import { formatDateTime } from "@/lib/format";

const StatCard = ({
  icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint: string;
  loading?: boolean;
}) => (
  <Card className="p-5">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
      {loading ? "…" : value}
    </p>
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
  </Card>
);

const PlatformDashboard = () => {
  const { user, permissions } = usePlatformAuth();
  const organizations = usePlatformOrganizations();
  const modules = usePlatformModules();

  const firstName = user?.fullName?.split(" ")[0] ?? "Admin";
  const orgs = organizations.data ?? [];

  const pendingCount = orgs.filter((o) => o.status === "PENDING_VALIDATION").length;
  const activeCount = orgs.filter((o) => o.status === "ACTIVE").length;

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

      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Platform Admin</span>
        <span>/</span>
        <span>Overview</span>
      </nav>

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-[11px]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Platform Admin
          </Badge>
          <Badge variant="secondary" className="text-[11px]">
            {permissions.length} permission{permissions.length === 1 ? "" : "s"}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Welcome, {firstName}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Operator console for onboarding organisations, validating tenants and assigning platform modules.
        </p>
      </header>

      {(organizations.isError || modules.isError) && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            Unable to load platform data. Check the API connection and try again.
          </p>
        </Card>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Organizations"
          value={orgs.length}
          hint="Total tenants on the platform."
          loading={organizations.isLoading}
        />
        <StatCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Pending validation"
          value={pendingCount}
          hint="Awaiting approval to onboard."
          loading={organizations.isLoading}
        />
        <StatCard
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          label="Active"
          value={activeCount}
          hint="Onboarded and active tenants."
          loading={organizations.isLoading}
        />
        <StatCard
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Modules"
          value={(modules.data ?? []).length}
          hint="Catalogue modules available to assign."
          loading={modules.isLoading}
        />
      </section>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-navy-deep">Recent organizations</h2>
          <Link
            to="/platform/organizations"
            className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            View all
          </Link>
        </div>

        {organizations.isLoading && (
          <p className="px-5 py-6 text-sm text-muted-foreground">Loading organizations…</p>
        )}
        {!organizations.isLoading && recent.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted-foreground">No organizations yet.</p>
        )}
        {recent.length > 0 && (
          <ul className="divide-y divide-border">
            {recent.map((org) => (
              <li key={org.id}>
                <Link
                  to={`/platform/organizations/${org.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{org.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {org.code} · {formatDateTime(org.createdAt)}
                    </div>
                  </div>
                  <PlatformStatusBadge status={org.status} />
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
};

export default PlatformDashboard;
