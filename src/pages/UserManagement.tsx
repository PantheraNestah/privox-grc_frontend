import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { Layers, LayoutDashboard, MailPlus, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { ErrorState } from "@/components/grc/common/states";
import { GroupsTab } from "@/components/grc/users/GroupsTab";
import { InvitationsTab } from "@/components/grc/users/InvitationsTab";
import { OverviewTab } from "@/components/grc/users/OverviewTab";
import { PermissionsTab } from "@/components/grc/users/PermissionsTab";
import { UsersTab } from "@/components/grc/users/UsersTab";
import { useOrganizationId } from "@/components/grc/users/shared";
import { useActiveUser } from "@/hooks/use-active-user";
import { can } from "@/data/userStore";

const SECTIONS = [
  { value: "dashboard", label: "Overview", icon: LayoutDashboard },
  { value: "users", label: "Users", icon: Users },
  { value: "invitations", label: "Invitations", icon: MailPlus },
  { value: "groups", label: "Groups", icon: Layers },
  { value: "permissions", label: "Permissions", icon: ShieldCheck },
] as const;

type Section = (typeof SECTIONS)[number]["value"];

const isSection = (value: string | null): value is Section => SECTIONS.some((s) => s.value === value);

export const UserManagement = () => {
  const orgId = useOrganizationId();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeUser = useActiveUser();
  const isAdmin = can.manageUsers(activeUser.role);

  const requestedTab = searchParams.get("tab");
  const activeTab: Section = isSection(requestedTab) ? requestedTab : "dashboard";

  const handleTabChange = (value: string) => setSearchParams(value === "dashboard" ? {} : { tab: value });

  return (
    <>
      <Helmet>
        <title>User Management - Rsolve GRC Platform</title>
        <meta name="description" content="View organization members, groups, and group assignments." />
        <link rel="canonical" href="/settings/users" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "User Management" }]}
        title="User Management"
        description="Review organization members and manage backend-backed groups."
      />

      {!isAdmin && (
        <Alert className="mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Read-only view</AlertTitle>
          <AlertDescription>Some management features are restricted to administrators.</AlertDescription>
        </Alert>
      )}

      {!orgId ? (
        <ErrorState
          title="No organization"
          message="No active organization was found for this session."
        />
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6" aria-label="Section navigation">
            {SECTIONS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="gap-1.5">
                <Icon className="h-3.5 w-3.5" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard" className="mt-0">
            <OverviewTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="users" className="mt-0">
            <UsersTab orgId={orgId} isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="invitations" className="mt-0">
            <InvitationsTab orgId={orgId} isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="groups" className="mt-0">
            <GroupsTab orgId={orgId} isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="permissions" className="mt-0">
            <PermissionsTab isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
};

// Sub-pages live beside the tab components; re-exported so routes keep one import.
export { UserMemberView, UserMemberEdit } from "@/components/grc/users/MemberPages";
export { GroupView, GroupMembersView, GroupEdit } from "@/components/grc/users/GroupPages";

export default UserManagement;
