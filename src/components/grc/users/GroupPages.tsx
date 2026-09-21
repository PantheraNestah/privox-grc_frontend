import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronDown, Pencil, UserPlus, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { ErrorState } from "@/components/grc/common/states";
import { useActiveUser } from "@/hooks/use-active-user";
import {
  useAddGroupMember,
  useGroupMembers,
  useGroupPermissions,
  useOrganizationGroup,
  useOrganizationMembers,
  usePermissionCatalog,
  useRemoveGroupMember,
  useUpdateGroupPermissions,
  useUpdateOrganizationGroup,
} from "@/hooks/use-organization";
import { can } from "@/data/userStore";
import type { GroupMember, OrganizationGroupDetail, OrganizationPermission } from "@/lib/auth-types";
import {
  DetailField,
  DetailSkeleton,
  EmptyRow,
  PermissionsList,
  SectionCard,
  StatusBadge,
  TableCard,
  TableSkeleton,
  errorMessage,
  useOrganizationId,
} from "./shared";
import { statusLabel } from "./user-management-utils";

const GROUPS_CRUMBS = [
  { label: "User Management", to: "/settings/users" },
  { label: "Groups", to: "/settings/users?tab=groups" },
];

function BackButton({ to }: { to: string }) {
  return (
    <Button asChild variant="outline">
      <Link to={to}>
        <ArrowLeft /> Back
      </Link>
    </Button>
  );
}

function useGroup(groupId?: string) {
  const orgId = useOrganizationId();
  const groupQuery = useOrganizationGroup(orgId || undefined, groupId);

  let error: string | null = null;
  if (!orgId || !groupId) error = "No active organization or group id was found.";
  else if (groupQuery.error) error = errorMessage(groupQuery.error, "Failed to load group");

  return { orgId, group: groupQuery.data ?? null, isLoading: groupQuery.isLoading, error };
}

export function GroupView() {
  const { groupId } = useParams();
  const { group, isLoading, error } = useGroup(groupId);

  return (
    <>
      <Helmet>
        <title>Group Details - Rsolve GRC Platform</title>
        <meta name="description" content="View group details." />
        <link rel="canonical" href={`/settings/users/groups/${groupId ?? ""}`} />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[...GROUPS_CRUMBS, { label: group?.name ?? "Group" }]}
        title={group?.name ?? "Group Details"}
        description="Group name and description from the organization group endpoint."
        actions={
          <>
            {group && (
              <>
                <Button asChild variant="outline">
                  <Link to={`/settings/users/groups/${group.id}/members`}>
                    <Users /> Members
                  </Link>
                </Button>
                <Button asChild variant="brand">
                  <Link to={`/settings/users/groups/${group.id}/edit`}>
                    <Pencil /> Edit
                  </Link>
                </Button>
              </>
            )}
            <BackButton to="/settings/users?tab=groups" />
          </>
        }
      />

      {isLoading && <DetailSkeleton label="Loading group..." />}
      {!isLoading && error && <ErrorState title="Couldn't load group" message={error} />}
      {group && (
        <div className="space-y-6">
          <SectionCard title="Group Details" description="Identity and status.">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label="Name" value={group.name} />
              <DetailField label="Code" value={group.code} />
              <DetailField label="Description" value={group.description} />
              <DetailField label="Status" value={statusLabel(group.status, group.active)} />
              <DetailField label="Member Count" value={String(group.memberCount ?? 0)} />
            </div>
          </SectionCard>

          <SectionCard title="Permissions" description="Permissions granted to every member of this group.">
            <PermissionsList
              permissions={group.permissions}
              emptyText="No permissions assigned to this group."
              showCode={false}
            />
          </SectionCard>
        </div>
      )}
    </>
  );
}

export function GroupMembersView() {
  const { groupId } = useParams();
  const orgId = useOrganizationId();
  const activeUser = useActiveUser();
  const isAdmin = can.manageUsers(activeUser.role);
  const [selectedUserId, setSelectedUserId] = useState("");

  const groupQuery = useOrganizationGroup(orgId || undefined, groupId);
  const membersQuery = useGroupMembers(orgId || undefined, groupId);
  const allMembersQuery = useOrganizationMembers(orgId || undefined);
  const addMember = useAddGroupMember(orgId, groupId ?? "");
  const removeMember = useRemoveGroupMember(orgId, groupId ?? "");

  const group = groupQuery.data ?? null;
  const members = membersQuery.data ?? [];
  const availableMembers = (allMembersQuery.data ?? []).filter(
    (member) => !members.some((groupMember) => groupMember.userId === member.userId),
  );
  const error = !orgId || !groupId
    ? "No active organization or group id was found."
    : ((groupQuery.error ?? membersQuery.error ?? allMembersQuery.error) &&
      errorMessage(groupQuery.error ?? membersQuery.error ?? allMembersQuery.error, "Failed to load group members"));
  const busy = addMember.isPending || removeMember.isPending;

  const handleAdd = async () => {
    if (!selectedUserId) return;
    try {
      await addMember.mutateAsync(selectedUserId);
      setSelectedUserId("");
      toast.success("Member added");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to add member"));
    }
  };

  const handleRemove = async (member: GroupMember) => {
    try {
      await removeMember.mutateAsync(member.userId);
      toast.success("Member removed");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove member"));
    }
  };

  return (
    <>
      <Helmet>
        <title>Group Members - Rsolve GRC Platform</title>
        <meta name="description" content="View and manage group members." />
        <link rel="canonical" href={`/settings/users/groups/${groupId ?? ""}/members`} />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[
          ...GROUPS_CRUMBS,
          ...(group ? [{ label: group.name, to: `/settings/users/groups/${group.id}` }] : []),
          { label: "Members" },
        ]}
        title={group?.name ? `${group.name} Members` : "Group Members"}
        description="Users assigned to this group."
        actions={
          <>
            {group && (
              <Button asChild variant="brand">
                <Link to={`/settings/users/groups/${group.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            <BackButton to={group ? `/settings/users/groups/${group.id}` : "/settings/users?tab=groups"} />
          </>
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorState title="Couldn't load group members" message={error} />
        </div>
      )}

      <TableCard
        title="Members"
        actions={
          group?.memberCount != null && (
            <Badge variant="secondary" className="text-[11px] font-normal">
              {group.memberCount}
            </Badge>
          )
        }
      >
        {isAdmin && (
          <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-9 text-sm" aria-label="User to add">
                <SelectValue placeholder="Select a user to add..." />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.fullName} ({member.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="brand" size="sm" className="h-9 shrink-0" disabled={!selectedUserId || busy} onClick={handleAdd}>
              <UserPlus /> Add
            </Button>
          </div>
        )}

        {membersQuery.isLoading ? (
          <TableSkeleton label="Loading members..." />
        ) : members.length === 0 ? (
          <EmptyRow>No members in this group.</EmptyRow>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.membershipId ?? member.userId}>
                  <TableCell className="font-medium text-navy-deep">{member.fullName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{member.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{member.username}</TableCell>
                  <TableCell>
                    <StatusBadge status={member.membershipStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-destructive hover:text-destructive"
                        disabled={busy}
                        onClick={() => handleRemove(member)}
                      >
                        <XCircle /> Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </>
  );
}

interface GroupEditFormProps {
  orgId: string;
  group: OrganizationGroupDetail;
  catalog: OrganizationPermission[];
  initialPermissionIds: string[];
}

function GroupEditForm({ orgId, group, catalog, initialPermissionIds }: GroupEditFormProps) {
  const navigate = useNavigate();
  const updateGroup = useUpdateOrganizationGroup(orgId);
  const updatePermissions = useUpdateGroupPermissions(orgId, group.id);
  const [description, setDescription] = useState(group.description ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialPermissionIds);
  const saving = updateGroup.isPending || updatePermissions.isPending;

  const selectedPermissions = catalog.filter((permission) => selectedIds.includes(permission.id));

  const togglePermission = (permissionId: string, checked: boolean | "indeterminate") =>
    setSelectedIds((current) =>
      checked === true ? Array.from(new Set([...current, permissionId])) : current.filter((id) => id !== permissionId),
    );

  const handleSave = async () => {
    try {
      await updateGroup.mutateAsync({ groupId: group.id, body: { description: description.trim() } });
      await updatePermissions.mutateAsync(selectedIds);
      toast.success("Group updated");
      navigate(`/settings/users/groups/${group.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update group"));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base text-navy-deep">Group settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input id="group-name" value={group.name} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-status">Status</Label>
            <Input id="group-status" value={statusLabel(group.status, group.active)} readOnly disabled />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="group-description">Description</Label>
          <Textarea
            id="group-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label>Permissions</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between font-normal">
                {`${selectedIds.length} permission${selectedIds.length === 1 ? "" : "s"} selected`}
                <ChevronDown />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(520px,calc(100vw-2rem))] p-0" align="start">
              <div className="max-h-72 overflow-y-auto p-2">
                {catalog.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">No permissions available.</p>
                ) : (
                  catalog.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedIds.includes(permission.id)}
                        onCheckedChange={(checked) => togglePermission(permission.id, checked)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-navy-deep">
                          {permission.name || permission.code}
                        </span>
                        <span className="block text-xs text-muted-foreground">{permission.code}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex flex-wrap gap-2">
            {selectedPermissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No permissions selected.</p>
            ) : (
              selectedPermissions.map((permission) => (
                <Badge key={permission.id} variant="outline" className="text-[11px] font-normal">
                  {permission.code}
                </Badge>
              ))
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2 border-t border-border pt-4">
        <Button asChild variant="outline">
          <Link to={`/settings/users/groups/${group.id}`}>Cancel</Link>
        </Button>
        <Button variant="brand" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function GroupEdit() {
  const { groupId } = useParams();
  const { orgId, group, isLoading: groupLoading, error: groupError } = useGroup(groupId);
  const catalogQuery = usePermissionCatalog();
  const groupPermissionsQuery = useGroupPermissions(orgId || undefined, groupId);

  // The form is only shown once everything it edits is loaded: saving with a
  // half-loaded permission list would overwrite the group's real permissions.
  const isLoading = groupLoading || catalogQuery.isLoading || groupPermissionsQuery.isLoading;
  const queryError = catalogQuery.error ?? groupPermissionsQuery.error;
  const error = groupError ?? (queryError ? errorMessage(queryError, "Failed to load permissions") : null);
  const ready = group && catalogQuery.data && groupPermissionsQuery.data;
  const backTo = group ? `/settings/users/groups/${group.id}` : "/settings/users?tab=groups";

  return (
    <>
      <Helmet>
        <title>Edit Group - Rsolve GRC Platform</title>
        <meta name="description" content="Edit group description and permissions." />
        <link rel="canonical" href={`/settings/users/groups/${groupId ?? ""}/edit`} />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[
          ...GROUPS_CRUMBS,
          ...(group ? [{ label: group.name, to: `/settings/users/groups/${group.id}` }] : []),
          { label: "Edit" },
        ]}
        title={group?.name ? `Edit ${group.name}` : "Edit Group"}
        description="Update the group description and assigned permissions."
        actions={<BackButton to={backTo} />}
      />

      {isLoading && <DetailSkeleton label="Loading group..." />}
      {!isLoading && error && <ErrorState title="Couldn't load group" message={error} />}
      {ready && (
        <GroupEditForm
          key={group.id}
          orgId={orgId}
          group={group}
          catalog={catalogQuery.data}
          initialPermissionIds={groupPermissionsQuery.data.map((permission) => permission.id)}
        />
      )}
    </>
  );
}
