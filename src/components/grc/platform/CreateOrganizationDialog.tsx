import { useState } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreatePlatformOrganization } from "@/hooks/use-platform-organizations";
import type { PlanTier } from "@/lib/platformAdmin";

const PLAN_TIERS: PlanTier[] = ["STANDARD", "PREMIUM", "ENTERPRISE"];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const emptyForm = {
  name: "",
  code: "",
  slug: "",
  countryCode: "",
  planTier: "STANDARD" as PlanTier,
};

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationDialog({ open, onOpenChange }: CreateOrganizationDialogProps) {
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const createOrganization = useCreatePlatformOrganization();

  const canSubmit =
    form.name.trim() !== "" &&
    form.code.trim() !== "" &&
    form.slug.trim() !== "" &&
    form.countryCode.trim() !== "";

  const reset = () => {
    setForm(emptyForm);
    setSlugTouched(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && createOrganization.isPending) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = async () => {
    if (!canSubmit || createOrganization.isPending) return;
    const code = form.code.trim().toUpperCase();
    try {
      await createOrganization.mutateAsync({
        name: form.name.trim(),
        code,
        slug: form.slug.trim(),
        countryCode: form.countryCode.trim().toUpperCase(),
        planTier: form.planTier,
      });
      toast.success(`Organization "${form.name.trim()}" created`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create organization");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> New organization
          </DialogTitle>
          <DialogDescription>
            Register a tenant. It starts in <span className="font-medium">Pending validation</span> until approved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({
                  ...f,
                  name,
                  slug: slugTouched ? f.slug : slugify(name),
                }));
              }}
              placeholder="e.g. G & Nestahs Co."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-code">Code</Label>
            <Input
              id="org-code"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="GNC"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="org-country">Country code</Label>
            <Input
              id="org-country"
              value={form.countryCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, countryCode: e.target.value.toUpperCase().slice(0, 3) }))
              }
              placeholder="KE"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: e.target.value }));
              }}
              placeholder="g-nestahs-co"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-plan">Plan tier</Label>
            <Select
              value={form.planTier}
              onValueChange={(value) => setForm((f) => ({ ...f, planTier: value as PlanTier }))}
            >
              <SelectTrigger id="org-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_TIERS.map((tier) => (
                  <SelectItem key={tier} value={tier}>
                    {tier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={createOrganization.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!canSubmit || createOrganization.isPending}
            className="bg-navy-deep hover:bg-navy text-white"
          >
            {createOrganization.isPending ? "Creating…" : "Create organization"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
