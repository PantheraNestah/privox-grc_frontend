import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Pencil, Plus, Users } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/grc/common/states";
import {
  useCreateOrganizationGroup,
  useOrganizationGroups,
  useSetGroupActive,
} from "@/hooks/use-organization";
import type { OrganizationGroup } from "@/lib/auth-types";
import { EmptyRow, StatusBadge, TableCard, TableSkeleton, errorMessage } from "./shared";
import { FALLBACK_TEXT, deriveGroupCode, isInactiveStatus } from "./user-management-utils";

export function GroupsTab({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const groupsQuery = useOrganizationGroups(orgId || undefined);
  const createGroup = useCreateOrganizationGroup(orgId);
  const setGroupActive = useSetGroupActive(orgId);
  const [groupToToggle, setGroupToToggle] = useState<OrganizationGroup | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const groups = groupsQuery.data ?? [];
  const activating = isInactiveStatus(groupToToggle?.status, groupToToggle?.active);

  const handleCreate = async () => {
    const name = groupName.trim();
    if (!orgId || !name) return;
    try {
      // Groups are created active by default.
      await createGroup.mutateAsync({ code: deriveGroupCode(name), name });
      setGroupName("");
      setCreateOpen(false);
      toast.success("Group created successfully");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to create group"));
    }
  };

  const handleToggle = async () => {
    const target = groupToToggle;
    if (!target) return;
    const nextActive = isInactiveStatus(target.status, target.active);
    setGroupToToggle(null);
    try {
      await setGroupActive.mutateAsync({ groupId: target.id, active: nextActive });
      toast.success(nextActive ? "Group activated" : "Group deactivated");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update group status"));
    }
  };

  const creating = createGroup.isPending;

  return (
    <>
      {groupsQuery.error && (
        <div className="mb-4">
          <ErrorState title="Couldn't load groups" message={errorMessage(groupsQuery.error, "Failed to load groups")} />
        </div>
      )}

      <TableCard
        title="Groups"
        actions={
          isAdmin && (
            <Button variant="brand" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> Create Group
            </Button>
          )
        }
      >
        {groupsQuery.isLoading ? (
          <TableSkeleton label="Loading groups..." />
        ) : groups.length === 0 ? (
          <EmptyRow>No groups found.</EmptyRow>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Member Count</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead>Active</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium text-navy-deep">{group.name}</TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">
                    {group.description || FALLBACK_TEXT}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      {group.memberCount ?? 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={group.status} active={group.active} />
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Switch
                        checked={!isInactiveStatus(group.status, group.active)}
                        disabled={
                          Boolean(group.systemDefault) ||
                          (setGroupActive.isPending && setGroupActive.variables?.groupId === group.id)
                        }
                        onCheckedChange={() => setGroupToToggle(group)}
                        aria-label={
                          group.systemDefault
                            ? "System group status is locked"
                            : isInactiveStatus(group.status, group.active)
                              ? "Activate group"
                              : "Deactivate group"
                        }
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-brand-accent hover:text-navy">
                        <Link to={`/settings/users/groups/${group.id}`}>
                          <Eye /> View
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-brand-accent hover:text-navy">
                        <Link to={`/settings/users/groups/${group.id}/members`}>
                          <Users /> View Members
                        </Link>
                      </Button>
                      {isAdmin && (
                        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-brand-accent hover:text-navy">
                          <Link to={`/settings/users/groups/${group.id}/edit`}>
                            <Pencil /> Edit
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <AlertDialog open={!!groupToToggle} onOpenChange={(open) => !open && setGroupToToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{activating ? "Activate group?" : "Deactivate group?"}</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the group status for "{groupToToggle?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggle}>{activating ? "Activate" : "Deactivate"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createOpen} onOpenChange={(open) => !creating && setCreateOpen(open)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Create group</DialogTitle>
            <DialogDescription>
              Enter the group name. The group code will be generated from the name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="e.g. Editors"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={creating} onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" disabled={!groupName.trim() || creating} onClick={handleCreate}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
