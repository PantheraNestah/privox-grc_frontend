import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Calendar, Eye, Network, Plus, LayoutList, Workflow } from "lucide-react";
import { OrgTreeGraph, templatePreviewToView } from "@/components/grc/OrgTreeGraph";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RegisterTemplateDialog } from "@/components/grc/platform/RegisterTemplateDialog";
import { usePlatformTemplates, usePlatformTemplatePreview } from "@/hooks/use-platform-templates";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";
import { canPlatform, PLATFORM_PERMISSIONS } from "@/lib/platformPermissions";
import { formatDateTime } from "@/lib/format";
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

/** "Hierarchy" mode: shared horizontal tree visualiser with collapsible levels,
 * type accents and metadata chips (headcount / location / cost centre). */
function PreviewHierarchyView({ root }: { root: OrgNodeTemplatePreviewNode }) {
  const viewRoot = templatePreviewToView(root);
  return (
    <OrgTreeGraph
      roots={[viewRoot]}
      className="h-[55vh] rounded-md border border-border"
    />
  );
}

const PlatformTemplates = () => {
  const { data, isLoading, isError, error } = usePlatformTemplates();
  const { permissions } = usePlatformAuth();
  const canManage = canPlatform(permissions, PLATFORM_PERMISSIONS.orgNodeManage);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);
  const [previewMode, setPreviewMode] = useState<"tree" | "hierarchy">("tree");
  const previewQuery = usePlatformTemplatePreview(preview?.id);

  const templates = data ?? [];

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

      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Platform Admin</span>
        <span>/</span>
        <span>Templates</span>
      </nav>

      <header className="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Organization templates</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Reusable starter trees that organizations clone into their own tenant.
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => setRegisterOpen(true)}
            className="bg-navy-deep text-white hover:bg-navy"
          >
            <Plus className="h-4 w-4" /> Register template
          </Button>
        )}
      </header>

      {isLoading && (
        <div className="py-12 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading templates…</p>
        </div>
      )}

      {isError && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load templates."}
          </p>
        </Card>
      )}

      {!isLoading && !isError && templates.length === 0 && (
        <Card className="p-8 text-center">
          <Network className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No templates have been registered yet.</p>
        </Card>
      )}

      {!isLoading && !isError && templates.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="flex flex-col p-5">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Network className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[14.5px] font-semibold tracking-tight text-navy-deep">{template.name}</h2>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {template.description ?? "No description"}
                  </p>
                </div>
              </div>

              <div className="mt-auto space-y-3 border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateTime(template.createdAt)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setPreview({ id: template.id, name: template.name })}
                >
                  <Eye className="h-4 w-4" /> Preview tree
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <RegisterTemplateDialog open={registerOpen} onOpenChange={setRegisterOpen} />

      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null);
            setPreviewMode("tree");
          }
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>{preview?.name ?? "Template preview"}</DialogTitle>
                <DialogDescription>
                  Full nested tree that will be deep-copied into an organization's workspace.
                </DialogDescription>
              </div>
              <div className="flex shrink-0 overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setPreviewMode("tree")}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors ${
                    previewMode === "tree"
                      ? "bg-navy-deep text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <LayoutList className="h-3 w-3" /> Tree
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("hierarchy")}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors ${
                    previewMode === "hierarchy"
                      ? "bg-navy-deep text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Workflow className="h-3 w-3" /> Hierarchy
                </button>
              </div>
            </div>
          </DialogHeader>

          {previewQuery.isLoading && (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading preview…</p>
          )}
          {previewQuery.isError && (
            <p className="py-6 text-center text-sm text-destructive">
              {previewQuery.error instanceof Error
                ? previewQuery.error.message
                : "Failed to load preview."}
            </p>
          )}
          {previewQuery.data && previewMode === "tree" && (
            <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border bg-muted/20 p-4">
              <ul>
                <PreviewNode node={previewQuery.data.rootNode} depth={0} isRoot />
              </ul>
            </div>
          )}
          {previewQuery.data && previewMode === "hierarchy" && (
            <div className="rounded-md border border-border">
              <PreviewHierarchyView root={previewQuery.data.rootNode} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PlatformTemplates;
