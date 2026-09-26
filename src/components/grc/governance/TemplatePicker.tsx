import { useState } from "react";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { LayoutList, Network, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgTreeGraph, templatePreviewToView } from "@/components/grc/OrgTreeGraph";
import { EmptyState, ErrorState } from "@/components/grc/common/states";
import { useCloneOrgNodeTemplate } from "@/hooks/use-org-nodes";
import { useOrgNodeTemplatePreview, useOrgNodeTemplates } from "@/hooks/use-org-node-templates";
import type { OrgNodeTemplatePreviewNode } from "@/lib/governance-types";
import { cn } from "@/lib/utils";

const ROOT_VALUE = "__root__";

export interface TemplateParentOption {
  id: string;
  label: string;
}

interface TemplatePickerProps {
  orgId: string;
  /** Holds the `organization.manage` authority the clone endpoint requires. */
  canManage: boolean;
  /**
   * Existing units the copy can be attached under. Omit for an empty
   * organisation, where the copy always becomes the root.
   */
  parents?: TemplateParentOption[];
  onCloned?: () => void;
  className?: string;
}

function countNodes(node: OrgNodeTemplatePreviewNode): number {
  return 1 + (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0);
}

function cloneErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    if (err.response?.status === 403) {
      return "You don't have permission to apply templates, or the Governance module isn't enabled for your organisation.";
    }
    const message = err.response?.data?.message;
    if (typeof message === "string" && message) return message;
  }
  return err instanceof Error ? err.message : "Failed to apply the template.";
}

function TemplateTreeNode({ node }: { node: OrgNodeTemplatePreviewNode }) {
  const children = node.children ?? [];
  return (
    <li>
      <div className="flex flex-wrap items-center gap-2 py-1">
        <span className="text-sm font-medium text-foreground">{node.name}</span>
        <Badge variant="outline" className="text-[10px] font-normal">
          {node.type}
        </Badge>
      </div>
      {children.length > 0 && (
        <ul className="ml-2 border-l border-border pl-4">
          {children.map((child) => (
            <TemplateTreeNode key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Browse the platform's org-tree templates, preview one inline (tree or
 * hierarchy) and copy it into the organisation. Templates are cached by React
 * Query, so reopening the picker never refetches inside the stale window.
 */
export function TemplatePicker({ orgId, canManage, parents, onCloned, className }: TemplatePickerProps) {
  const templates = useOrgNodeTemplates();
  const clone = useCloneOrgNodeTemplate(orgId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"tree" | "hierarchy">("tree");
  const [parentId, setParentId] = useState<string>(ROOT_VALUE);
  const [error, setError] = useState<string | null>(null);

  const preview = useOrgNodeTemplatePreview(selectedId ?? undefined);
  const selected = templates.data?.find((t) => t.id === selectedId);

  const select = (id: string) => {
    setSelectedId(id);
    setError(null);
  };

  const apply = async () => {
    if (!selectedId || clone.isPending) return;
    setError(null);
    try {
      await clone.mutateAsync({
        templateId: selectedId,
        targetParentId: parentId === ROOT_VALUE ? null : parentId,
      });
      toast.success(`"${selected?.name ?? "Template"}" added to your organisation`);
      setSelectedId(null);
      setParentId(ROOT_VALUE);
      onCloned?.();
    } catch (err) {
      const message = cloneErrorMessage(err);
      setError(message);
      toast.error(message);
    }
  };

  if (templates.isLoading) {
    return (
      <div className="space-y-2" role="status">
        <span className="sr-only">Loading templates…</span>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (templates.isError) {
    return (
      <ErrorState
        title="Couldn't load templates"
        message={templates.error instanceof Error ? templates.error.message : "Failed to load templates."}
      />
    );
  }

  if (!templates.data || templates.data.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title="No templates available"
        description="The platform team hasn't published any organisation templates yet."
      />
    );
  }

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]", className)}>
      <ul className="space-y-2" aria-label="Available templates">
        {templates.data.map((template) => {
          const active = template.id === selectedId;
          return (
            <li key={template.id}>
              <Button
                type="button"
                variant={active ? "secondary" : "outline"}
                aria-pressed={active}
                onClick={() => select(template.id)}
                className={cn(
                  "h-auto w-full flex-col items-start justify-start gap-0.5 whitespace-normal px-3 py-2.5 text-left",
                  active && "ring-1 ring-brand-accent/40",
                )}
              >
                <span className="text-sm font-medium text-navy-deep">{template.name}</span>
                <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
                  {template.description ?? "No description"}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>

      <Card className="min-w-0">
        {!selectedId ? (
          <CardContent className="flex h-full min-h-[10rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Select a template to preview the structure it will create.
          </CardContent>
        ) : (
          <Tabs value={mode} onValueChange={(value) => setMode(value as "tree" | "hierarchy")}>
            <CardHeader className="flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="truncate text-base text-navy-deep">{selected?.name}</CardTitle>
                <CardDescription className="text-xs">
                  {preview.data
                    ? `${countNodes(preview.data.rootNode)} units will be created.`
                    : "Loading structure…"}
                </CardDescription>
              </div>
              <TabsList className="shrink-0 self-start">
                <TabsTrigger value="tree" className="gap-1.5">
                  <LayoutList className="h-3.5 w-3.5" /> Tree
                </TabsTrigger>
                <TabsTrigger value="hierarchy" className="gap-1.5">
                  <Workflow className="h-3.5 w-3.5" /> Hierarchy
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="space-y-4">
              {preview.isLoading && (
                <div className="space-y-2.5 py-2" role="status">
                  <span className="sr-only">Loading preview…</span>
                  <Skeleton className="h-5 w-2/5" />
                  <Skeleton className="ml-6 h-5 w-1/3" />
                  <Skeleton className="ml-6 h-5 w-1/2" />
                </div>
              )}
              {preview.isError && (
                <ErrorState
                  title="Couldn't load preview"
                  message={preview.error instanceof Error ? preview.error.message : "Failed to load preview."}
                />
              )}
              {preview.data && (
                <>
                  <TabsContent value="tree" className="mt-0">
                    <div className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-muted/30 p-4">
                      <ul>
                        <TemplateTreeNode node={preview.data.rootNode} />
                      </ul>
                    </div>
                  </TabsContent>
                  <TabsContent value="hierarchy" className="mt-0">
                    <OrgTreeGraph
                      roots={[templatePreviewToView(preview.data.rootNode)]}
                      className="h-[50vh] min-h-[320px] rounded-lg border border-border"
                    />
                  </TabsContent>
                </>
              )}

              {parents && parents.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="template-parent">Attach under</Label>
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger id="template-parent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ROOT_VALUE}>— Top level —</SelectItem>
                      {parents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {error && <ErrorState title="Couldn't apply template" message={error} />}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {canManage
                    ? "The template is copied into your organisation; you can edit every unit afterwards."
                    : "You need the organization.manage permission to apply a template."}
                </p>
                <Button
                  type="button"
                  variant="brand"
                  onClick={apply}
                  disabled={!canManage || !preview.data || clone.isPending}
                >
                  {clone.isPending ? "Applying…" : "Use this template"}
                </Button>
              </div>
            </CardContent>
          </Tabs>
        )}
      </Card>
    </div>
  );
}
