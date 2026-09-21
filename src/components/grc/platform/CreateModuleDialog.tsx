import { useState } from "react";
import { toast } from "sonner";
import { Layers } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCreatePlatformModule } from "@/hooks/use-platform-modules";

/** Derive a stable uppercase module code, e.g. "Third Party Risk" → "THIRD_PARTY_RISK". */
const codeFromName = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

interface CreateModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Default position in the catalogue; the list is sorted ascending. */
  suggestedSortOrder?: number;
}

export function CreateModuleDialog({
  open,
  onOpenChange,
  suggestedSortOrder = 0,
}: CreateModuleDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(String(suggestedSortOrder));
  const [active, setActive] = useState(true);
  const createModule = useCreatePlatformModule();

  const canSubmit = name.trim() !== "" && code.trim() !== "";

  const reset = () => {
    setName("");
    setCode("");
    setCodeTouched(false);
    setDescription("");
    setSortOrder(String(suggestedSortOrder));
    setActive(true);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && createModule.isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    if (!canSubmit || createModule.isPending) return;
    const parsedSortOrder = Number.parseInt(sortOrder, 10);
    try {
      await createModule.mutateAsync({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || null,
        sortOrder: Number.isFinite(parsedSortOrder) ? parsedSortOrder : undefined,
        active,
      });
      toast.success(`Module "${name.trim()}" created`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create module");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> New module
          </DialogTitle>
          <DialogDescription>
            Add a module to the platform catalogue. Assign it to organizations from their detail page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="module-name">Name</Label>
            <Input
              id="module-name"
              value={name}
              onChange={(e) => {
                const nextName = e.target.value;
                setName(nextName);
                if (!codeTouched) setCode(codeFromName(nextName));
              }}
              placeholder="e.g. Third Party Risk"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="module-code">Code</Label>
            <Input
              id="module-code"
              value={code}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value.toUpperCase());
              }}
              placeholder="THIRD_PARTY_RISK"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="module-sort-order">Sort order</Label>
            <Input
              id="module-sort-order"
              type="number"
              inputMode="numeric"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="module-description">Description</Label>
            <Textarea
              id="module-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this module covers."
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 sm:col-span-2">
            <div className="space-y-0.5">
              <Label htmlFor="module-active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Active modules can be assigned to organizations.
              </p>
            </div>
            <Switch id="module-active" checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={createModule.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={submit}
            disabled={!canSubmit || createModule.isPending}
          >
            {createModule.isPending ? "Creating…" : "Create module"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
