import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserManagement, { GroupEdit, GroupMembersView, UserMemberEdit, UserMemberView } from "./UserManagement";
import { api } from "@/lib/api";
import * as organizationApi from "@/lib/organization";
import * as organizationModulesApi from "@/lib/organizationModules";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    organization: { id: "org-1", code: "ORG", name: "Organization" },
    isAuthenticated: true,
    user: { id: "user-1", email: "admin@example.com", username: "admin", fullName: "Admin" },
    permissions: ["organization.manage"],
    hasModule: () => true,
  }),
}));

vi.mock("@/hooks/use-active-user", () => ({
  useActiveUser: () => ({ id: "user-1", name: "Admin", email: "admin@example.com", role: "admin", createdAt: "" }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

function renderPage(ui: ReactNode, initialEntries?: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

const activeMember = {
  membershipId: "member-1",
  userId: "user-1",
  email: "jane@example.com",
  username: "jane",
  fullName: "Jane Doe",
  membershipStatus: "ACTIVE",
  primary: false,
  joinedAt: "2026-07-01T00:00:00Z",
};
const suspendedMember = { ...activeMember, membershipId: "member-2", userId: "user-2", fullName: "Sam", membershipStatus: "SUSPENDED" };
const group = { id: "group-1", code: "EDITORS", name: "Editors", description: "Edit", memberCount: 1, active: true };

afterEach(() => vi.restoreAllMocks());

// The member transition helpers are bound inside the hooks module, so assert
// at the HTTP boundary (which also checks the real endpoint wiring).
describe("member lifecycle", () => {
  it("suspends an active member after confirmation", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationMembers").mockResolvedValue([activeMember]);
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { ...activeMember, membershipStatus: "SUSPENDED" } });
    renderPage(<UserManagement />, ["/settings/users?tab=users"]);

    fireEvent.click(await screen.findByRole("switch", { name: "Deactivate user" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/v1/organizations/org-1/members/user-1/suspend"));
  });

  it("treats a suspended member as inactive and offers reactivation", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationMembers").mockResolvedValue([suspendedMember]);
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { ...suspendedMember, membershipStatus: "ACTIVE" } });
    renderPage(<UserManagement />, ["/settings/users?tab=users"]);

    fireEvent.click(await screen.findByRole("switch", { name: "Activate user" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reactivate" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/v1/organizations/org-1/members/user-2/reactivate"));
  });
});

describe("invitations", () => {
  beforeEach(() => {
    vi.spyOn(organizationApi, "fetchOrganizationGroups").mockResolvedValue([group]);
  });

  it("revokes a pending invitation", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationInvitations").mockResolvedValue([
      { id: "inv-1", organizationId: "org-1", email: "new@example.com", status: "PENDING" },
    ]);
    const revoke = vi.spyOn(organizationApi, "revokeInvitation").mockResolvedValue({
      id: "inv-1",
      organizationId: "org-1",
      email: "new@example.com",
      status: "REVOKED",
    });
    renderPage(<UserManagement />, ["/settings/users?tab=invitations"]);

    fireEvent.click(await screen.findByRole("button", { name: /revoke/i }));

    await waitFor(() => expect(revoke).toHaveBeenCalledWith("org-1", "inv-1"));
  });

  it("sends an invitation for the entered email", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationInvitations").mockResolvedValue([]);
    const create = vi.spyOn(organizationApi, "createOrganizationInvitation").mockResolvedValue({
      id: "inv-2",
      organizationId: "org-1",
      email: "analyst@example.com",
      status: "PENDING",
    });
    renderPage(<UserManagement />, ["/settings/users?tab=invitations"]);

    fireEvent.click(await screen.findByRole("button", { name: /invite user/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Email"), { target: { value: " analyst@example.com " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send invitation" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith("org-1", { email: "analyst@example.com" }));
  });
});

describe("caching and lazy loading", () => {
  it("does not fetch the permission catalog until its tab is opened", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationMembers").mockResolvedValue([activeMember]);
    vi.spyOn(organizationApi, "fetchOrganizationGroups").mockResolvedValue([group]);
    const catalog = vi.spyOn(organizationApi, "fetchPermissionCatalog").mockResolvedValue([
      { id: "p1", code: "user.view", name: "View users", scopeType: "ORG" },
    ]);
    renderPage(<UserManagement />);

    expect(await screen.findByText("Total Users")).toBeInTheDocument();
    await screen.findByText("Jane Doe");
    expect(catalog).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /permissions/i }));
    expect(await screen.findByText("View users")).toBeInTheDocument();
    expect(catalog).toHaveBeenCalledTimes(1);
  });
});

describe("member module allocations", () => {
  it("keeps mandatory modules checked and saves the allocation set", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationMembers").mockResolvedValue([activeMember]);
    vi.spyOn(organizationApi, "fetchMemberModules").mockResolvedValue([
      "CORE",
      "USER_MANAGEMENT",
      "GOVERNANCE",
    ]);
    vi.spyOn(organizationModulesApi, "fetchOrganizationModules").mockResolvedValue([
      { id: "m1", moduleId: "m1", code: "CORE", name: "Core Platform", enabled: true, sortOrder: 10, enabledAt: null, disabledAt: null },
      { id: "m2", moduleId: "m2", code: "USER_MANAGEMENT", name: "User Management", enabled: true, sortOrder: 20, enabledAt: null, disabledAt: null },
      { id: "m3", moduleId: "m3", code: "GOVERNANCE", name: "Governance", enabled: true, sortOrder: 30, enabledAt: null, disabledAt: null },
      { id: "m4", moduleId: "m4", code: "RISK_MANAGEMENT", name: "Risk Management", enabled: true, sortOrder: 40, enabledAt: null, disabledAt: null },
    ]);
    vi.spyOn(organizationApi, "updateOrganizationMember").mockResolvedValue(activeMember);
    const updateModules = vi
      .spyOn(organizationApi, "updateMemberModules")
      .mockResolvedValue(["CORE", "USER_MANAGEMENT"]);

    renderPage(
      <Routes>
        <Route path="/settings/users/members/:memberId/edit" element={<UserMemberEdit />} />
        <Route path="/settings/users/members/:memberId" element={<div>Member view</div>} />
      </Routes>,
      ["/settings/users/members/member-1/edit"],
    );

    const core = await screen.findByRole("checkbox", { name: /core platform/i });
    expect(core).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /governance/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateModules).toHaveBeenCalledWith("org-1", "user-1", ["CORE", "USER_MANAGEMENT"]),
    );
  });
});

describe("member profile errors", () => {
  it("reports a member that is not in the organization", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationMembers").mockResolvedValue([activeMember]);
    renderPage(
      <Routes>
        <Route path="/settings/users/members/:memberId" element={<UserMemberView />} />
      </Routes>,
      ["/settings/users/members/missing"],
    );

    expect(await screen.findByText("Member was not found.")).toBeInTheDocument();
  });
});

describe("group pages", () => {
  it("removes a member from a group", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationGroup").mockResolvedValue({ ...group, permissions: [] });
    vi.spyOn(organizationApi, "fetchGroupMembers").mockResolvedValue([activeMember]);
    vi.spyOn(organizationApi, "fetchOrganizationMembers").mockResolvedValue([activeMember]);
    const remove = vi.spyOn(organizationApi, "removeGroupMember").mockResolvedValue();
    renderPage(
      <Routes>
        <Route path="/settings/users/groups/:groupId/members" element={<GroupMembersView />} />
      </Routes>,
      ["/settings/users/groups/group-1/members"],
    );

    fireEvent.click(await screen.findByRole("button", { name: /remove/i }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("org-1", "group-1", "user-1"));
  });

  it("does not offer the edit form when the group's permissions fail to load", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationGroup").mockResolvedValue({ ...group, permissions: [] });
    vi.spyOn(organizationApi, "fetchPermissionCatalog").mockResolvedValue([]);
    vi.spyOn(organizationApi, "fetchGroupPermissions").mockRejectedValue(new Error("boom"));
    const updatePermissions = vi.spyOn(organizationApi, "updateGroupPermissions").mockResolvedValue();
    renderPage(
      <Routes>
        <Route path="/settings/users/groups/:groupId/edit" element={<GroupEdit />} />
      </Routes>,
      ["/settings/users/groups/group-1/edit"],
    );

    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(updatePermissions).not.toHaveBeenCalled();
  });
});
