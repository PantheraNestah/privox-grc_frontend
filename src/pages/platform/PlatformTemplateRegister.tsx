import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, ChevronsDownUp, ChevronsUpDown, Code, LayoutGrid, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { OrgTreeGraph } from "@/components/grc/OrgTreeGraph";
import { PageHeader } from "@/components/grc/common/PageHeader";
import { TemplateNodeEditor } from "@/components/grc/platform/TemplateNodeEditor";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";
import { useRegisterPlatformTemplate } from "@/hooks/use-platform-templates";
import { canPlatform, PLATFORM_PERMISSIONS } from "@/lib/platformPermissions";
import {
  NODE_TYPES,
  addChild,
  ancestorIds,
  countNodes,
  duplicateNode,
  emptyNameIds,
  fromRawNode,
  makeExampleTree,
  moveNode,
  parentIds,
  removeNode,
  toRawNode,
  toViewNode,
  treeDepth,
  updateNode,
  validateTree,
  type RawOrgNode,
  type TreeNode,
} from "@/lib/template-tree";

type Mode = "builder" | "json";

const flattenIds = (node: TreeNode): string[] => [node.id, ...node.children.flatMap(flattenIds)];

function TemplateRegisterForm() {
  const navigate = useNavigate();
  const registerTemplate = useRegisterPlatformTemplate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tree, setTree] = useState<TreeNode>(() => makeExampleTree());
  const [mode, setMode] = useState<Mode>("builder");
  const [rawJson, setRawJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showInvalid, setShowInvalid] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const parsedJson = useMemo(() => {
    if (mode !== "json") return null;
    try {
      return fromRawNode(JSON.parse(rawJson));
    } catch {
      return null;
    }
  }, [mode, rawJson]);

  // In JSON mode the preview follows the text; while it doesn't parse, keep the last builder tree.
  const previewTree = mode === "json" && parsedJson ? parsedJson : tree;
  const viewRoot = useMemo(() => toViewNode(previewTree), [previewTree]);
  const structureKey = useMemo(() => flattenIds(previewTree).join("|"), [previewTree]);
  const jsonUnparseable = mode === "json" && !parsedJson;

  const invalidIds = useMemo(() => (showInvalid ? emptyNameIds(tree) : new Set<string>()), [showInvalid, tree]);
  const nodeCount = countNodes(previewTree);
  const levels = treeDepth(previewTree);

  const changeMode = (next: string) => {
    if (next === mode) return;
    if (next === "json") {
      setRawJson(JSON.stringify(toRawNode(tree), null, 2));
      setError(null);
      setMode("json");
      return;
    }
    try {
      setTree(fromRawNode(JSON.parse(rawJson)));
      setError(null);
      setMode("builder");
    } catch {
      setError("Root node is not valid JSON");
    }
  };

  const focusNode = (id: string) => {
    const path = ancestorIds(tree, id);
    if (!path) return;
    setCollapsedIds((current) => {
      const next = new Set(current);
      path.forEach((ancestor) => next.delete(ancestor));
      return next;
    });
    setSelectedId(id);
    window.requestAnimationFrame(() =>
      document.getElementById(`template-node-${id}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" }),
    );
  };

  const toggleCollapse = (id: string) =>
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (registerTemplate.isPending) return;
    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    let rootNode: RawOrgNode;
    if (mode === "json") {
      try {
        rootNode = JSON.parse(rawJson);
      } catch {
        setError("Root node is not valid JSON");
        return;
      }
      if (!rootNode || typeof rootNode !== "object" || !rootNode.name) {
        setError("root needs a name");
        return;
      }
    } else {
      const treeError = validateTree(tree);
      if (treeError) {
        setShowInvalid(true);
        setError(treeError);
        return;
      }
      rootNode = toRawNode(tree);
    }

    setError(null);
    try {
      await registerTemplate.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        rootNode: rootNode as never,
      });
      toast.success(`Template "${name.trim()}" registered`);
      navigate("/platform/templates");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register template");
    }
  };

  return (
    <>
      <Helmet>
        <title>Register template · Rsolve GRC Platform</title>
        <meta name="description" content="Design and publish a reusable organization tree template." />
        <link rel="canonical" href="/platform/templates/new" />
      </Helmet>

      <PageHeader
        crumbs={[{ label: "Templates", to: "/platform/templates" }, { label: "Register template" }]}
        title="Register organization template"
        description="Publish a reusable starter tree. Organizations clone it into their own tenant on demand."
      />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base text-navy-deep">Details</CardTitle>
              <CardDescription className="text-xs">How this template appears in the catalogue.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Insurance Org — Standard"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="template-description">Description (optional)</Label>
                <Input
                  id="template-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A standard tree for insurance organizations"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <Tabs value={mode} onValueChange={changeMode}>
              <CardHeader className="flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="text-base text-navy-deep">Structure</CardTitle>
                  <CardDescription className="text-xs">
                    Each node needs a name and a type ({NODE_TYPES.join(", ")}); children are optional.
                  </CardDescription>
                </div>
                <TabsList className="self-start">
                  <TabsTrigger value="builder" className="gap-1.5">
                    <LayoutGrid className="h-3.5 w-3.5" /> Builder
                  </TabsTrigger>
                  <TabsTrigger value="json" className="gap-1.5">
                    <Code className="h-3.5 w-3.5" /> JSON
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="space-y-4">
                {mode === "builder" ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCollapsedIds(new Set())}
                      >
                        <ChevronsUpDown /> Expand all
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCollapsedIds(new Set(parentIds(tree).filter((id) => id !== tree.id)))
                        }
                      >
                        <ChevronsDownUp /> Collapse all
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-muted-foreground"
                        onClick={() => {
                          setTree(makeExampleTree());
                          setCollapsedIds(new Set());
                          setShowInvalid(false);
                          setError(null);
                        }}
                      >
                        <RotateCcw /> Reset to example
                      </Button>
                    </div>

                    <div className="max-h-[560px] overflow-auto rounded-lg border border-dashed border-border bg-muted/30 p-3">
                      <TemplateNodeEditor
                        node={tree}
                        depth={0}
                        isRoot
                        isFirst
                        isLast
                        collapsedIds={collapsedIds}
                        invalidIds={invalidIds}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onToggleCollapse={toggleCollapse}
                        onUpdate={(id, patch) => setTree((t) => updateNode(t, id, patch))}
                        onAddChild={(id) => {
                          setTree((t) => addChild(t, id));
                          setCollapsedIds((current) => {
                            const next = new Set(current);
                            next.delete(id);
                            return next;
                          });
                        }}
                        onDuplicate={(id) => setTree((t) => duplicateNode(t, id))}
                        onMove={(id, direction) => setTree((t) => moveNode(t, id, direction))}
                        onRemove={(id) => setTree((t) => removeNode(t, id))}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      value={rawJson}
                      onChange={(e) => {
                        setRawJson(e.target.value);
                        setError(null);
                      }}
                      rows={16}
                      spellCheck={false}
                      aria-label="Template JSON"
                      className="font-mono text-xs"
                    />
                    {jsonUnparseable && (
                      <p className="text-xs text-warn">
                        This JSON can't be parsed yet, so the preview is showing your last valid tree.
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <Alert variant="destructive" className="flex items-center gap-2 py-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Tabs>
          </Card>
        </div>

        <Card className="min-w-0 xl:sticky xl:top-24">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1.5">
                <CardTitle className="text-base text-navy-deep">Live preview</CardTitle>
                <CardDescription className="text-xs">
                  Updates as you edit{mode === "builder" ? ". Click a node to jump to it." : "."}
                </CardDescription>
              </div>
              <div className="flex gap-1.5">
                <Badge variant="secondary" className="text-[11px] font-normal">
                  {nodeCount} node{nodeCount === 1 ? "" : "s"}
                </Badge>
                <Badge variant="secondary" className="text-[11px] font-normal">
                  {levels} level{levels === 1 ? "" : "s"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <OrgTreeGraph
              key={structureKey}
              roots={[viewRoot]}
              onNodeClick={mode === "builder" ? focusNode : undefined}
              className="h-[420px] border-t border-border xl:h-[calc(100dvh-18rem)] xl:min-h-[420px]"
            />
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-4 z-20 mt-6">
        <Card className="flex flex-col gap-3 p-3 shadow-card-hover sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <p className="text-xs text-muted-foreground">
            {nodeCount} node{nodeCount === 1 ? "" : "s"} · {levels} level{levels === 1 ? "" : "s"}
            {invalidIds.size > 0 && (
              <span className="text-destructive">
                {" "}
                · {invalidIds.size} unnamed
              </span>
            )}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link to="/platform/templates">Cancel</Link>
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={submit}
              disabled={!name.trim() || registerTemplate.isPending}
            >
              {registerTemplate.isPending ? "Registering…" : "Register template"}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}

const PlatformTemplateRegister = () => {
  const { permissions } = usePlatformAuth();
  if (!canPlatform(permissions, PLATFORM_PERMISSIONS.orgNodeManage)) {
    return <Navigate to="/platform/templates" replace />;
  }
  return <TemplateRegisterForm />;
};

export default PlatformTemplateRegister;
