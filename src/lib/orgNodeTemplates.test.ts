import { api } from "./api";
import {
  fetchOrgNodeTemplatePreview,
  fetchOrgNodeTemplates,
  registerOrgNodeTemplate,
} from "./orgNodeTemplates";

describe("fetchOrgNodeTemplates", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists the platform template catalogue", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [{ id: "template-1" }] });

    await expect(fetchOrgNodeTemplates()).resolves.toEqual([{ id: "template-1" }]);
    expect(api.get).toHaveBeenCalledWith("/v1/platform/org-node-templates");
  });
});

describe("fetchOrgNodeTemplatePreview", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches the full nested tree for a template", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { templateId: "template-1" } });

    await expect(fetchOrgNodeTemplatePreview("template-1")).resolves.toEqual({
      templateId: "template-1",
    });
    expect(api.get).toHaveBeenCalledWith("/v1/platform/org-node-templates/template-1/preview");
  });
});

describe("registerOrgNodeTemplate", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts the nested tree definition", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { id: "template-1" } });

    const body = { name: "Insurance Org", rootNode: { name: "Group", type: "GROUP" as const } };
    await expect(registerOrgNodeTemplate(body)).resolves.toEqual({ id: "template-1" });
    expect(api.post).toHaveBeenCalledWith("/v1/platform/org-node-templates", body);
  });
});
