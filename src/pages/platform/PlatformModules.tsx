import { Helmet } from "react-helmet-async";
import { Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlatformModules } from "@/hooks/use-platform-modules";
import { platformModuleStyle } from "@/data/platformModules";

const PlatformModules = () => {
  const { data, isLoading, isError, error } = usePlatformModules();
  const modules = data ?? [];

  return (
    <>
      <Helmet>
        <title>Modules · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Platform module catalogue — assign modules to organizations."
        />
        <link rel="canonical" href="/platform/modules" />
      </Helmet>

      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Platform Admin</span>
        <span>/</span>
        <span>Modules</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Modules</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every module available on the platform. Per-organization assignment is managed from an
          organization's detail page.
        </p>
      </header>

      {isLoading && (
        <div className="py-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading module catalogue…</p>
        </div>
      )}

      {isError && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load modules."}
          </p>
        </Card>
      )}

      {!isLoading && !isError && modules.length === 0 && (
        <Card className="p-8 text-center">
          <Layers className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No modules were returned by the platform.</p>
        </Card>
      )}

      {!isLoading && !isError && modules.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((module) => {
              const { icon: Icon, color } = platformModuleStyle(module.code);
              return (
                <Card key={module.id} className="relative overflow-hidden p-5">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ background: `hsl(${color})` }}
                  />
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: `hsl(${color} / 0.1)` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: `hsl(${color})` }} strokeWidth={1.6} />
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        module.active
                          ? "border-transparent bg-success/15 text-success text-[11px]"
                          : "border-transparent bg-muted text-muted-foreground text-[11px]"
                      }
                    >
                      {module.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <h2 className="text-[14.5px] font-semibold tracking-tight text-navy-deep">{module.name}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {module.description ?? "No description"}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="font-mono text-[11px] text-muted-foreground">{module.code}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      #{module.sortOrder}
                    </span>
                  </div>
                </Card>
              );
            })}
        </div>
      )}
    </>
  );
};

export default PlatformModules;
