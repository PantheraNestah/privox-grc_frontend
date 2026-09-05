import { api } from "./api";
import {
  createOrgNode,
  fetchOrgNode,
  fetchOrgNodes,
  moveOrgNode,
  softDeleteOrgNode,
  updateOrgNode,
} from "./orgNodes";

describe("fetchOrgNodes", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches the org tree without a scope filter", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [{ id: "node-1" }] });

    await expect(fetchOrgNodes("org-1")).resolves.toEqual([{ id: "node-1" }]);
    expect(api.get).toHaveBeenCalledWith("/v1/organizations/org-1/org-nodes", {
      params: undefined,
    });
  });

  it("passes scopeRootNodeId as a query param when given", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [] });

    await fetchOrgNodes("org-1", "node-1");
    expect(api.get).toHaveBeenCalledWith("/v1/organizations/org-1/org-nodes", {
      params: { scopeRootNodeId: "node-1" },
    });
  });
});

describe("fetchOrgNode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches a single node by id", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { id: "node-1" } });

    await expect(fetchOrgNode("org-1", "node-1")).resolves.toEqual({ id: "node-1" });
    expect(api.get).toHaveBeenCalledWith("/v1/organizations/org-1/org-nodes/node-1");
  });
});

describe("createOrgNode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts the create request body", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { id: "node-1" } });

    const body = { name: "Acme Group", type: "GROUP" as const };
    await expect(createOrgNode("org-1", body)).resolves.toEqual({ id: "node-1" });
    expect(api.post).toHaveBeenCalledWith("/v1/organizations/org-1/org-nodes", body);
  });
});

describe("updateOrgNode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("patches the given node", async () => {
    vi.spyOn(api, "patch").mockResolvedValue({ data: { id: "node-1" } });

    const body = { name: "Acme Holdings", type: "GROUP" as const };
    await expect(updateOrgNode("org-1", "node-1", body)).resolves.toEqual({ id: "node-1" });
    expect(api.patch).toHaveBeenCalledWith("/v1/organizations/org-1/org-nodes/node-1", body);
  });
});

describe("moveOrgNode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts the new parent to the move endpoint", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { id: "node-1", parentId: "node-2" } });

    await expect(moveOrgNode("org-1", "node-1", { newParentId: "node-2" })).resolves.toEqual({
      id: "node-1",
      parentId: "node-2",
    });
    expect(api.post).toHaveBeenCalledWith("/v1/organizations/org-1/org-nodes/node-1/move", {
      newParentId: "node-2",
    });
  });
});

describe("softDeleteOrgNode", () => {
  afterEach(() => vi.restoreAllMocks());

  it("issues a DELETE against the node", async () => {
    vi.spyOn(api, "delete").mockResolvedValue({ data: undefined });

    await softDeleteOrgNode("org-1", "node-1");
    expect(api.delete).toHaveBeenCalledWith("/v1/organizations/org-1/org-nodes/node-1");
  });
});
