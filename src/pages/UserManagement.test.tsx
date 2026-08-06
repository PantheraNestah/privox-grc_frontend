import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserManagement, { GroupEdit, GroupView, UserMemberView } from "./UserManagement";
import * as organizationApi from "@/lib/organization";

vi.mock("@/components/grc/TopNav", () => ({
  TopNav: () => <div data-testid="top-nav" />,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    organization: { id: "org-1", code: "ORG", name: "Organization" },
    isAuthenticated: true,
    user: { id: "user-1", email: "admin@example.com", username: "admin", fullName: "Admin" },
    permissions: ["user.view"],
  }),
}));

vi.mock("@/hooks/use-active-user", () => ({
  useActiveUser: () => ({
    id: "user-1",
    name: "Admin",
    email: "admin@example.com",
    role: "admin",
    createdAt: "",
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const members = [
  {
    membershipId: "member-1",
    userId: "user-1",
    email: "jane@example.com",
    username: "jane",
    fullName: "Jane Doe",
    membershipStatus: "active",
    primary: false,
    joinedAt: "2026-07-01T00:00:00Z",
  },
];

const groups = [
  {
    id: "group-1",
    name: "Editors",
    description: "Can edit records",
    memberCount: 2,
    active: true,
  },
];

describe("UserManagement", () => {
  beforeEach(() => {
    vi.spyOn(organizationApi, "fetchOrganizationMembers").mockResolvedValue(members);
    vi.spyOn(organizationApi, "fetchOrganizationGroups").mockResolvedValue(groups);
    vi.spyOn(organizationApi, "fetchPermissionCatalog").mockResolvedValue([
      {
        id: "permission-1",
        code: "user.view",
        name: "View users",
        description: "View organization users",
        scopeType: "ORG",
      },
    ]);
    vi.spyOn(organizationApi, "createOrganizationGroup").mockResolvedValue({
      id: "group-2",
      code: "RISK_OWNERS",
      name: "Risk Owners",
      memberCount: 0,
      active: true,
    });
    vi.spyOn(organizationApi, "deactivateOrganizationGroup").mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the users table columns and page action links", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/settings/users?tab=users"]}>
          <UserManagement />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Email" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Username" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Date Joined" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view/i })).toHaveAttribute(
      "href",
      "/settings/users/members/member-1",
    );
    expect(screen.getByRole("link", { name: /edit/i })).toHaveAttribute(
      "href",
      "/settings/users/members/member-1/edit",
    );
  });

  it("creates a group using a generated code and entered name", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <UserManagement />
        </MemoryRouter>
      </HelmetProvider>,
    );

    fireEvent.click(await screen.findByRole("tab", { name: /groups/i }));
    fireEvent.click(await screen.findByRole("button", { name: /create group/i }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Risk Owners" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(organizationApi.createOrganizationGroup).toHaveBeenCalledWith("org-1", {
        code: "RISK_OWNERS",
        name: "Risk Owners",
      });
      expect(organizationApi.deactivateOrganizationGroup).toHaveBeenCalledWith("org-1", "group-2");
    });
  });

  it("loads and displays the permission catalog in the permissions tab", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/settings/users?tab=permissions"]}>
          <UserManagement />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByText("View users")).toBeInTheDocument();
    expect(screen.getByText("user.view")).toBeInTheDocument();
    expect(screen.getByText("View organization users")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(organizationApi.fetchPermissionCatalog).toHaveBeenCalledTimes(1);
  });
});

describe("UserMemberView", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads profile, assigned groups, and auth permissions", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationMembers").mockResolvedValue(members);
    vi.spyOn(organizationApi, "fetchMemberGroups").mockResolvedValue(groups);
    const fetchGroupPermissions = vi.spyOn(organizationApi, "fetchGroupPermissions").mockResolvedValue([]);

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/settings/users/members/member-1"]}>
          <Routes>
            <Route path="/settings/users/members/:memberId" element={<UserMemberView />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(await screen.findByText("Profile Info")).toBeInTheDocument();
    expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);

    const detailTabs = screen.getByRole("tablist", { name: /user detail sections/i });
    fireEvent.mouseDown(within(detailTabs).getByRole("tab", { name: /groups/i }));
    expect(await screen.findByText("Editors")).toBeInTheDocument();

    fireEvent.mouseDown(within(detailTabs).getByRole("tab", { name: /permissions/i }));
    expect(await screen.findByText("user.view")).toBeInTheDocument();

    expect(organizationApi.fetchMemberGroups).toHaveBeenCalledWith("org-1", "user-1");
    expect(fetchGroupPermissions).not.toHaveBeenCalled();
  });

  it("uses the loaded user id when fetching a viewed user's groups", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationMembers").mockResolvedValue(members);
    vi.spyOn(organizationApi, "fetchMemberGroups").mockResolvedValue(groups);
    vi.spyOn(organizationApi, "fetchGroupPermissions").mockResolvedValue([]);

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/settings/users/members/user-1"]}>
          <Routes>
            <Route path="/settings/users/members/:memberId" element={<UserMemberView />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    const detailTabs = await screen.findByRole("tablist", { name: /user detail sections/i });
    fireEvent.mouseDown(within(detailTabs).getByRole("tab", { name: /groups/i }));
    expect(await screen.findByText("Editors")).toBeInTheDocument();
    expect(organizationApi.fetchMemberGroups).toHaveBeenCalledWith("org-1", "user-1");
  });
});

describe("GroupView", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads group details and permissions from the group detail endpoint", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationGroup").mockResolvedValue({
      id: "group-1",
      code: "EDITORS",
      name: "Editors",
      description: "Can edit records",
      memberCount: 2,
      active: true,
      permissions: [
        { id: "permission-1", code: "user.view", name: "View users", scopeType: "ORG" },
      ],
    });

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/settings/users/groups/group-1"]}>
          <Routes>
            <Route path="/settings/users/groups/:groupId" element={<GroupView />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect((await screen.findAllByText("Group Details")).length).toBeGreaterThan(0);
    expect(await screen.findByText("View users")).toBeInTheDocument();
    expect(await screen.findByText("(ORG)")).toBeInTheDocument();
    expect(screen.queryByText("user.view")).not.toBeInTheDocument();
    expect(organizationApi.fetchOrganizationGroup).toHaveBeenCalledWith("org-1", "group-1");
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/settings/users?tab=groups",
    );
  });
});

describe("GroupEdit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("patches the description and puts selected permission IDs", async () => {
    vi.spyOn(organizationApi, "fetchOrganizationGroup").mockResolvedValue({
      id: "group-1",
      name: "Editors",
      description: "Old description",
      memberCount: 2,
      active: true,
      permissions: [],
    });
    vi.spyOn(organizationApi, "fetchPermissionCatalog").mockResolvedValue([
      { id: "permission-1", code: "user.view", name: "View users", scopeType: "ORG" },
    ]);
    vi.spyOn(organizationApi, "fetchGroupPermissions").mockResolvedValue([
      { id: "permission-1", code: "user.view", name: "View users", scopeType: "ORG" },
    ]);
    vi.spyOn(organizationApi, "updateOrganizationGroup").mockResolvedValue({
      id: "group-1",
      name: "Editors",
      description: "Updated description",
      memberCount: 2,
      active: true,
      permissions: [],
    });
    vi.spyOn(organizationApi, "updateGroupPermissions").mockResolvedValue();

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/settings/users/groups/group-1/edit"]}>
          <Routes>
            <Route path="/settings/users/groups/:groupId/edit" element={<GroupEdit />} />
            <Route path="/settings/users/groups/:groupId" element={<div>Group details page</div>} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    const description = await screen.findByLabelText("Description");
    fireEvent.change(description, { target: { value: "Updated description" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(organizationApi.updateOrganizationGroup).toHaveBeenCalledWith("org-1", "group-1", {
        description: "Updated description",
      });
      expect(organizationApi.updateGroupPermissions).toHaveBeenCalledWith("org-1", "group-1", [
        "permission-1",
      ]);
    });
  });
});
