import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2, ChevronRight, Layers } from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchOrganizationModules,
  toStaticModuleId,
  type OrganizationModuleStatus,
} from "@/lib/organizationModules";
import { MODULES, type ModuleDef } from "@/data/modules";

type LoadState = "loading" | "ready" | "error";

const moduleDef = (row: OrganizationModuleStatus): ModuleDef | null => {
  const staticId = toStaticModuleId(row.code);
  return staticId ? (MODULES.find((m) => m.id === staticId) ?? null) : null;
};

const ModuleSettings = () => {
  const { organization } = useAuth();
  const [modules, setModules] = useState<OrganizationModuleStatus[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization?.id) {
      setState("error");
      setError("No active organization was found for this session.");
      return;
    }

    let cancelled = false;
    setState("loading");
    setError(null);
    fetchOrganizationModules(organization.id)
      .then((rows) => {
        if (!cancelled) {
          setModules(rows);
          setState("ready");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load organization modules");
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [organization]);

  const enabledCount = modules.filter((m) => m.enabled).length;

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

      <div className="flex flex-col min-h-screen">
        <TopNav />
        <main className="flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-9">
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/dashboard" className="transition-colors hover:text-foreground">Dashboard</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">Modules</span>
          </nav>

          <header className="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Organization Modules</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Every module in the platform catalogue as subscribed by your organization, with its
                enabled/disabled flag ({enabledCount} of {modules.length || "…"} enabled).
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
              </Link>
            </Button>
          </header>

          {state === "loading" && (
            <div className="py-10 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Loading modules...</p>
            </div>
          )}

          {state === "error" && (
            <Card className="border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error ?? "Failed to load organization modules"}</p>
            </Card>
          )}

          {state === "ready" && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {modules.map((row) => {
                const def = moduleDef(row);
                return (
                  <Card key={row.id || row.code} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{def?.name ?? row.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {def?.desc ?? row.description ?? "—"}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground mt-1.5">{row.code}</p>
                      {row.enabledAt && !row.disabledAt && row.enabled && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Enabled since {new Date(row.enabledAt).toLocaleDateString()}
                        </p>
                      )}
                      {row.disabledAt && !row.enabled && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Disabled {new Date(row.disabledAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      {row.enabled ? (
                        <Badge variant="outline" className="gap-1 bg-green-100 text-green-700 border-transparent text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Enabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 bg-red-100 text-red-700 border-transparent text-[10px]">
                          <Ban className="w-3 h-3" /> Disabled
                        </Badge>
                      )}
                      <Layers className={`w-4 h-4 ${row.enabled ? "text-green-600" : "text-muted-foreground"}`} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            Enabling and disabling modules is managed by platform administrators (module subscriptions).
          </p>
        </main>
      </div>
    </>
  );
};

export default ModuleSettings;
