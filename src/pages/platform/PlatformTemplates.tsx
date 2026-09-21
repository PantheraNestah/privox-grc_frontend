import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Calendar, Eye, LayoutList, Network, Plus, Workflow, X } from "lucide-react";
import { OrgTreeGraph, templatePreviewToView } from "@/components/grc/OrgTreeGraph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/grc/common/PageHeader";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/grc/common/states";
import { usePlatformTemplates, usePlatformTemplatePreview } from "@/hooks/use-platform-templates";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";
import { canPlatform, PLATFORM_PERMISSIONS } from "@/lib/platformPermissions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrgNodeTemplatePreviewNode } from "@/lib/governance-types";

function PreviewNode({
  node,
  depth,
  isRoot,
}: {
  node: OrgNodeTemplatePreviewNode;
  depth: number;
  isRoot: boolean;
}) {
  return (
    <li className="relative">
      {!isRoot && (
        <span
          className="pointer-events-none absolute top-4 border-t-2 border-border/70"
          style={{ left: (depth - 1) * 18 + 7, width: 11 }}
        />
      )}
      <div className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 18 }}>
        <Network className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{node.name}</span>
        <Badge variant="outline" className="text-[10px]">
          {node.type}
        </Badge>
        {node.description && (
          <span className="truncate text-xs text-muted-foreground">{node.description}</span>
        )}
      </div>
      {node.children?.length > 0 && (
        <ul className="relative">
          <span
            className="pointer-events-none absolute top-0 border-l-2 border-border/70"
            style={{ left: depth * 18 + 7, bottom: 12 }}
          />
          {node.children.map((child) => (
            <PreviewNode key={child.id} node={child} depth={depth + 1} isRoot={false} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** "Hierarchy" mode: shared horizontal tree visualiser with collapsible levels. */
function PreviewHierarchyView({ root }: { root: OrgNodeTemplatePreviewNode }) {
  const viewRoot = templatePreviewToView(root);
  return (
    <OrgTreeGraph
      roots={[viewRoot]}
      className="h-[60vh] min-h-[380px] rounded-lg border border-border"
    />
  );
}

const PlatformTemplates = () => {
  const { data, isLoading, isError, error } = usePlatformTemplates();
  const { permissions } = usePlatformAuth();
  const canManage = canPlatform(permissions, PLATFORM_PERMISSIONS.orgNodeManage);

  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);
  const [previewMode, setPreviewMode] = useState<"tree" | "hierarchy">("tree");
  const previewQuery = usePlatformTemplatePreview(preview?.id);
  const panelRef = useRef<HTMLDivElement>(null);

  const templates = data ?? [];
  const previewedTemplate = templates.find((t) => t.id === preview?.id);

  // On stacked (phone/tablet) layouts the panel sits below the list; bring it into view.
  useEffect(() => {
    if (preview && window.innerWidth < 1024) {
      panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [preview]);

  const registerButton = (size?: "sm") =>
    canManage && (
      <Button asChild variant="brand" size={size}>
        <Link to="/platform/templates/new">
          <Plus /> Register template
        </Link>
      </Button>
    );

  return (
    <>
      <Helmet>
        <title>Templates · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Reusable organization-tree templates that tenants clone into their own workspace."
        />
        <link rel="canonical" href="/platform/templates" />
      </Helmet>

      <PageHeader
        crumbs={[{ label: "Templates" }]}
        title="Organization templates"
        description="Reusable starter trees that organizations clone into their own tenant."
        actions={registerButton()}
      />

      {isLoading && <CardGridSkeleton count={3} label="Loading templates…" />}

      {isError && (
        <ErrorState
          title="Couldn't load templates"
          message={error instanceof Error ? error.message : "Failed to load templates."}
        />
      )}

      {!isLoading && !isError && templates.length === 0 && (
        <EmptyState
          icon={Network}
          title="No templates yet"
          description="No templates have been registered yet."
          action={registerButton("sm")}
        />
      )}

      {!isLoading && !isError && templates.length > 0 && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <ul className="space-y-3">
            {templates.map((template) => {
              const selected = preview?.id === template.id;
              return (
                <li key={template.id}>
                  <Card
                    className={cn(
                      "flex flex-col p-4 transition-all",
                      selected
                        ? "border-brand-accent/60 shadow-card ring-2 ring-brand-accent/20"
                        : "hover:border-brand-accent/30 hover:shadow-card",
                    )}
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent ring-1 ring-inset ring-brand-accent/20">
                        <Network className="h-[18px] w-[18px]" strokeWidth={1.6} />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold tracking-tight text-navy-deep">
                          {template.name}
                        </h2>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {template.description ?? "No description"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateTime(template.createdAt)}
                      </span>
                      <Button
                        variant={selected ? "secondary" : "outline"}
                        size="sm"
                        aria-pressed={selected}
                        onClick={() => setPreview({ id: template.id, name: template.name })}
                      >
                        <Eye /> Preview tree
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          <div ref={panelRef} className="min-w-0 scroll-mt-20 lg:sticky lg:top-24">
            {!preview ? (
              <Card className="hidden flex-col items-center border-dashed px-6 py-16 text-center shadow-none lg:flex">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
                  <Eye className="h-6 w-6" strokeWidth={1.6} />
                </span>
                <p className="mt-4 text-sm font-semibold text-navy-deep">Select a template</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Choose "Preview tree" on a template to see the structure it will create.
                </p>
              </Card>
            ) : (
              <Card>
                <Tabs value={previewMode} onValueChange={(value) => setPreviewMode(value as "tree" | "hierarchy")}>
                  <CardHeader className="flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <CardTitle className="flex items-center gap-2 text-base text-navy-deep">
                        <Network className="h-4 w-4 shrink-0 text-brand-accent" />
                        <span className="truncate">{preview.name}</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {previewedTemplate?.description ??
                          "Full nested tree that will be deep-copied into an organization's workspace."}
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 self-start">
                      <TabsList>
                        <TabsTrigger value="tree" className="gap-1.5">
                          <LayoutList className="h-3.5 w-3.5" /> Tree
                        </TabsTrigger>
                        <TabsTrigger value="hierarchy" className="gap-1.5">
                          <Workflow className="h-3.5 w-3.5" /> Hierarchy
                        </TabsTrigger>
                      </TabsList>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground"
                        onClick={() => {
                          setPreview(null);
                          setPreviewMode("tree");
                        }}
                        aria-label="Close preview"
                      >
                        <X />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {previewQuery.isLoading && (
                      <div className="space-y-2.5 py-2" role="status">
                        <span className="sr-only">Loading preview…</span>
                        <Skeleton className="h-5 w-2/5" />
                        <Skeleton className="ml-6 h-5 w-1/3" />
                        <Skeleton className="ml-6 h-5 w-1/2" />
                        <Skeleton className="ml-12 h-5 w-2/5" />
                      </div>
                    )}
                    {previewQuery.isError && (
                      <ErrorState
                        title="Couldn't load preview"
                        message={
                          previewQuery.error instanceof Error
                            ? previewQuery.error.message
                            : "Failed to load preview."
                        }
                      />
                    )}
                    {previewQuery.data && (
                      <>
                        <TabsContent value="tree" className="mt-0">
                          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border bg-offwhite/60 p-4">
                            <ul>
                              <PreviewNode node={previewQuery.data.rootNode} depth={0} isRoot />
                            </ul>
                          </div>
                        </TabsContent>
                        <TabsContent value="hierarchy" className="mt-0">
                          <PreviewHierarchyView root={previewQuery.data.rootNode} />
                        </TabsContent>
                      </>
                    )}
                  </CardContent>
                </Tabs>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PlatformTemplates;
