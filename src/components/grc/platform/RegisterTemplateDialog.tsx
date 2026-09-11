import { useState } from "react";
import { toast } from "sonner";
import { Network } from "lucide-react";
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
import { useRegisterPlatformTemplate } from "@/hooks/use-platform-templates";

const EXAMPLE_TREE = `{
  "name": "Group",
  "type": "GROUP",
  "description": "Root of the standard tree",
  "children": [
    {
      "name": "Finance",
      "type": "DEPARTMENT",
      "children": []
    },
    {
      "name": "Operations",
      "type": "DIVISION",
      "children": [
        { "name": "Claims Processing", "type": "SECTION" }
      ]
    }
  ]
}`;

function validateNode(node: unknown, path = "root"): string | null {
  if (!node || typeof node !== "object") return `${path} must be an object`;
  const record = node as Record<string, unknown>;
  if (typeof record.name !== "string" || !record.name.trim()) return `${path}.name is required`;
  if (typeof record.type !== "string" || !record.type.trim()) return `${path}.type is required`;
  if (record.children !== undefined) {
    if (!Array.isArray(record.children)) return `${path}.children must be an array`;
    for (let i = 0; i < record.children.length; i += 1) {
      const error = validateNode(record.children[i], `${path}.children[${i}]`);
      if (error) return error;
    }
  }
  return null;
}

interface RegisterTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterTemplateDialog({ open, onOpenChange }: RegisterTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rootNodeJson, setRootNodeJson] = useState(EXAMPLE_TREE);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const registerTemplate = useRegisterPlatformTemplate();

  const reset = () => {
    setName("");
    setDescription("");
    setRootNodeJson(EXAMPLE_TREE);
    setJsonError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && registerTemplate.isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    if (registerTemplate.isPending) return;
    if (!name.trim()) {
      setJsonError("Template name is required");
      return;
    }

    let rootNode: unknown;
    try {
      rootNode = JSON.parse(rootNodeJson);
    } catch {
      setJsonError("Root node is not valid JSON");
      return;
    }
    const nodeError = validateNode(rootNode);
    if (nodeError) {
      setJsonError(nodeError);
      return;
    }

    setJsonError(null);
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
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-4 w-4" /> Register organization template
          </DialogTitle>
          <DialogDescription>
            Publish a reusable starter tree. Organizations clone it into their own tenant on demand.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="template-root">Root node (JSON)</Label>
              <button
                type="button"
                onClick={() => {
                  setRootNodeJson(EXAMPLE_TREE);
                  setJsonError(null);
                }}
                className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
              >
                Reset to example
              </button>
            </div>
            <Textarea
              id="template-root"
              value={rootNodeJson}
              onChange={(e) => {
                setRootNodeJson(e.target.value);
                setJsonError(null);
              }}
              rows={12}
              spellCheck={false}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Each node needs <span className="font-mono">name</span> and{" "}
              <span className="font-mono">type</span>
              {" "}(GROUP, COMPANY, DEPARTMENT, DIVISION, SECTION, PROCESS, SUB_PROCESS);{" "}
              <span className="font-mono">children</span> is optional.
            </p>
            {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
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
