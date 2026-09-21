import { Helmet } from "react-helmet-async";
import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/grc/common/states";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationModules } from "@/hooks/use-organization-modules";
import { toStaticModuleId, type OrganizationModuleStatus } from "@/lib/organizationModules";
import { MODULES, type ModuleDef } from "@/data/modules";
import { cn } from "@/lib/utils";

const moduleDef = (row: OrganizationModuleStatus): ModuleDef | null => {
  const staticId = toStaticModuleId(row.code);
  return staticId ? (MODULES.find((m) => m.id === staticId) ?? null) : null;
};

const ModuleSettings = () => {
  const { organization } = useAuth();
  const { data, isLoading, isError, error } = useOrganizationModules(organization?.id);
  const modules = data ?? [];
  const enabledCount = modules.filter((m) => m.enabled).length;

  const loadError = !organization?.id
    ? "No active organization was found for this session."
    : isError
      ? error instanceof Error
        ? error.message
        : "Failed to load organization modules"
      : null;

  return (
    <>
      <Helmet>
        <title>Modules - Rsolve GRC Platform</title>
        <meta
          name="description"
          content="All modules subscribed by your organization, including enabled and disabled ones."
        />
        <link rel="canonical" href="/settings/modules" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Modules" }]}
        title="Organization modules"
        description={`Every module in the platform catalogue as subscribed by your organization (${enabledCount} of ${modules.length || "…"} enabled).`}
      />

      {loadError ? (
        <ErrorState title="Couldn't load modules" message={loadError} />
      ) : isLoading ? (
        <ListSkeleton rows={6} label="Loading modules…" />
      ) : modules.length === 0 ? (
        <EmptyState icon={Layers} title="No modules" description="Your organization has no module subscriptions." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {modules.map((row) => {
              const def = moduleDef(row);
              const Icon = def?.icon ?? Layers;
              const color = def?.color ?? "220 15% 55%";
              return (
                <li key={row.id || row.code} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `hsl(${color} / 0.1)` }}
                  >
                    <Icon className="h-[18px] w-[18px]" style={{ color: `hsl(${color})` }} strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy-deep">{def?.name ?? row.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {def?.desc ?? row.description ?? "—"}
                    </p>
                    <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                      {row.code}
                      {row.enabled && row.enabledAt && !row.disabledAt && (
                        <> · Enabled since {new Date(row.enabledAt).toLocaleDateString()}</>
                      )}
                      {!row.enabled && row.disabledAt && (
                        <> · Disabled {new Date(row.disabledAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 gap-1.5 border-transparent text-[11px] font-medium",
                      row.enabled ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn("h-1.5 w-1.5 rounded-full", row.enabled ? "bg-success" : "bg-muted-foreground/60")}
                    />
                    {row.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Enabling and disabling modules is managed by platform administrators (module subscriptions).
      </p>
    </>
  );
};

export default ModuleSettings;
