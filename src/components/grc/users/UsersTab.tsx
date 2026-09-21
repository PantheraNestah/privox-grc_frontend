import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ErrorState } from "@/components/grc/common/states";
import { useMemberTransition, useOrganizationMembers } from "@/hooks/use-organization";
import type { OrganizationMember } from "@/lib/auth-types";
import { MembersTable } from "./MembersTable";
import { EmptyRow, TableCard, TableSkeleton, errorMessage } from "./shared";
import { isInactiveStatus } from "./user-management-utils";

export function UsersTab({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const membersQuery = useOrganizationMembers(orgId || undefined);
  const transition = useMemberTransition(orgId);
  const [memberToToggle, setMemberToToggle] = useState<OrganizationMember | null>(null);
  const members = membersQuery.data ?? [];
  const reactivating = isInactiveStatus(memberToToggle?.membershipStatus);

  // Backend lifecycle (§3.2): suspend (ACTIVE → SUSPENDED) and reactivate (SUSPENDED → ACTIVE).
  const handleToggle = async () => {
    const target = memberToToggle;
    if (!target) return;
    const reactivate = isInactiveStatus(target.membershipStatus);
    setMemberToToggle(null);
    try {
      await transition.mutateAsync({ userId: target.userId, action: reactivate ? "reactivate" : "suspend" });
      toast.success(reactivate ? "User reactivated" : "User suspended");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update user status"));
    }
  };

  return (
    <>
      {membersQuery.error && (
        <div className="mb-4">
          <ErrorState title="Couldn't load members" message={errorMessage(membersQuery.error, "Failed to load members")} />
        </div>
      )}

      <TableCard title="Users">
        {membersQuery.isLoading ? (
          <TableSkeleton label="Loading members..." />
        ) : members.length === 0 ? (
          <EmptyRow>No members found.</EmptyRow>
        ) : (
          <MembersTable
            members={members}
            manage
            isAdmin={isAdmin}
            pendingUserId={transition.isPending ? transition.variables?.userId : undefined}
            onToggle={setMemberToToggle}
          />
        )}
      </TableCard>

      <AlertDialog open={!!memberToToggle} onOpenChange={(open) => !open && setMemberToToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{reactivating ? "Activate user?" : "Deactivate user?"}</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend or reactivate the user via the backend member lifecycle endpoints.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={reactivating ? "" : "bg-destructive hover:bg-destructive/90"}
              onClick={handleToggle}
            >
              {reactivating ? "Reactivate" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
