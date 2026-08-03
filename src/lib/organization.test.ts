import { api } from "./api";
import {
  activateOrganizationGroup,
  createOrganizationGroup,
  deactivateOrganizationGroup,
  fetchOrganization,
  fetchGroupPermissions,
  fetchMemberGroups,
  fetchOrganizationGroups,
  fetchOrganizationGroup,
  fetchPermissionCatalog,
  updateGroupPermissions,
} from "./organization";

describe("fetchOrganizationGroup", () => {
  afterEach(() => vi.restoreAllMocks());

  it("retains permission objects with stable IDs and display metadata", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        id: "group-1",
        name: "Administrators",
        memberCount: 2,
        permissions: [
          {
            id: "permission-1",
            code: "user.view",
            name: "View users",
            scopeType: "ORGANIZATION",
          },
          {
            id: "permission-2",
            code: "user.manage",
            name: "Manage users",
            scopeType: "ORGANIZATION",
          },
        ],
      },
    });

    await expect(fetchOrganizationGroup("org-1", "group-1")).resolves.toMatchObject({
      permissions: [
        {
          id: "permission-1",
          code: "user.view",
          name: "View users",
          scopeType: "ORGANIZATION",
        },
        {
          id: "permission-2",
          code: "user.manage",
          name: "Manage users",
          scopeType: "ORGANIZATION",
        },
      ],
    });
    expect(api.get).toHaveBeenCalledWith("/v1/organizations/org-1/groups/group-1");
  });

  it("derives group status from the active field", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        id: "group-1",
        name: "Editors",
        memberCount: 2,
        active: false,
        permissions: [],
      },
    });

    await expect(fetchOrganizationGroup("org-1", "group-1")).resolves.toMatchObject({
      active: false,
      status: "inactive",
    });
  });
});

describe("fetchOrganization", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches organization details by organization id", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { id: "org-1", code: "ORG", name: "Organization" },
    });

    await expect(fetchOrganization("org-1")).resolves.toMatchObject({
      id: "org-1",
      name: "Organization",
    });
    expect(api.get).toHaveBeenCalledWith("/v1/organizations/org-1");
  });
});

describe("organization group management helpers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a group with the supplied code and name", async () => {
    vi.spyOn(api, "post").mockResolvedValue({
      data: { id: "group-1", code: "EDITOR", name: "Editor" },
    });

    await expect(
      createOrganizationGroup("org-1", { code: "EDITOR", name: "Editor" }),
    ).resolves.toMatchObject({ id: "group-1" });
    expect(api.post).toHaveBeenCalledWith("/v1/organizations/org-1/groups", {
      code: "EDITOR",
      name: "Editor",
    });
  });

  it("normalizes active flags when fetching group lists and member groups", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: [{ id: "group-1", name: "Editors", active: true }],
    });

    await expect(fetchOrganizationGroups("org-1")).resolves.toMatchObject([
      { id: "group-1", active: true, status: "active" },
    ]);
    await expect(fetchMemberGroups("org-1", "user-1")).resolves.toMatchObject([
      { id: "group-1", active: true, status: "active" },
    ]);
    expect(api.get).toHaveBeenCalledWith("/v1/organizations/org-1/groups");
    expect(api.get).toHaveBeenCalledWith("/v1/organizations/org-1/members/user-1/groups");
  });

  it("activates and deactivates groups through their status endpoints", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: {} });

    await activateOrganizationGroup("org-1", "group-1");
    await deactivateOrganizationGroup("org-1", "group-1");

    expect(api.post).toHaveBeenCalledWith("/v1/organizations/org-1/groups/group-1/activate");
    expect(api.post).toHaveBeenCalledWith("/v1/organizations/org-1/groups/group-1/deactivate");
  });

  it("fetches the permission catalog", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: [{ id: "permission-1", code: "user.view", name: "View users", scopeType: "ORG" }],
    });

    await expect(fetchPermissionCatalog()).resolves.toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith("/v1/permissions");
  });

  it("fetches group permissions and normalizes string permissions", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: ["user.view"],
    });

    await expect(fetchGroupPermissions("org-1", "group-1")).resolves.toEqual([
      { id: "user.view", code: "user.view", name: "user.view", scopeType: "" },
    ]);
    expect(api.get).toHaveBeenCalledWith("/v1/organizations/org-1/groups/group-1/permissions");
  });

  it("updates group permissions with a permissionIds array", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: {} });

    await updateGroupPermissions("org-1", "group-1", ["permission-1", "permission-2"]);

    expect(api.put).toHaveBeenCalledWith(
      "/v1/organizations/org-1/groups/group-1/permissions",
      { permissionIds: ["permission-1", "permission-2"] },
    );
  });
});
