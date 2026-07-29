import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Users, ShieldAlert, Layers,
  UserCircle2, Mail, Hash, Trash2, UserPlus, Eye, ShieldCheck, Calendar, BadgeCheck, X,
  Plus, Pencil, KeyRound,
} from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveUser } from "@/hooks/use-active-user";
import { can } from "@/data/userStore";
import {
  mockPermissionsForGroup,
  DEFAULT_PERMISSIONS,
  type MockPermission,
} from "@/data/mockGroupPermissions";
import {
  fetchOrganizationMembers,
  fetchOrganizationGroups,
  fetchOrganizationGroup,
  fetchGroupMembers,
  fetchMemberGroups,
  addGroupMember,
  removeGroupMember,
} from "@/lib/organization";
import type {
  OrganizationMember,
  OrganizationGroup,
  OrganizationGroupDetail,
  GroupMember,
} from "@/lib/auth-types";

const FEATURED_GROUP_ID = "0a7ea4ae-0829-4911-a992-0531a9c1e6f9";

const UserManagement = () => {
  const activeUser = useActiveUser();
  const isAdmin = can.manageUsers(activeUser.role);

  // API data
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [groups, setGroups] = useState<OrganizationGroup[]>([]);
  const [featuredGroup, setFeaturedGroup] = useState<OrganizationGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail dialogs
  const [viewedMember, setViewedMember] = useState<OrganizationMember | null>(null);
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null);
  const [memberGroups, setMemberGroups] = useState<OrganizationGroup[]>([]);
  const [memberGroupsLoading, setMemberGroupsLoading] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState<OrganizationGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);
  const [groupMembersError, setGroupMembersError] = useState<string | null>(null);

  // Add/remove group member
  const [selectedNewUserId, setSelectedNewUserId] = useState<string>("");
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Group permissions (mock, local-only — no backend endpoint yet)
  const [groupPermissions, setGroupPermissions] = useState<Record<string, string[]>>({});
  const [selectedPermGroup, setSelectedPermGroup] = useState<OrganizationGroup | null>(null);
  const [newPermSelection, setNewPermSelection] = useState<string>("");

  // Create/edit/delete group (mock, local-only — no backend endpoint yet)
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [groupFormMode, setGroupFormMode] = useState<"create" | "edit">("create");
  const [groupFormTarget, setGroupFormTarget] = useState<OrganizationGroup | null>(null);
  const [groupFormName, setGroupFormName] = useState("");
  const [groupFormDescription, setGroupFormDescription] = useState("");
  const [groupToDelete, setGroupToDelete] = useState<OrganizationGroup | null>(null);

  // Create/edit/delete permission catalog entries (mock, local-only — no backend endpoint yet)
  const [permissionCatalog, setPermissionCatalog] = useState<MockPermission[]>(DEFAULT_PERMISSIONS);
  const [permissionFormOpen, setPermissionFormOpen] = useState(false);
  const [permissionFormMode, setPermissionFormMode] = useState<"create" | "edit">("create");
  const [permissionFormTarget, setPermissionFormTarget] = useState<MockPermission | null>(null);
  const [permissionFormKey, setPermissionFormKey] = useState("");
  const [permissionFormDescription, setPermissionFormDescription] = useState("");
  const [permissionFormError, setPermissionFormError] = useState<string | null>(null);
  const [permissionToDelete, setPermissionToDelete] = useState<MockPermission | null>(null);

  // Fetch all data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const loadMembers = fetchOrganizationMembers()
      .then((membersData) => {
        if (!cancelled) setMembers(membersData);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load members");
        }
      });

    const loadGroups = fetchOrganizationGroups()
      .then((groupsData) => {
        if (cancelled) return;
        setGroups(groupsData);
        setGroupPermissions(
          Object.fromEntries(groupsData.map((group) => [
            group.id,
            mockPermissionsForGroup(group.name),
          ])),
        );

        void fetchOrganizationGroup(FEATURED_GROUP_ID)
          .then((detail) => {
            if (!cancelled) setFeaturedGroup(detail);
          })
          .catch(() => {
            if (!cancelled) setFeaturedGroup(null);
          });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load groups");
        }
      });

    Promise.allSettled([loadMembers, loadGroups]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // Open member detail — load their groups
  const openMemberDetail = async (member: OrganizationMember) => {
    setSelectedMember(member);
    setMemberGroups([]);
    setMemberGroupsLoading(true);
    try {
      const data = await fetchMemberGroups(member.userId);
      setMemberGroups(data);
    } catch {
      setMemberGroups([]);
    } finally {
      setMemberGroupsLoading(false);
    }
  };

  // Open group detail — load its members
  const openGroupDetail = async (group: OrganizationGroup) => {
    setSelectedGroup(group);
    setGroupMembers([]);
    setGroupMembersError(null);
    setSelectedNewUserId("");
    setGroupMembersLoading(true);
    try {
      const data = await fetchGroupMembers(group.id);
      setGroupMembers(data);
    } catch {
      setGroupMembers([]);
    } finally {
      setGroupMembersLoading(false);
    }
  };

  const handleAddGroupMember = async () => {
    if (!selectedGroup || !selectedNewUserId) return;
    setAddMemberLoading(true);
    setGroupMembersError(null);
    try {
      await addGroupMember(selectedGroup.id, selectedNewUserId);
      const data = await fetchGroupMembers(selectedGroup.id);
      setGroupMembers(data);
      setSelectedNewUserId("");
    } catch (err) {
      setGroupMembersError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleRemoveGroupMember = async (membershipId: string) => {
    if (!selectedGroup) return;
    setRemovingMemberId(membershipId);
    setGroupMembersError(null);
    try {
      await removeGroupMember(selectedGroup.id, membershipId);
      const data = await fetchGroupMembers(selectedGroup.id);
      setGroupMembers(data);
    } catch (err) {
      setGroupMembersError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const availableMembersToAdd = members.filter(
    (m) => !groupMembers.some((gm) => gm.userId === m.userId),
  );

  const openPermGroupDetail = (group: OrganizationGroup) => {
    setSelectedPermGroup(group);
    setNewPermSelection("");
  };

  const addPermissionToGroup = () => {
    if (!selectedPermGroup || !newPermSelection) return;
    setGroupPermissions((prev) => ({
      ...prev,
      [selectedPermGroup.id]: [...(prev[selectedPermGroup.id] ?? []), newPermSelection],
    }));
    setNewPermSelection("");
  };

  const removePermissionFromGroup = (perm: string) => {
    if (!selectedPermGroup) return;
    setGroupPermissions((prev) => ({
      ...prev,
      [selectedPermGroup.id]: (prev[selectedPermGroup.id] ?? []).filter((p) => p !== perm),
    }));
  };

  const availablePermissionsToAdd = permissionCatalog
    .map((permission) => permission.key)
    .filter((permission) =>
      !(groupPermissions[selectedPermGroup?.id ?? ""] ?? []).includes(permission),
    );

  // Mock, local-only — no backend endpoint yet for group permissions
  // Mock, local-only — no backend endpoint yet for group creation/editing/deletion
  const openCreateGroup = () => {
    setGroupFormMode("create");
    setGroupFormTarget(null);
    setGroupFormName("");
    setGroupFormDescription("");
    setGroupFormOpen(true);
  };

  const openEditGroup = (group: OrganizationGroup) => {
    setGroupFormMode("edit");
    setGroupFormTarget(group);
    setGroupFormName(group.name);
    setGroupFormDescription(group.description ?? "");
    setGroupFormOpen(true);
  };

  const handleSubmitGroupForm = () => {
    const name = groupFormName.trim();
    if (!name) return;
    const description = groupFormDescription.trim() || undefined;

    if (groupFormMode === "create") {
      const newGroup: OrganizationGroup = {
        id: crypto.randomUUID(),
        name,
        description,
        memberCount: 0,
      };
      setGroups((prev) => [...prev, newGroup]);
      setGroupPermissions((prev) => ({
        ...prev,
        [newGroup.id]: mockPermissionsForGroup(newGroup.name),
      }));
    } else if (groupFormTarget) {
      setGroups((prev) =>
        prev.map((g) => (g.id === groupFormTarget.id ? { ...g, name, description } : g)),
      );
    }

    setGroupFormOpen(false);
  };

  const handleDeleteGroup = () => {
    if (!groupToDelete) return;
    const deletedId = groupToDelete.id;
    setGroups((prev) => prev.filter((g) => g.id !== deletedId));
    setGroupPermissions((prev) => {
      const next = { ...prev };
      delete next[deletedId];
      return next;
    });
    if (selectedGroup?.id === deletedId) setSelectedGroup(null);
    if (selectedPermGroup?.id === deletedId) setSelectedPermGroup(null);
    setGroupToDelete(null);
  };

  const openCreatePermission = () => {
    setPermissionFormMode("create");
    setPermissionFormTarget(null);
    setPermissionFormKey("");
    setPermissionFormDescription("");
    setPermissionFormError(null);
    setPermissionFormOpen(true);
  };

  const openEditPermission = (permission: MockPermission) => {
    setPermissionFormMode("edit");
    setPermissionFormTarget(permission);
    setPermissionFormKey(permission.key);
    setPermissionFormDescription(permission.description);
    setPermissionFormError(null);
    setPermissionFormOpen(true);
  };

  const handleSubmitPermissionForm = () => {
    const key = permissionFormKey.trim();
    if (!key) return;
    const description = permissionFormDescription.trim();
    const duplicate = permissionCatalog.some(
      (permission) =>
        permission.key === key && permission.key !== permissionFormTarget?.key,
    );
    if (duplicate) {
      setPermissionFormError("A permission with this key already exists.");
      return;
    }

    if (permissionFormMode === "create") {
      setPermissionCatalog((prev) => [...prev, { key, description }]);
    } else if (permissionFormTarget) {
      const oldKey = permissionFormTarget.key;
      setPermissionCatalog((prev) =>
        prev.map((permission) =>
          permission.key === oldKey ? { key, description } : permission,
        ),
      );
      if (oldKey !== key) {
        setGroupPermissions((prev) =>
          Object.fromEntries(
            Object.entries(prev).map(([groupId, keys]) => [
              groupId,
              Array.from(new Set(keys.map((value) => value === oldKey ? key : value))),
            ]),
          ),
        );
      }
    }
    setPermissionFormOpen(false);
  };

  const handleDeletePermission = () => {
    if (!permissionToDelete) return;
    const deletedKey = permissionToDelete.key;
    setPermissionCatalog((prev) =>
      prev.filter((permission) => permission.key !== deletedKey),
    );
    setGroupPermissions((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([groupId, keys]) => [
          groupId,
          keys.filter((key) => key !== deletedKey),
        ]),
      ),
    );
    setPermissionToDelete(null);
  };

  // Mock, local-only — no backend endpoint yet for permission catalog management
  return (
    <>
      <Helmet>
        <title>User Management · Rsolve GRC Platform</title>
        <meta name="description" content="View organisation members, groups and group assignments." />
        <link rel="canonical" href="/settings/users" />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        <TopNav />

        <main className="flex-1 px-5 md:px-10 py-8 md:py-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">User Management</span>
          </nav>

          <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[25px] font-semibold tracking-tight text-foreground">User Management</h1>
              <p className="text-[13.5px] text-muted-foreground mt-0.5 max-w-2xl">
                View organisation members and groups. Select a user to see their group assignments,
                or select a group to see its members.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
              </Link>
            </Button>
          </header>

          {!isAdmin && (
            <Card className="p-4 mb-5 border-warn/40 bg-warn/5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-warn mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Read-only view</p>
                  <p className="text-xs text-muted-foreground">Some management features are restricted to administrators.</p>
                </div>
              </div>
            </Card>
          )}

          {error && (
            <Card className="p-4 mb-5 border-destructive/40 bg-destructive/5">
              <p className="text-sm text-destructive">{error}</p>
            </Card>
          )}

          <Tabs defaultValue="users">
            <TabsList className="mb-5">
              <TabsTrigger value="users" className="gap-2">
                <Users className="w-4 h-4" /> All Users
                {!loading && <Badge variant="secondary" className="text-[10px]">{members.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-2">
                <Layers className="w-4 h-4" /> Groups
                {!loading && <Badge variant="secondary" className="text-[10px]">{groups.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="permissions" className="gap-2">
                <ShieldCheck className="w-4 h-4" /> Group Permissions
              </TabsTrigger>
              <TabsTrigger value="permission-catalog" className="gap-2">
                <KeyRound className="w-4 h-4" /> Permissions
                <Badge variant="secondary" className="text-[10px]">
                  {permissionCatalog.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* ──────── All Users tab ──────── */}
            <TabsContent value="users">
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Organisation Members</h2>
                </div>

                {loading ? (
                  <div className="text-center py-10">
                    <div className="inline-block w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground mt-2">Loading members…</p>
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-muted-foreground">No members found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-2 font-semibold">Name</th>
                          <th className="text-left px-4 py-2 font-semibold">Email</th>
                          <th className="text-left px-4 py-2 font-semibold">Username</th>
                          <th className="text-right px-4 py-2 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => (
                          <tr key={m.membershipId} className="border-b border-border last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <UserCircle2 className="w-7 h-7 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="font-medium text-foreground">{m.fullName}</p>
                                  {m.membershipStatus && (
                                    <Badge variant="outline" className="text-[10px] mt-0.5">{m.membershipStatus}</Badge>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="w-3 h-3" /> {m.email}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                              {m.username}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => setViewedMember(m)}
                                >
                                  <Eye className="w-3 h-3" /> View
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => openMemberDetail(m)}
                                >
                                  <Hash className="w-3 h-3" /> View Groups
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* ──────── Groups tab ──────── */}
            <TabsContent value="groups">
              {isAdmin && (
                <Card className="p-4 mb-4 border-brand-accent/30 bg-brand-accent/5">
                  <p className="text-xs text-muted-foreground">
                    Placeholder data — creating, editing and deleting groups is a local mock.
                    There's no backend endpoint for group management yet (only membership
                    assignment is live), so changes here are local to this session and not saved.
                  </p>
                </Card>
              )}
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground">Organisation Groups</h2>
                  </div>
                  {isAdmin && (
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={openCreateGroup}>
                      <Plus className="w-3.5 h-3.5" /> Create Group
                    </Button>
                  )}
                </div>

                {loading ? (
                  <div className="text-center py-10">
                    <div className="inline-block w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground mt-2">Loading groups…</p>
                  </div>
                ) : groups.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-muted-foreground">No groups found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-2 font-semibold">Group Name</th>
                           <th className="text-left px-4 py-2 font-semibold">Description</th>
                           <th className="text-center px-4 py-2 font-semibold">Members</th>
                           <th className="text-left px-4 py-2 font-semibold">Permissions</th>
                           <th className="text-right px-4 py-2 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((g) => (
                          <tr key={g.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-medium text-foreground">{g.name}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                              {g.description || "—"}
                            </td>
                             <td className="px-4 py-2.5 text-center">
                               {(g.id === FEATURED_GROUP_ID
                                 ? featuredGroup?.memberCount
                                 : g.memberCount) != null && (
                                 <Badge variant="secondary" className="text-[10px]">
                                   {g.id === FEATURED_GROUP_ID
                                     ? featuredGroup?.memberCount
                                     : g.memberCount}
                                 </Badge>
                               )}
                             </td>
                             <td className="px-4 py-2.5">
                               {g.id !== FEATURED_GROUP_ID || !featuredGroup ? (
                                 <span className="text-xs text-muted-foreground">—</span>
                               ) : featuredGroup.permissions.length === 0 ? (
                                 <span className="text-xs text-muted-foreground">
                                   No permissions assigned.
                                 </span>
                               ) : (
                                 <div className="flex flex-wrap gap-1.5">
                                   {featuredGroup.permissions.map((permission) => (
                                     <Badge
                                       key={permission.id}
                                       variant="outline"
                                       className="text-[10px] font-mono"
                                     >
                                       {permission.code}
                                     </Badge>
                                   ))}
                                 </div>
                               )}
                             </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => openGroupDetail(g)}
                                >
                                  <Users className="w-3 h-3" /> View Members
                                </Button>
                                {isAdmin && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => openEditGroup(g)}
                                    >
                                      <Pencil className="w-3 h-3" /> Edit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                                      onClick={() => setGroupToDelete(g)}
                                    >
                                      <Trash2 className="w-3 h-3" /> Delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* ──────── Group Permissions tab ──────── */}
            <TabsContent value="permissions">
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">Group Permissions</h2>
                </div>

                {loading ? (
                  <div className="text-center py-10">
                    <div className="inline-block w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground mt-2">Loading groups…</p>
                  </div>
                ) : groups.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-muted-foreground">No groups found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-2 font-semibold">Group Name</th>
                          <th className="text-left px-4 py-2 font-semibold">Permissions</th>
                          <th className="text-right px-4 py-2 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((g) => (
                          <tr key={g.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-medium text-foreground align-top whitespace-nowrap">{g.name}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1.5">
                                {(groupPermissions[g.id] ?? []).length === 0 ? (
                                  <span className="text-xs text-muted-foreground">No permissions assigned.</span>
                                ) : (
                                  (groupPermissions[g.id] ?? []).map((permission) => (
                                    <Badge key={permission} variant="outline" className="text-[10px] font-mono">
                                      {permission}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right align-top">
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => openPermGroupDetail(g)}
                                >
                                  <ShieldCheck className="w-3 h-3" /> Manage
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* ──────── Permission Catalog tab ──────── */}
            <TabsContent value="permission-catalog">
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground">Permissions</h2>
                  </div>
                  {isAdmin && (
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={openCreatePermission}>
                      <Plus className="w-3.5 h-3.5" /> Create Permission
                    </Button>
                  )}
                </div>
                {permissionCatalog.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No permissions defined.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-2 font-semibold">Key</th>
                          <th className="text-left px-4 py-2 font-semibold">Description</th>
                          <th className="text-right px-4 py-2 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permissionCatalog.map((permission) => (
                          <tr key={permission.key} className="border-b border-border last:border-0">
                            <td className="px-4 py-2.5 font-mono text-xs">{permission.key}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                              {permission.description || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {isAdmin && (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openEditPermission(permission)}>
                                    <Pencil className="w-3 h-3" /> Edit
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive" onClick={() => setPermissionToDelete(permission)}>
                                    <Trash2 className="w-3 h-3" /> Delete
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* ── User details dialog ── */}
      <Dialog open={!!viewedMember} onOpenChange={(o) => !o && setViewedMember(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle2 className="w-5 h-5" />
              {viewedMember?.fullName}
            </DialogTitle>
            <DialogDescription>
              {viewedMember?.email} &middot; {viewedMember?.username}
            </DialogDescription>
          </DialogHeader>

          {viewedMember && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-muted/20">
                <BadgeCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground">Status</p>
                  <p className="text-sm font-medium text-foreground">{viewedMember.membershipStatus || "—"}</p>
                </div>
                {viewedMember.primary && (
                  <Badge variant="secondary" className="text-[10px]">Primary</Badge>
                )}
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-muted/20">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Joined</p>
                  <p className="text-sm font-medium text-foreground">
                    {viewedMember.joinedAt ? new Date(viewedMember.joinedAt).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">User ID</span>
                  <span className="text-xs font-mono text-foreground truncate">{viewedMember.userId}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">Membership ID</span>
                  <span className="text-xs font-mono text-foreground truncate">{viewedMember.membershipId}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Member detail dialog (shows groups for this member) ── */}
      <Dialog open={!!selectedMember} onOpenChange={(o) => !o && setSelectedMember(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle2 className="w-5 h-5" />
              {selectedMember?.fullName}
            </DialogTitle>
            <DialogDescription>
              {selectedMember?.email} &middot; {selectedMember?.username}
            </DialogDescription>
          </DialogHeader>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Hash className="w-4 h-4 text-muted-foreground" />
              Assigned Groups
            </h4>

            {memberGroupsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <div className="inline-block w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Loading groups…
              </div>
            ) : memberGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Not assigned to any groups.</p>
            ) : (
              <div className="space-y-2">
                {memberGroups.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{g.name}</p>
                      {g.description && (
                        <p className="text-xs text-muted-foreground">{g.description}</p>
                      )}
                    </div>
                    {g.memberCount != null && (
                      <Badge variant="secondary" className="text-[10px]">{g.memberCount} members</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Group detail dialog (shows members in this group) ── */}
      <Dialog open={!!selectedGroup} onOpenChange={(o) => !o && setSelectedGroup(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              {selectedGroup?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedGroup?.description || "Group members"}
              {selectedGroup?.memberCount != null && ` · ${selectedGroup.memberCount} members`}
            </DialogDescription>
          </DialogHeader>

          <div>
            {isAdmin && (
              <div className="flex items-center gap-2 mb-4">
                <Select value={selectedNewUserId} onValueChange={setSelectedNewUserId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select a user to add…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMembersToAdd.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.fullName} ({m.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-9 gap-1.5 shrink-0"
                  disabled={!selectedNewUserId || addMemberLoading}
                  onClick={handleAddGroupMember}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {addMemberLoading ? "Adding…" : "Add"}
                </Button>
              </div>
            )}

            {groupMembersError && (
              <p className="text-xs text-destructive mb-3">{groupMembersError}</p>
            )}

            {groupMembersLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <div className="inline-block w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Loading members…
              </div>
            ) : groupMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No members in this group.</p>
            ) : (
              <div className="space-y-2">
                {groupMembers.map((gm) => (
                  <div
                    key={gm.userId}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20"
                  >
                    <UserCircle2 className="w-8 h-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{gm.fullName}</p>
                      <p className="text-xs text-muted-foreground">{gm.email}</p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                        disabled={removingMemberId === gm.userId}
                        onClick={() => handleRemoveGroupMember(gm.userId)}
                      >
                        <Trash2 className="w-3 h-3" />
                        {removingMemberId === gm.userId ? "Removing…" : "Remove"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedPermGroup} onOpenChange={(open) => !open && setSelectedPermGroup(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              {selectedPermGroup?.name}
            </DialogTitle>
            <DialogDescription>
              Add or remove permissions for this group. Changes are local to this session only.
            </DialogDescription>
          </DialogHeader>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Select value={newPermSelection} onValueChange={setNewPermSelection}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select a permission to add…" />
                </SelectTrigger>
                <SelectContent>
                  {availablePermissionsToAdd.map((permission) => (
                    <SelectItem key={permission} value={permission}>{permission}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!newPermSelection} onClick={addPermissionToGroup}>
                <UserPlus className="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {(groupPermissions[selectedPermGroup?.id ?? ""] ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No permissions assigned.</p>
            ) : (
              (groupPermissions[selectedPermGroup?.id ?? ""] ?? []).map((permission) => (
                <Badge key={permission} variant="outline" className="font-mono gap-1.5">
                  {permission}
                  {isAdmin && (
                    <button onClick={() => removePermissionFromGroup(permission)} aria-label={`Remove ${permission}`}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </Badge>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create/edit group dialog (mock, local-only) ── */}
      <Dialog open={groupFormOpen} onOpenChange={setGroupFormOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{groupFormMode === "create" ? "Create Group" : "Edit Group"}</DialogTitle>
            <DialogDescription>
              {groupFormMode === "create"
                ? "Add a new group. This is a local mock — not saved to the backend."
                : "Update this group's name and description. This is a local mock — not saved to the backend."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={groupFormName}
                onChange={(e) => setGroupFormName(e.target.value)}
                placeholder="e.g. Risk Managers"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-description">Description</Label>
              <Textarea
                id="group-description"
                value={groupFormDescription}
                onChange={(e) => setGroupFormDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitGroupForm} disabled={!groupFormName.trim()}>
              {groupFormMode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete group confirmation (mock, local-only) ── */}
      <AlertDialog open={!!groupToDelete} onOpenChange={(o) => !o && setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{groupToDelete?.name}" from this local mock view. This is not
              saved to the backend and will reappear if the page reloads.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteGroup}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={permissionFormOpen} onOpenChange={setPermissionFormOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {permissionFormMode === "create" ? "Create Permission" : "Edit Permission"}
            </DialogTitle>
            <DialogDescription>
              Changes to this permission catalog are local to this session only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="permission-key">Key</Label>
              <Input
                id="permission-key"
                value={permissionFormKey}
                onChange={(event) => {
                  setPermissionFormKey(event.target.value);
                  setPermissionFormError(null);
                }}
              />
              {permissionFormError && <p className="text-xs text-destructive">{permissionFormError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="permission-description">Description</Label>
              <Textarea
                id="permission-description"
                value={permissionFormDescription}
                onChange={(event) => setPermissionFormDescription(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitPermissionForm} disabled={!permissionFormKey.trim()}>
              {permissionFormMode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!permissionToDelete} onOpenChange={(open) => !open && setPermissionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permission?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes "{permissionToDelete?.key}" from the local catalog and group assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={handleDeletePermission}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
};

export default UserManagement;
