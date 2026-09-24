import { api } from "./api";
import {
  archiveStrategyElement,
  createStrategyElement,
  createStrategyVersion,
  fetchStrategyElementDetail,
  fetchStrategyElements,
  fetchStrategyFormulationSettings,
  fetchStrategyInsights,
  fetchStrategyProgressHistory,
  fetchStrategySummary,
  fetchStrategyTree,
  fetchStrategyVersion,
  fetchStrategyVersionHistory,
  publishStrategyVersion,
  recordStrategyApprovalDecision,
  recordStrategyProgress,
  updateStrategyFormulationSettings,
} from "./strategy-formulation";

const base = "/v1/organizations/org-1/strategy-formulation";

describe("Strategy Formulation API service", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches and updates settings", async () => {
    const settings = {
      organizationId: "org-1",
      requiresApproval: true,
      strictTypeHierarchy: false,
    };
    vi.spyOn(api, "get").mockResolvedValue({ data: settings });
    vi.spyOn(api, "put").mockResolvedValue({ data: settings });

    await expect(fetchStrategyFormulationSettings("org-1")).resolves.toBe(settings);
    await expect(
      updateStrategyFormulationSettings("org-1", {
        requiresApproval: true,
        strictTypeHierarchy: false,
      }),
    ).resolves.toBe(settings);

    expect(api.get).toHaveBeenCalledWith(`${base}/settings`);
    expect(api.put).toHaveBeenCalledWith(`${base}/settings`, {
      requiresApproval: true,
      strictTypeHierarchy: false,
    });
  });

  it("creates elements and applies only defined list filters", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { id: "element-1" } });
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: null }).mockResolvedValueOnce({ data: [] });
    const body = {
      type: "PILLAR" as const,
      orgNodeId: null,
      parentElementId: null,
      title: "Digital transformation",
      outcomeSummary: null,
      targetValue: null,
      unit: null,
    };

    await expect(createStrategyElement("org-1", body)).resolves.toMatchObject({
      id: "element-1",
    });
    await expect(
      fetchStrategyElements("org-1", {
        type: "KPI",
        parentElementId: null,
        orgNodeId: "node-1",
      }),
    ).resolves.toEqual([]);
    await expect(fetchStrategyElements("org-1")).resolves.toEqual([]);

    expect(api.post).toHaveBeenCalledWith(`${base}/elements`, body);
    expect(api.get).toHaveBeenNthCalledWith(1, `${base}/elements`, {
      params: { type: "KPI", orgNodeId: "node-1" },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, `${base}/elements`, {
      params: undefined,
    });
  });

  it("fetches element detail and recursively normalizes tree children", async () => {
    vi.spyOn(api, "get")
      .mockResolvedValueOnce({
        data: {
          id: "element-1",
          currentVersion: null,
          draftVersion: null,
        },
      })
      .mockResolvedValueOnce({
        data: [
          null,
          {
            id: "pillar-1",
            children: [{ id: "objective-1", children: null }],
          },
        ],
      });

    await expect(fetchStrategyElementDetail("org-1", "element-1")).resolves.toMatchObject({
      currentVersion: null,
      draftVersion: null,
    });
    await expect(fetchStrategyTree("org-1")).resolves.toMatchObject([
      {
        id: "pillar-1",
        children: [{ id: "objective-1", children: [] }],
      },
    ]);

    expect(api.get).toHaveBeenNthCalledWith(1, `${base}/elements/element-1`);
    expect(api.get).toHaveBeenNthCalledWith(2, `${base}/tree`);
  });

  it("publishes, decides and creates immutable versions", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { versionId: "version-1" } });
    const decision = { decision: "APPROVE" as const, comments: "Approved" };
    const version = { title: "Revised", targetValue: null, unit: null };

    await expect(
      publishStrategyVersion("org-1", "element-1", "version-1"),
    ).resolves.toMatchObject({ versionId: "version-1" });
    await expect(
      recordStrategyApprovalDecision("org-1", "element-1", "version-1", decision),
    ).resolves.toMatchObject({ versionId: "version-1" });
    await expect(
      createStrategyVersion("org-1", "element-1", version),
    ).resolves.toMatchObject({ versionId: "version-1" });

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      `${base}/elements/element-1/versions/version-1/publish`,
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      `${base}/elements/element-1/versions/version-1/decision`,
      decision,
    );
    expect(api.post).toHaveBeenNthCalledWith(
      3,
      `${base}/elements/element-1/versions`,
      version,
    );
  });

  it("fetches version history, an exact version and archives elements", async () => {
    vi.spyOn(api, "get")
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { versionId: "version-1" } });
    vi.spyOn(api, "post").mockResolvedValue({ data: { status: "ARCHIVED" } });

    await expect(
      fetchStrategyVersionHistory("org-1", "element-1"),
    ).resolves.toEqual([]);
    await expect(
      fetchStrategyVersion("org-1", "element-1", "version-1"),
    ).resolves.toMatchObject({ versionId: "version-1" });
    await expect(archiveStrategyElement("org-1", "element-1")).resolves.toMatchObject({
      status: "ARCHIVED",
    });

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      `${base}/elements/element-1/versions`,
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      `${base}/elements/element-1/versions/version-1`,
    );
    expect(api.post).toHaveBeenCalledWith(`${base}/elements/element-1/archive`);
  });

  it("records and fetches nullable KPI progress", async () => {
    const progress = {
      id: "progress-1",
      reportedValue: null,
      note: "Manual observation",
    };
    vi.spyOn(api, "post").mockResolvedValue({ data: progress });
    vi.spyOn(api, "get").mockResolvedValue({ data: null });

    await expect(
      recordStrategyProgress("org-1", "kpi-1", {
        reportedValue: null,
        note: "Manual observation",
      }),
    ).resolves.toBe(progress);
    await expect(fetchStrategyProgressHistory("org-1", "kpi-1")).resolves.toEqual([]);

    expect(api.post).toHaveBeenCalledWith(`${base}/elements/kpi-1/progress`, {
      reportedValue: null,
      note: "Manual observation",
    });
    expect(api.get).toHaveBeenCalledWith(`${base}/elements/kpi-1/progress`);
  });

  it("fetches formulation summary and insights", async () => {
    vi.spyOn(api, "get")
      .mockResolvedValueOnce({ data: { totalElementCount: 48 } })
      .mockResolvedValueOnce({ data: { kpiCount: 6 } });

    await expect(fetchStrategySummary("org-1")).resolves.toMatchObject({
      totalElementCount: 48,
    });
    await expect(fetchStrategyInsights("org-1")).resolves.toMatchObject({ kpiCount: 6 });

    expect(api.get).toHaveBeenNthCalledWith(1, `${base}/summary`);
    expect(api.get).toHaveBeenNthCalledWith(2, `${base}/insights`);
  });
});
