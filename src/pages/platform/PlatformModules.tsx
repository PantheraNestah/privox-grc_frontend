import { Helmet } from "react-helmet-async";
import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/grc/common/PageHeader";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/grc/common/states";
import { usePlatformModules } from "@/hooks/use-platform-modules";
import { platformModuleStyle } from "@/data/platformModules";
import { cn } from "@/lib/utils";

const PlatformModules = () => {
  const { data, isLoading, isError, error } = usePlatformModules();
  const modules = data ?? [];
  const activeCount = modules.filter((m) => m.active).length;

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

      <PageHeader
        crumbs={[{ label: "Modules" }]}
        title="Modules"
        description="Every module available on the platform. Per-organization assignment is managed from an organization's detail page."
        eyebrow={
          !isLoading &&
          !isError && (
            <>
              <Badge variant="secondary" className="text-[11px]">
                {modules.length} module{modules.length === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline" className="border-success/30 bg-success/10 text-[11px] text-success">
                {activeCount} live
              </Badge>
            </>
          )
        }
      />

      {isLoading && <CardGridSkeleton label="Loading module catalogue…" />}

      {isError && (
        <ErrorState
          title="Couldn't load modules"
          message={error instanceof Error ? error.message : "Failed to load modules."}
        />
      )}

      {!isLoading && !isError && modules.length === 0 && (
        <EmptyState
          icon={Layers}
          title="No modules yet"
          description="No modules were returned by the platform."
        />
      )}

      {!isLoading && !isError && modules.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((module) => {
              const { icon: Icon, color } = platformModuleStyle(module.code);
              return (
                <Card
                  key={module.id}
                  className={cn(
                    "group relative flex flex-col overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-card-hover",
                    !module.active && "bg-card/70",
                  )}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-inset"
                      style={{ background: `hsl(${color} / 0.1)`, ["--tw-ring-color" as string]: `hsl(${color} / 0.2)` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: `hsl(${color})` }} strokeWidth={1.6} />
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1.5 border-transparent text-[11px]",
                        module.active ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn("h-1.5 w-1.5 rounded-full", module.active ? "bg-success" : "bg-muted-foreground/60")}
                      />
                      {module.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <h2 className="text-[15px] font-semibold tracking-tight text-navy-deep">{module.name}</h2>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {module.description ?? "No description"}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-navy-dark">
                      {module.code}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">#{module.sortOrder}</span>
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
