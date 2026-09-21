import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Layers, Pencil, ShieldCheck, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { ErrorState } from "@/components/grc/common/states";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberGroups, useOrganizationMembers, useUpdateOrganizationMember } from "@/hooks/use-organization";
import type { OrganizationMember } from "@/lib/auth-types";
import {
  DetailField,
  DetailSkeleton,
  PermissionsList,
  SectionCard,
  StatusBadge,
  errorMessage,
  useOrganizationId,
} from "./shared";
import { FALLBACK_TEXT, formatDate, statusLabel } from "./user-management-utils";

const MEMBERS_CRUMBS = [
  { label: "User Management", to: "/settings/users" },
  { label: "Users", to: "/settings/users?tab=users" },
];

const BACK_TO_USERS = (
  <Button asChild variant="outline">
    <Link to="/settings/users?tab=users">
      <ArrowLeft /> Back
    </Link>
  </Button>
);

/** Finds a member by membership id or user id in the (cached) members list. */
function useMember(memberId?: string) {
  const orgId = useOrganizationId();
  const membersQuery = useOrganizationMembers(orgId || undefined);
  const member =
    membersQuery.data?.find((item) => item.membershipId === memberId || item.userId === memberId) ?? null;

  let error: string | null = null;
  if (!orgId || !memberId) error = "No active organization or member id was found.";
  else if (membersQuery.error) error = errorMessage(membersQuery.error, "Failed to load member");
  else if (membersQuery.isSuccess && !member) error = "Member was not found.";

  return { orgId, member, isLoading: membersQuery.isLoading, error };
}

export function UserMemberView() {
  const { memberId } = useParams();
  const { permissions: authPermissions } = useAuth();
  const { orgId, member, isLoading, error } = useMember(memberId);
  const groupsQuery = useMemberGroups(orgId || undefined, member?.userId);
  const groups = groupsQuery.data ?? [];
  const permissions = Array.from(new Set(authPermissions));

  return (
    <>
      <Helmet>
        <title>User Profile - Rsolve GRC Platform</title>
        <meta name="description" content="View user profile, assigned groups, and permissions." />
        <link rel="canonical" href={`/settings/users/members/${memberId ?? ""}`} />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[...MEMBERS_CRUMBS, { label: member?.fullName ?? "Profile" }]}
        title={member?.fullName ?? "User Profile"}
        description="Profile information, group assignments, and inherited permissions."
        actions={
          <>
            {member && (
              <Button asChild variant="brand">
                <Link to={`/settings/users/members/${member.membershipId}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {BACK_TO_USERS}
          </>
        }
      />

      {isLoading && <DetailSkeleton label="Loading profile..." />}
      {!isLoading && error && <ErrorState title="Couldn't load profile" message={error} />}
      {member && (
        <Tabs defaultValue="profile">
          <TabsList className="mb-6" aria-label="User detail sections">
            <TabsTrigger value="profile" className="gap-2">
              <UserCircle2 className="h-4 w-4" /> Profile
            </TabsTrigger>
            <TabsTrigger value="groups" className="gap-2">
              <Layers className="h-4 w-4" /> Groups
              {!groupsQuery.isLoading && (
                <Badge variant="secondary" className="text-[11px] font-normal">
                  {groups.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Permissions
              <Badge variant="secondary" className="text-[11px] font-normal">
                {permissions.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-0">
            <SectionCard title="Profile Info" description="Identity and membership details.">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <DetailField label="Name" value={member.fullName} />
                <DetailField label="Email" value={member.email} />
                <DetailField label="Username" value={member.username} />
                <DetailField label="Status" value={statusLabel(member.membershipStatus)} />
                <DetailField label="Date Joined" value={formatDate(member.joinedAt)} />
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="groups" className="mt-0">
            <SectionCard title="Groups" description="Access groups this user belongs to.">
              {groupsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground" role="status">
                  Loading groups...
                </p>
              ) : groupsQuery.error ? (
                <ErrorState title="Couldn't load groups" message={errorMessage(groupsQuery.error, "Failed to load groups")} />
              ) : groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not assigned to any groups.</p>
              ) : (
                <ul className="-my-3 divide-y divide-border">
                  {groups.map((group) => (
                    <li key={group.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy-deep">{group.name}</p>
                        <p className="text-xs text-muted-foreground">{group.description || FALLBACK_TEXT}</p>
                      </div>
                      <StatusBadge status={group.status} active={group.active} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="permissions" className="mt-0">
            <SectionCard title="Permissions" description="Permissions granted in the current session.">
              <PermissionsList
                permissions={permissions}
                emptyText="No permissions were found in the current auth session."
              />
            </SectionCard>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

function MemberEditForm({ orgId, member }: { orgId: string; member: OrganizationMember }) {
  const navigate = useNavigate();
  const updateMember = useUpdateOrganizationMember(orgId);
  const [email, setEmail] = useState(member.email);
  const [fullName, setFullName] = useState(member.fullName);

  const handleSave = async () => {
    try {
      await updateMember.mutateAsync({
        userId: member.userId,
        body: { email: email.trim(), fullName: fullName.trim() },
      });
      toast.success("Member updated");
      navigate(`/settings/users/members/${member.membershipId}`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update member"));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base text-navy-deep">Member details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="edit-name">Full name</Label>
          <Input id="edit-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-email">Email</Label>
          <Input id="edit-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-username">Username</Label>
          <Input id="edit-username" value={member.username} readOnly disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-status">Status</Label>
          <Input id="edit-status" value={statusLabel(member.membershipStatus)} readOnly disabled />
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2 border-t border-border pt-4">
        <Button asChild variant="outline">
          <Link to={`/settings/users/members/${member.membershipId}`}>Cancel</Link>
        </Button>
        <Button
          variant="brand"
          onClick={handleSave}
          disabled={updateMember.isPending || !fullName.trim() || !email.trim()}
        >
          {updateMember.isPending ? "Saving..." : "Save changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function UserMemberEdit() {
  const { memberId } = useParams();
  const { orgId, member, isLoading, error } = useMember(memberId);

  return (
    <>
      <Helmet>
        <title>Edit User - Rsolve GRC Platform</title>
        <meta name="description" content="Update member profile details." />
        <link rel="canonical" href={`/settings/users/members/${memberId ?? ""}/edit`} />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[
          ...MEMBERS_CRUMBS,
          ...(member
            ? [{ label: member.fullName, to: `/settings/users/members/${member.membershipId}` }]
            : []),
          { label: "Edit" },
        ]}
        title="Edit User"
        description="Update the member's email and full name via the backend update endpoint. Deactivated members cannot be edited."
        actions={BACK_TO_USERS}
      />

      {isLoading && <DetailSkeleton label="Loading user..." />}
      {!isLoading && error && <ErrorState title="Couldn't load user" message={error} />}
      {member && <MemberEditForm key={member.membershipId} orgId={orgId} member={member} />}
    </>
  );
}
