import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";
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
import { useApprovePlatformOrganization } from "@/hooks/use-platform-organizations";

interface ApproveOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName?: string;
}

export function ApproveOrganizationDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
}: ApproveOrganizationDialogProps) {
  const [adminEmail, setAdminEmail] = useState("");
  const [initialGroupId, setInitialGroupId] = useState("");
  const [notes, setNotes] = useState("");
  const approveOrganization = useApprovePlatformOrganization();

  useEffect(() => {
    if (!open) {
      setAdminEmail("");
      setInitialGroupId("");
      setNotes("");
    }
  }, [open]);

  const canSubmit = adminEmail.trim() !== "" && adminEmail.includes("@");

  const submit = async () => {
    if (!canSubmit || approveOrganization.isPending) return;
    try {
      await approveOrganization.mutateAsync({
        organizationId,
        body: {
          adminEmail: adminEmail.trim(),
          initialGroupId: initialGroupId.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      });
      toast.success(`${organizationName ?? "Organization"} approved`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve organization");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !approveOrganization.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" /> Approve organization
          </DialogTitle>
          <DialogDescription>
            Validate {organizationName ? <span className="font-medium">{organizationName}</span> : "this organization"} and
            provision its first administrator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="approve-admin-email">Administrator email</Label>
            <Input
              id="approve-admin-email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@organisation.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="approve-group">Initial group ID (optional)</Label>
            <Input
              id="approve-group"
              value={initialGroupId}
              onChange={(e) => setInitialGroupId(e.target.value)}
              placeholder="Access group UUID"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="approve-notes">Notes (optional)</Label>
            <Textarea
              id="approve-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Documents verified. Approved for onboarding."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={approveOrganization.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!canSubmit || approveOrganization.isPending}
            className="bg-navy-deep hover:bg-navy text-white"
          >
            {approveOrganization.isPending ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
