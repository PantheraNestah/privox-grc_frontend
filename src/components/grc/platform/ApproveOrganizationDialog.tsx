import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, BadgeCheck } from "lucide-react";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [attempted, setAttempted] = useState(false);
  const approveOrganization = useApprovePlatformOrganization();

  useEffect(() => {
    if (!open) {
      setAdminEmail("");
      setInitialGroupId("");
      setNotes("");
      setAttempted(false);
    }
  }, [open]);

  const trimmedEmail = adminEmail.trim();
  const emailError =
    trimmedEmail === ""
      ? "Enter the administrator's email before approving. The first tenant administrator cannot be provisioned without it."
      : !EMAIL_PATTERN.test(trimmedEmail)
        ? "Enter a valid email address, e.g. admin@organisation.com."
        : null;
  const showEmailError = attempted && emailError !== null;

  const submit = async () => {
    if (approveOrganization.isPending) return;
    if (emailError) {
      setAttempted(true);
      document.getElementById("approve-admin-email")?.focus();
      return;
    }
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
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[460px]">
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
            <Label htmlFor="approve-admin-email">
              Administrator email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="approve-admin-email"
              type="email"
              required
              aria-invalid={showEmailError}
              aria-describedby={showEmailError ? "approve-admin-email-error" : undefined}
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@organisation.com"
            />
            {showEmailError && (
              <p
                id="approve-admin-email-error"
                role="alert"
                className="flex items-start gap-1.5 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {emailError}
              </p>
            )}
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
            disabled={approveOrganization.isPending}
            variant="brand"
          >
            {approveOrganization.isPending ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
