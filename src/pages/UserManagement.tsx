import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Hash,
  Layers,
  Mail,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserCircle2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/grc/TopNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveUser } from "@/hooks/use-active-user";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/data/userStore";
import {
  activateOrganizationGroup,
  addGroupMember,
  createOrganizationGroup,
  deactivateOrganizationGroup,
  fetchGroupMembers,
  fetchGroupPermissions,
  fetchMemberGroups,
  fetchOrganizationGroup,
  fetchOrganizationGroups,
  fetchOrganizationMembers,
  fetchPermissionCatalog,
  removeGroupMember,
  updateGroupPermissions,
  updateOrganizationGroup,
} from "@/lib/organization";
import type {
  GroupMember,
  OrganizationGroup,
  OrganizationGroupDetail,
  OrganizationMember,
  OrganizationPermission,
} from "@/lib/auth-types";

type LoadState = "idle" | "loading" | "ready" | "error";

const fallbackText = "Unknown";

function useOrganizationId() {
  const { organization } = useAuth();
  return organization?.id ?? "";
}

function statusLabel(status?: string, active?: boolean) {
  if (typeof active === "boolean") return active ? "active" : "inactive";
  return status?.trim() || fallbackText;
}

function isInactiveStatus(status?: string, active?: boolean) {
  if (typeof active === "boolean") return !active;
  const normalized = status?.toLowerCase() ?? "";
  return ["inactive", "deactivated", "disabled"].includes(normalized);
}

function formatDate(value?: string) {
  if (!value) return fallbackText;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallbackText;
  return date.toLocaleDateString();
}

function deriveGroupCode(name: string) {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function ManagementLayout({
  title,
  description,
  canonical,
  children,
}: {
  title: string;
  description: string;
  canonical: string;
  children: ReactNode;
}) {
  return (
    <>
      <Helmet>
        <title>{title} - Rsolve GRC Platform</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        <TopNav />
        <main className="flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-9">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/settings/users" className="hover:text-foreground transition-colors">User Management</Link>
            {canonical !== "/settings/users" && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-foreground font-medium">{title.replace(" - Rsolve GRC Platform", "")}</span>
              </>
            )}
          </nav>

          {children}
        </main>
      </div>
    </>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="text-center py-10">
      <div className="inline-block w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground mt-2">{label}</p>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <Card className="p-4 border-destructive/40 bg-destructive/5">
      <p className="text-sm text-destructive">{message}</p>
    </Card>
  );
}

function StatusBadge({ status, active }: { status?: string; active?: boolean }) {
  return (
    <Badge variant={isInactiveStatus(status, active) ? "destructive" : "outline"} className="text-[10px]">
      {statusLabel(status, active)}
    </Badge>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-1 break-words">{value || fallbackText}</p>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

type PermissionDisplay = string | OrganizationPermission;

function permissionKey(permission: PermissionDisplay) {
  return typeof permission === "string" ? permission : permission.id || permission.code;
}

function permissionCode(permission: PermissionDisplay) {
  return typeof permission === "string" ? permission : permission.code;
}

function permissionName(permission: PermissionDisplay) {
  return typeof permission === "string" ? permission : permission.name || permission.code;
}

function permissionScope(permission: PermissionDisplay) {
  return typeof permission === "string" ? "" : permission.scopeType;
}

function PermissionsList({
  permissions,
  emptyText,
  showCode = true,
}: {
  permissions: PermissionDisplay[];
  emptyText: string;
  showCode?: boolean;
}) {
  if (permissions.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {permissions.map((permission) => (
        <Badge
          key={permissionKey(permission)}
          variant="outline"
          className="max-w-full gap-1.5 px-2.5 py-1 text-[11px]"
          title={permissionName(permission)}
        >
          <span className="font-medium">{permissionName(permission)}</span>
          {showCode && permissionName(permission) !== permissionCode(permission) && (
            <span className="font-mono text-muted-foreground break-all">{permissionCode(permission)}</span>
          )}
          {permissionScope(permission) && (
            <span className="text-muted-foreground">({permissionScope(permission)})</span>
          )}
        </Badge>
      ))}
    </div>
  );
}

function PageHeader({
  title,
  description,
  backTo = "/settings/users",
  backLabel = "Back",
  actions,
}: {
  title: string;
  description: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {actions}
        <Button asChild variant="outline" size="sm">
          <Link to={backTo}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> {backLabel}
          </Link>
        </Button>
      </div>
    </header>
  );
}

export const UserManagement = () => {
  const orgId = useOrganizationId();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeUser = useActiveUser();
  const isAdmin = can.manageUsers(activeUser.role);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [groups, setGroups] = useState<OrganizationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberToDeactivate, setMemberToDeactivate] = useState<OrganizationMember | null>(null);
  const [groupToToggle, setGroupToToggle] = useState<OrganizationGroup | null>(null);
  const activeTab = searchParams.get("tab") === "groups" ? "groups" : "users";
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const loadIndexData = async () => {
    if (!orgId) {
      setError("No active organization was found for this session.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [membersData, groupsData] = await Promise.all([
        fetchOrganizationMembers(orgId),
        fetchOrganizationGroups(orgId),
      ]);
      setMembers(membersData);
      setGroups(groupsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIndexData();
  }, [orgId]);

  const handleTabChange = (value: string) => {
    setSearchParams(value === "groups" ? { tab: "groups" } : {});
  };

  const handleCreateGroup = async () => {
    const name = groupName.trim();
    if (!orgId || !name) return;

    setCreatingGroup(true);
    try {
      const created = await createOrganizationGroup(orgId, {
        code: deriveGroupCode(name),
        name,
      });
      await deactivateOrganizationGroup(orgId, created.id);
      const inactiveGroup = { ...created, active: false, status: "inactive" };
      setGroups((current) => [...current, inactiveGroup]);
      setGroupName("");
      setCreateOpen(false);
      toast.success("Group created as inactive");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleToggleGroup = async () => {
    if (!orgId || !groupToToggle) return;

    const nextActive = isInactiveStatus(groupToToggle.status, groupToToggle.active);
    const target = groupToToggle;
    setGroupToToggle(null);
    setGroups((current) =>
      current.map((group) =>
        group.id === target.id
          ? { ...group, active: nextActive, status: nextActive ? "active" : "inactive" }
          : group,
      ),
    );

    try {
      if (nextActive) {
        await activateOrganizationGroup(orgId, target.id);
        toast.success("Group activated");
      } else {
        await deactivateOrganizationGroup(orgId, target.id);
        toast.success("Group deactivated");
      }
    } catch (err) {
      setGroups((current) =>
        current.map((group) => (group.id === target.id ? target : group)),
      );
      toast.error(err instanceof Error ? err.message : "Failed to update group status");
    }
  };

  const handleDeactivateMember = () => {
    if (!memberToDeactivate) return;
    const target = memberToDeactivate;
    setMembers((current) =>
      current.map((member) =>
        member.membershipId === target.membershipId
          ? { ...member, membershipStatus: "inactive" }
          : member,
      ),
    );
    setMemberToDeactivate(null);
    toast.info("User deactivation is pending backend support");
  };

  return (
    <ManagementLayout
      title="User Management"
      description="View organization members, groups, and group assignments."
      canonical="/settings/users"
    >
      <PageHeader
        title="User Management"
        description="Review organization members and manage backend-backed groups."
        backTo="/dashboard"
      />

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

      {error && <div className="mb-5"><ErrorPanel message={error} /></div>}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-5">
          <TabsTrigger value="users" className="gap-2" onClick={() => handleTabChange("users")}>
            <Users className="w-4 h-4" /> Users
            {!loading && <Badge variant="secondary" className="text-[10px]">{members.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-2" onClick={() => handleTabChange("groups")}>
            <Layers className="w-4 h-4" /> Groups
            {!loading && <Badge variant="secondary" className="text-[10px]">{groups.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Users</h2>
            </div>

            {loading ? (
              <LoadingPanel label="Loading members..." />
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No members found.</p>
            ) : (
              <div className="max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold">Name</th>
                      <th className="text-left px-4 py-2 font-semibold">Email</th>
                      <th className="text-left px-4 py-2 font-semibold">Username</th>
                      <th className="text-left px-4 py-2 font-semibold">Status</th>
                      <th className="text-left px-4 py-2 font-semibold">Date Joined</th>
                      <th className="text-right px-4 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.membershipId} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <UserCircle2 className="w-7 h-7 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground">{member.fullName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="w-3 h-3" /> {member.email}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{member.username}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={member.membershipStatus} /></td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(member.joinedAt)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button asChild variant="ghost" size="sm" className="min-h-8 h-auto text-sm gap-1">
                              <Link to={`/settings/users/members/${member.membershipId}`}>
                                <Eye className="w-3 h-3" /> View
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm" className="min-h-8 h-auto text-sm gap-1">
                              <Link to={`/settings/users/members/${member.membershipId}/edit`}>
                                <Pencil className="w-3 h-3" /> Edit
                              </Link>
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-8 h-auto text-sm gap-1 text-destructive hover:text-destructive"
                                onClick={() => setMemberToDeactivate(member)}
                              >
                                <XCircle className="w-3 h-3" /> Deactivate
                              </Button>
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

        <TabsContent value="groups">
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Groups</h2>
              </div>
              {isAdmin && (
                <Button size="sm" className="min-h-9 h-auto text-sm gap-1" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> Create Group
                </Button>
              )}
            </div>

            {loading ? (
              <LoadingPanel label="Loading groups..." />
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No groups found.</p>
            ) : (
              <div className="max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold">Name</th>
                      <th className="text-left px-4 py-2 font-semibold">Description</th>
                      <th className="text-center px-4 py-2 font-semibold">Member Count</th>
                      <th className="text-left px-4 py-2 font-semibold">Status</th>
                      <th className="text-right px-4 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <tr key={group.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-medium text-foreground">{group.name}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{group.description || fallbackText}</td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant="secondary" className="text-[10px]">{group.memberCount ?? 0}</Badge>
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge status={group.status} active={group.active} /></td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button asChild variant="ghost" size="sm" className="min-h-8 h-auto text-sm gap-1">
                              <Link to={`/settings/users/groups/${group.id}`}>
                                <Eye className="w-3 h-3" /> View
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm" className="min-h-8 h-auto text-sm gap-1">
                              <Link to={`/settings/users/groups/${group.id}/members`}>
                                <Users className="w-3 h-3" /> View Members
                              </Link>
                            </Button>
                            {isAdmin && (
                              <>
                                <Button asChild variant="ghost" size="sm" className="min-h-8 h-auto text-sm gap-1">
                                  <Link to={`/settings/users/groups/${group.id}/edit`}>
                                    <Pencil className="w-3 h-3" /> Edit
                                  </Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-8 h-auto text-sm gap-1"
                                  onClick={() => setGroupToToggle(group)}
                                >
                                  {isInactiveStatus(group.status, group.active) ? (
                                    <>
                                      <Check className="w-3 h-3" /> Activate
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3 h-3" /> Deactivate
                                    </>
                                  )}
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
      </Tabs>

      <AlertDialog open={!!memberToDeactivate} onOpenChange={(open) => !open && setMemberToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
            <AlertDialogDescription>
              This updates the table optimistically. The backend endpoint for user deactivation has not been provided yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeactivateMember}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!groupToToggle} onOpenChange={(open) => !open && setGroupToToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isInactiveStatus(groupToToggle?.status, groupToToggle?.active) ? "Activate group?" : "Deactivate group?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will update the group status for "{groupToToggle?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleGroup}>
              {isInactiveStatus(groupToToggle?.status, groupToToggle?.active) ? "Activate" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create group</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the group name. The group code will be generated from the name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="e.g. Editors"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creatingGroup}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!groupName.trim() || creatingGroup} onClick={handleCreateGroup}>
              {creatingGroup ? "Creating..." : "Create"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagementLayout>
  );
};

function useMember(memberId?: string) {
  const orgId = useOrganizationId();
  const [member, setMember] = useState<OrganizationMember | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!orgId || !memberId) {
        setState("error");
        setError("No active organization or member id was found.");
        return;
      }

      setState("loading");
      setError(null);
      try {
        const members = await fetchOrganizationMembers(orgId);
        const found = members.find(
          (item) => item.membershipId === memberId || item.userId === memberId,
        );
        if (!found) throw new Error("Member was not found.");
        if (!cancelled) {
          setMember(found);
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load member");
          setState("error");
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [orgId, memberId]);

  return { orgId, member, state, error };
}

export function UserMemberView() {
  const { memberId } = useParams();
  const { permissions: authPermissions } = useAuth();
  const { orgId, member, state, error } = useMember(memberId);
  const viewedUserId = member?.userId;
  const [groups, setGroups] = useState<OrganizationGroup[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const permissions = useMemo(() => Array.from(new Set(authPermissions)), [authPermissions]);

  useEffect(() => {
    let cancelled = false;
    const loadDetails = async () => {
      if (!orgId || !viewedUserId || state !== "ready") return;

      setDetailsLoading(true);
      try {
        const assignedGroups = await fetchMemberGroups(orgId, viewedUserId);
        if (!cancelled) {
          setGroups(assignedGroups);
        }
      } catch {
        if (!cancelled) {
          setGroups([]);
        }
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    };

    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [orgId, viewedUserId, state]);

  return (
    <ManagementLayout
      title="User Profile"
      description="View user profile, assigned groups, and permissions."
      canonical={`/settings/users/members/${memberId ?? ""}`}
    >
      <PageHeader
        title={member?.fullName ?? "User Profile"}
        description="Profile information, group assignments, and inherited permissions."
        actions={
          member && (
            <Button asChild size="sm" className="gap-1.5">
              <Link to={`/settings/users/members/${member.membershipId}/edit`}>
                <Pencil className="w-4 h-4" /> Edit
              </Link>
            </Button>
          )
        }
      />

      {state === "loading" && <LoadingPanel label="Loading profile..." />}
      {state === "error" && <ErrorPanel message={error ?? "Failed to load profile"} />}
      {state === "ready" && member && (
        <div className="space-y-5">
          <SectionCard icon={<UserCircle2 className="w-4 h-4 text-muted-foreground" />} title="Profile Info">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="Name" value={member.fullName} />
              <DetailRow label="Email" value={member.email} />
              <DetailRow label="Username" value={member.username} />
              <DetailRow label="Status" value={statusLabel(member.membershipStatus)} />
              <DetailRow label="Date Joined" value={formatDate(member.joinedAt)} />
            </div>
          </SectionCard>

          <SectionCard icon={<Layers className="w-4 h-4 text-muted-foreground" />} title="Groups">
            {detailsLoading ? (
              <LoadingPanel label="Loading groups..." />
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not assigned to any groups.</p>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <div key={group.id} className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.description || fallbackText}</p>
                    </div>
                    <StatusBadge status={group.status} active={group.active} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon={<ShieldCheck className="w-4 h-4 text-muted-foreground" />} title="Permissions">
            <PermissionsList
              permissions={permissions}
              emptyText="No permissions were found in the current auth session."
            />
          </SectionCard>
        </div>
      )}
    </ManagementLayout>
  );
}

export function UserMemberEdit() {
  const { memberId } = useParams();
  const { member, state, error } = useMember(memberId);

  return (
    <ManagementLayout
      title="Edit User"
      description="Review user fields before backend editing is available."
      canonical={`/settings/users/members/${memberId ?? ""}/edit`}
    >
      <PageHeader title="Edit User" description="User editing is prepared as a page and waiting for the backend update endpoint." />

      {state === "loading" && <LoadingPanel label="Loading user..." />}
      {state === "error" && <ErrorPanel message={error ?? "Failed to load user"} />}
      {state === "ready" && member && (
        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={member.fullName} readOnly disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" value={member.email} readOnly disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-username">Username</Label>
              <Input id="edit-username" value={member.username} readOnly disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <Input id="edit-status" value={statusLabel(member.membershipStatus)} readOnly disabled />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button disabled>Save changes</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Saving is disabled until the user update endpoint is provided.
          </p>
        </Card>
      )}
    </ManagementLayout>
  );
}

function useGroup(groupId?: string) {
  const orgId = useOrganizationId();
  const [group, setGroup] = useState<OrganizationGroupDetail | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const loadGroup = async () => {
    if (!orgId || !groupId) {
      setState("error");
      setError("No active organization or group id was found.");
      return;
    }

    setState("loading");
    setError(null);
    try {
      const data = await fetchOrganizationGroup(orgId, groupId);
      setGroup(data);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load group");
      setState("error");
    }
  };

  useEffect(() => {
    void loadGroup();
  }, [orgId, groupId]);

  return { orgId, group, setGroup, state, error, reload: loadGroup };
}

export function GroupView() {
  const { groupId } = useParams();
  const { group, state, error } = useGroup(groupId);

  return (
    <ManagementLayout
      title="Group Details"
      description="View group details."
      canonical={`/settings/users/groups/${groupId ?? ""}`}
    >
      <PageHeader
        title={group?.name ?? "Group Details"}
        description="Group name and description from the organization group endpoint."
        backTo="/settings/users?tab=groups"
        actions={
          group && (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to={`/settings/users/groups/${group.id}/members`}>
                  <Users className="w-4 h-4" /> Members
                </Link>
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <Link to={`/settings/users/groups/${group.id}/edit`}>
                  <Pencil className="w-4 h-4" /> Edit
                </Link>
              </Button>
            </div>
          )
        }
      />

      {state === "loading" && <LoadingPanel label="Loading group..." />}
      {state === "error" && <ErrorPanel message={error ?? "Failed to load group"} />}
      {state === "ready" && group && (
        <div className="space-y-5">
          <SectionCard icon={<Layers className="w-4 h-4 text-muted-foreground" />} title="Group Details">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailRow label="Name" value={group.name} />
              <DetailRow label="Code" value={group.code} />
              <DetailRow label="Description" value={group.description} />
              <DetailRow label="Status" value={statusLabel(group.status, group.active)} />
              <DetailRow label="Member Count" value={String(group.memberCount ?? 0)} />
            </div>
          </SectionCard>

          <SectionCard icon={<ShieldCheck className="w-4 h-4 text-muted-foreground" />} title="Permissions">
            <PermissionsList
              permissions={group.permissions}
              emptyText="No permissions assigned to this group."
              showCode={false}
            />
          </SectionCard>
        </div>
      )}
    </ManagementLayout>
  );
}

export function GroupMembersView() {
  const { groupId } = useParams();
  const orgId = useOrganizationId();
  const activeUser = useActiveUser();
  const isAdmin = can.manageUsers(activeUser.role);
  const [group, setGroup] = useState<OrganizationGroupDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allMembers, setAllMembers] = useState<OrganizationMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = async () => {
    if (!orgId || !groupId) {
      setError("No active organization or group id was found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [groupData, groupMembers, organizationMembers] = await Promise.all([
        fetchOrganizationGroup(orgId, groupId),
        fetchGroupMembers(orgId, groupId),
        fetchOrganizationMembers(orgId),
      ]);
      setGroup(groupData);
      setMembers(groupMembers);
      setAllMembers(organizationMembers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load group members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMembers();
  }, [orgId, groupId]);

  const availableMembers = allMembers.filter(
    (member) => !members.some((groupMember) => groupMember.userId === member.userId),
  );

  const handleAddMember = async () => {
    if (!orgId || !groupId || !selectedUserId) return;
    setBusy(true);
    try {
      await addGroupMember(orgId, groupId, selectedUserId);
      setSelectedUserId("");
      await loadMembers();
      toast.success("Member added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (member: GroupMember) => {
    if (!orgId || !groupId) return;
    setBusy(true);
    try {
      await removeGroupMember(orgId, groupId, member.membershipId ?? member.userId);
      await loadMembers();
      toast.success("Member removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ManagementLayout
      title="Group Members"
      description="View and manage group members."
      canonical={`/settings/users/groups/${groupId ?? ""}/members`}
    >
      <PageHeader
        title={group?.name ? `${group.name} Members` : "Group Members"}
        description="Users assigned to this group."
        backTo={group ? `/settings/users/groups/${group.id}` : "/settings/users?tab=groups"}
        actions={
          group && (
            <Button asChild size="sm" className="gap-1.5">
              <Link to={`/settings/users/groups/${group.id}/edit`}>
                <Pencil className="w-4 h-4" /> Edit
              </Link>
            </Button>
          )
        }
      />

      {error && <div className="mb-5"><ErrorPanel message={error} /></div>}

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Members</h2>
          </div>
          {group?.memberCount != null && (
            <Badge variant="secondary" className="text-[10px]">{group.memberCount}</Badge>
          )}
        </div>

        {isAdmin && (
          <div className="p-4 border-b border-border flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-9 text-sm">
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
            <Button
              size="sm"
              className="h-9 gap-1.5 shrink-0"
              disabled={!selectedUserId || busy}
              onClick={handleAddMember}
            >
              <UserPlus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        )}

        {loading ? (
          <LoadingPanel label="Loading members..." />
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No members in this group.</p>
        ) : (
          <div className="max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold">Name</th>
                  <th className="text-left px-4 py-2 font-semibold">Email</th>
                  <th className="text-left px-4 py-2 font-semibold">Username</th>
                  <th className="text-left px-4 py-2 font-semibold">Status</th>
                  <th className="text-right px-4 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.membershipId ?? member.userId} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium text-foreground">{member.fullName}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{member.email}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{member.username}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={member.membershipStatus} /></td>
                    <td className="px-4 py-2.5 text-right">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-8 h-auto text-sm gap-1 text-destructive hover:text-destructive"
                          disabled={busy}
                          onClick={() => handleRemoveMember(member)}
                        >
                          <XCircle className="w-3 h-3" /> Remove
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
    </ManagementLayout>
  );
}

export function GroupEdit() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { orgId, group, setGroup, state, error } = useGroup(groupId);
  const [description, setDescription] = useState("");
  const [catalog, setCatalog] = useState<OrganizationPermission[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (group) setDescription(group.description ?? "");
  }, [group]);

  useEffect(() => {
    let cancelled = false;
    const loadPermissions = async () => {
      if (!orgId || !groupId) return;
      setLoadingPermissions(true);
      try {
        const [catalogData, groupPermissions] = await Promise.all([
          fetchPermissionCatalog(),
          fetchGroupPermissions(orgId, groupId),
        ]);
        if (!cancelled) {
          setCatalog(catalogData);
          setSelectedPermissionIds(groupPermissions.map((permission) => permission.id));
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load permissions");
        }
      } finally {
        if (!cancelled) setLoadingPermissions(false);
      }
    };

    void loadPermissions();
    return () => {
      cancelled = true;
    };
  }, [orgId, groupId]);

  const selectedPermissions = useMemo(
    () => catalog.filter((permission) => selectedPermissionIds.includes(permission.id)),
    [catalog, selectedPermissionIds],
  );

  const togglePermission = (permissionId: string, checked: boolean | "indeterminate") => {
    setSelectedPermissionIds((current) => {
      if (checked === true) return Array.from(new Set([...current, permissionId]));
      return current.filter((id) => id !== permissionId);
    });
  };

  const handleSave = async () => {
    if (!orgId || !groupId) return;
    setSaving(true);
    try {
      const updated = await updateOrganizationGroup(orgId, groupId, {
        description: description.trim(),
      });
      await updateGroupPermissions(orgId, groupId, selectedPermissionIds);
      setGroup({ ...updated, description: description.trim(), permissions: selectedPermissions });
      toast.success("Group updated");
      navigate(`/settings/users/groups/${groupId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ManagementLayout
      title="Edit Group"
      description="Edit group description and permissions."
      canonical={`/settings/users/groups/${groupId ?? ""}/edit`}
    >
      <PageHeader
        title={group?.name ? `Edit ${group.name}` : "Edit Group"}
        description="Update the group description and assigned permissions."
        backTo={group ? `/settings/users/groups/${group.id}` : "/settings/users?tab=groups"}
      />

      {state === "loading" && <LoadingPanel label="Loading group..." />}
      {state === "error" && <ErrorPanel message={error ?? "Failed to load group"} />}
      {state === "ready" && group && (
        <Card className="p-4 space-y-5">
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
                <Button type="button" variant="outline" className="w-full justify-between">
                  {loadingPermissions
                    ? "Loading permissions..."
                    : `${selectedPermissionIds.length} permission${selectedPermissionIds.length === 1 ? "" : "s"} selected`}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(520px,calc(100vw-2rem))] p-0" align="start">
                <div className="max-h-72 overflow-y-auto p-2">
                  {catalog.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      {loadingPermissions ? "Loading permissions..." : "No permissions available."}
                    </p>
                  ) : (
                    catalog.map((permission) => (
                      <label
                        key={permission.id}
                        className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedPermissionIds.includes(permission.id)}
                          onCheckedChange={(checked) => togglePermission(permission.id, checked)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground">{permission.name || permission.code}</span>
                          <span className="block text-xs text-muted-foreground font-mono">{permission.code}</span>
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
                  <Badge key={permission.id} variant="outline" className="font-mono text-[11px]">
                    {permission.code}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link to={`/settings/users/groups/${group.id}`}>Cancel</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving || loadingPermissions}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </Card>
      )}
    </ManagementLayout>
  );
}

export default UserManagement;
