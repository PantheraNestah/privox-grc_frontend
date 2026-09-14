import { useState } from "react";
import { toast } from "sonner";
import { Network, Plus, Trash2, ChevronDown, ChevronRight, Code, LayoutGrid } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRegisterPlatformTemplate } from "@/hooks/use-platform-templates";
import type { OrgNodeType } from "@/lib/governance-types";

const NODE_TYPES: OrgNodeType[] = [
  "GROUP",
  "COMPANY",
  "DEPARTMENT",
  "DIVISION",
  "SECTION",
  "PROCESS",
  "SUB_PROCESS",
];

interface TreeNode {
  id: string;
  name: string;
  type: OrgNodeType;
  description: string;
  children: TreeNode[];
}

let nodeIdCounter = 0;
function newNodeId() {
  nodeIdCounter += 1;
  return `node-${Date.now()}-${nodeIdCounter}`;
}

function makeNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: newNodeId(),
    name: "",
    type: "DEPARTMENT",
    description: "",
    children: [],
    ...overrides,
  };
}

function makeExampleTree(): TreeNode {
  return makeNode({
    name: "Group",
    type: "GROUP",
    description: "Root of the standard tree",
    children: [
      makeNode({ name: "Finance", type: "DEPARTMENT" }),
      makeNode({
        name: "Operations",
        type: "DIVISION",
        children: [makeNode({ name: "Claims Processing", type: "SECTION" })],
      }),
    ],
  });
}

interface RawOrgNode {
  name: string;
  type: string;
  description?: string | null;
  children?: RawOrgNode[];
}

function toRawNode(node: TreeNode): RawOrgNode {
  return {
    name: node.name.trim(),
    type: node.type,
    description: node.description.trim() || undefined,
    children: node.children.length ? node.children.map(toRawNode) : undefined,
  };
}

function fromRawNode(raw: unknown): TreeNode {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const type = NODE_TYPES.includes(record.type as OrgNodeType)
    ? (record.type as OrgNodeType)
    : "DEPARTMENT";
  const children = Array.isArray(record.children) ? record.children.map(fromRawNode) : [];
  return makeNode({
    name: typeof record.name === "string" ? record.name : "",
    type,
    description: typeof record.description === "string" ? record.description : "",
    children,
  });
}

function updateNode(tree: TreeNode, id: string, patch: Partial<TreeNode>): TreeNode {
  if (tree.id === id) return { ...tree, ...patch };
  return { ...tree, children: tree.children.map((c) => updateNode(c, id, patch)) };
}

function addChild(tree: TreeNode, parentId: string): TreeNode {
  if (tree.id === parentId) return { ...tree, children: [...tree.children, makeNode()] };
  return { ...tree, children: tree.children.map((c) => addChild(c, parentId)) };
}

function removeNode(tree: TreeNode, id: string): TreeNode {
  return {
    ...tree,
    children: tree.children.filter((c) => c.id !== id).map((c) => removeNode(c, id)),
  };
}

function validateTree(node: TreeNode, path = "root"): string | null {
  if (!node.name.trim()) return `${path} needs a name`;
  for (let i = 0; i < node.children.length; i += 1) {
    const error = validateTree(node.children[i], `${path} › child ${i + 1}`);
    if (error) return error;
  }
  return null;
}

interface NodeEditorProps {
  node: TreeNode;
  depth: number;
  isRoot: boolean;
  onUpdate: (id: string, patch: Partial<TreeNode>) => void;
  onAddChild: (id: string) => void;
  onRemove: (id: string) => void;
}

function NodeEditor({ node, depth, isRoot, onUpdate, onAddChild, onRemove }: NodeEditorProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="relative">
      {!isRoot && (
        /* horizontal branch line connecting this node to the parent's trunk line */
        <span
          className="pointer-events-none absolute top-5 border-t-2 border-border/70"
          style={{ left: (depth - 1) * 20 + 9, width: 11 }}
        />
      )}
      <div
        className="relative rounded-md border border-border bg-card p-3 shadow-sm"
        style={{ marginLeft: depth * 20 }}
      >
        <div className="flex items-start gap-2">
          {node.children.length > 0 ? (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="mt-2 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={collapsed ? "Expand children" : "Collapse children"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          ) : (
            <Network className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
          )}

          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_150px]">
            <Input
              value={node.name}
              onChange={(e) => onUpdate(node.id, { name: e.target.value })}
              placeholder="Node name"
              className="h-8"
            />
            <Select
              value={node.type}
              onValueChange={(value) => onUpdate(node.id, { type: value as OrgNodeType })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NODE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={node.description}
              onChange={(e) => onUpdate(node.id, { description: e.target.value })}
              placeholder="Description (optional)"
              className="h-8 sm:col-span-2"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Add child node"
              onClick={() => onAddChild(node.id)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            {!isRoot && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                title="Remove node"
                onClick={() => onRemove(node.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {!collapsed && node.children.length > 0 && (
        <div className="relative mt-2 space-y-2">
          {/* trunk line running past every child except the stub below the last one */}
          <span
            className="pointer-events-none absolute top-0 border-l-2 border-border/70"
            style={{ left: depth * 20 + 9, bottom: 12 }}
          />
          {node.children.map((child) => (
            <NodeEditor
              key={child.id}
              node={child}
              depth={depth + 1}
              isRoot={false}
              onUpdate={onUpdate}
              onAddChild={onAddChild}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RegisterTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterTemplateDialog({ open, onOpenChange }: RegisterTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tree, setTree] = useState<TreeNode>(() => makeExampleTree());
  const [mode, setMode] = useState<"visual" | "json">("visual");
  const [rawJson, setRawJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const registerTemplate = useRegisterPlatformTemplate();

  const reset = () => {
    setName("");
    setDescription("");
    setTree(makeExampleTree());
    setMode("visual");
    setRawJson("");
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && registerTemplate.isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const switchToJson = () => {
    setRawJson(JSON.stringify(toRawNode(tree), null, 2));
    setError(null);
    setMode("json");
  };

  const switchToVisual = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setTree(fromRawNode(parsed));
      setError(null);
      setMode("visual");
    } catch {
      setError("Root node is not valid JSON");
    }
  };

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
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register template");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-4 w-4" /> Register organization template
          </DialogTitle>
          <DialogDescription>
            Publish a reusable starter tree. Organizations clone it into their own tenant on demand.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Template tree</Label>
              <div className="flex overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => mode !== "visual" && switchToVisual()}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors ${
                    mode === "visual"
                      ? "bg-navy-deep text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <LayoutGrid className="h-3 w-3" /> Builder
                </button>
                <button
                  type="button"
                  onClick={() => mode !== "json" && switchToJson()}
                  className={`flex items-center gap-1 px-2 py-1 text-xs font-medium transition-colors ${
                    mode === "json"
                      ? "bg-navy-deep text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Code className="h-3 w-3" /> JSON
                </button>
              </div>
            </div>

            {mode === "visual" ? (
              <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-md border border-dashed border-border p-3">
                <NodeEditor
                  node={tree}
                  depth={0}
                  isRoot
                  onUpdate={(id, patch) => setTree((t) => updateNode(t, id, patch))}
                  onAddChild={(id) => setTree((t) => addChild(t, id))}
                  onRemove={(id) => setTree((t) => removeNode(t, id))}
                />
              </div>
            ) : (
              <Textarea
                value={rawJson}
                onChange={(e) => {
                  setRawJson(e.target.value);
                  setError(null);
                }}
                rows={14}
                spellCheck={false}
                className="font-mono text-xs"
              />
            )}

            <p className="text-xs text-muted-foreground">
              Each node needs a name and a type (
              {NODE_TYPES.join(", ")}); child nodes are optional.
            </p>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={registerTemplate.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!name.trim() || registerTemplate.isPending}
            className="bg-navy-deep text-white hover:bg-navy"
          >
            {registerTemplate.isPending ? "Registering…" : "Register template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
