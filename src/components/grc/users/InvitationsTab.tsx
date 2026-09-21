import { useState } from "react";
import { MailPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/grc/common/states";
import {
  useCreateInvitation,
  useOrganizationGroups,
  useOrganizationInvitations,
  useResendInvitation,
  useRevokeInvitation,
  type InvitationStatus,
} from "@/hooks/use-organization";
import type { Invitation } from "@/lib/auth-types";
import { cn } from "@/lib/utils";
import { EmptyRow, StatusBadge, TableCard, TableSkeleton, errorMessage } from "./shared";
import { formatDate } from "./user-management-utils";

type StatusFilter = "all" | InvitationStatus;

export function InvitationsTab({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const invitationsQuery = useOrganizationInvitations(
    orgId || undefined,
    statusFilter === "all" ? undefined : statusFilter,
  );
  const groupsQuery = useOrganizationGroups(orgId || undefined);
  const createInvitation = useCreateInvitation(orgId);
  const resendInvitation = useResendInvitation(orgId);
  const revokeInvitation = useRevokeInvitation(orgId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteGroupId, setInviteGroupId] = useState("");

  const invitations = invitationsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];

  const handleCreate = async () => {
    if (!orgId || !inviteEmail.trim()) return;
    try {
      await createInvitation.mutateAsync({
        email: inviteEmail.trim(),
        ...(inviteGroupId ? { initialGroupId: inviteGroupId } : {}),
      });
      toast.success("Invitation sent");
      setInviteEmail("");
      setInviteGroupId("");
      setInviteOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to send invitation"));
    }
  };

  const handleResend = async (invitation: Invitation) => {
    try {
      await resendInvitation.mutateAsync(invitation.id);
      toast.success(`Invitation resent to ${invitation.email}`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to resend invitation"));
    }
  };

  const handleRevoke = async (invitation: Invitation) => {
    try {
      await revokeInvitation.mutateAsync(invitation.id);
      toast.success("Invitation revoked");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to revoke invitation"));
    }
  };

  const busy = resendInvitation.isPending || revokeInvitation.isPending;

  return (
    <>
      <TableCard
        title="Invitations"
        actions={
          <>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="h-9 w-[160px] text-sm" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="REVOKED">Revoked</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Button variant="brand" size="sm" onClick={() => setInviteOpen(true)}>
                <MailPlus /> Invite User
              </Button>
            )}
          </>
        }
      >
        {invitationsQuery.error ? (
          <div className="p-4">
            <ErrorState
              title="Couldn't load invitations"
              message={errorMessage(invitationsQuery.error, "Failed to load invitations")}
            />
          </div>
        ) : invitationsQuery.isLoading ? (
          <TableSkeleton label="Loading invitations..." />
        ) : invitations.length === 0 ? (
          <EmptyRow>No invitations found.</EmptyRow>
        ) : (
          // Previous filter results stay on screen (dimmed) while the next one loads.
          <div className={cn("transition-opacity", invitationsQuery.isPlaceholderData && "opacity-60")}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="text-navy-deep">{invitation.email}</TableCell>
                    <TableCell>
                      <StatusBadge status={invitation.status?.toLowerCase()} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(invitation.expiresAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(invitation.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {invitation.status === "PENDING" && isAdmin ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-brand-accent hover:text-navy"
                              disabled={busy}
                              onClick={() => handleResend(invitation)}
                            >
                              <MailPlus /> Resend
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-destructive hover:text-destructive"
                              disabled={busy}
                              onClick={() => handleRevoke(invitation)}
                            >
                              <XCircle /> Revoke
                            </Button>
                          </>
                        ) : (
                          invitation.status !== "PENDING" && (
                            <span className="text-xs text-muted-foreground">No actions</span>
                          )
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TableCard>

      <Dialog open={inviteOpen} onOpenChange={(open) => !createInvitation.isPending && setInviteOpen(open)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>
              Send a 7-day invitation email. The user accepts it to register or join this organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="e.g. analyst@icea.co.ke"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-group">Initial group (optional)</Label>
              <Select value={inviteGroupId} onValueChange={setInviteGroupId}>
                <SelectTrigger id="invite-group" className="h-9 text-sm">
                  <SelectValue placeholder="Defaults to ORG_MEMBER" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.code ?? ""})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={createInvitation.isPending} onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={!inviteEmail.trim() || createInvitation.isPending}
              onClick={handleCreate}
            >
              {createInvitation.isPending ? "Sending..." : "Send invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
