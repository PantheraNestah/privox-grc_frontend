import { api } from "./api";
import { fetchOrganizationGroup } from "./organization";

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

    await expect(fetchOrganizationGroup("group-1")).resolves.toMatchObject({
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
  });

});
