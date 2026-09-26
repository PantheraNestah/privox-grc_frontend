import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import StrategyFormulation from "./StrategyFormulation";
import type {
  StrategyElementDetail,
  StrategyInsights,
  StrategySummary,
  StrategyTreeNode,
  StrategyVersion,
} from "@/lib/strategy-formulation-types";

const session = vi.hoisted(() => ({
  permissions: ["strategy.contribute", "strategy.approve"] as string[],
  hasGovernance: true,
  create: vi.fn(),
  createVersion: vi.fn(),
  publish: vi.fn(),
  decide: vi.fn(),
  archive: vi.fn(),
  progress: vi.fn(),
  updateSettings: vi.fn(),
  detailHasDraft: false,
  orgNodes: [] as Array<Record<string, unknown>>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    organization: { id: "org-1", code: "ORG", name: "Organization" },
    permissions: session.permissions,
    hasModule: (code: string) => code === "GOVERNANCE" && session.hasGovernance,
  }),
}));

const kpi: StrategyTreeNode = {
  id: "kpi-1",
  organizationId: "org-1",
  orgNodeId: "node-1",
  parentElementId: "initiative-1",
  type: "KPI",
  versionId: "kpi-v1",
  version: 1,
  current: true,
  title: "Digital adoption",
  description: "Percentage of services adopted",
  outcomeSummary: null,
  targetValue: 90,
  unit: "%",
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  status: "PUBLISHED",
  children: [],
};

const initiative: StrategyTreeNode = {
  id: "initiative-1",
  organizationId: "org-1",
  orgNodeId: "node-1",
  parentElementId: "objective-1",
  type: "INITIATIVE",
  versionId: "initiative-v1",
  version: 1,
  current: true,
  title: "Modernize digital services",
  description: "Deliver modern digital channels",
  outcomeSummary: null,
  targetValue: null,
  unit: null,
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  status: "PUBLISHED",
  children: [kpi],
};

const objective: StrategyTreeNode = {
  id: "objective-1",
  organizationId: "org-1",
  orgNodeId: "node-1",
  parentElementId: "pillar-1",
  type: "OBJECTIVE",
  versionId: "objective-v1",
  version: 1,
  current: true,
  title: "Accelerate digital adoption",
  description: "Increase adoption of customer-facing services",
  outcomeSummary: null,
  targetValue: null,
  unit: null,
  periodStart: null,
  periodEnd: null,
  status: "PUBLISHED",
  children: [initiative],
};

const pillar: StrategyTreeNode = {
  id: "pillar-1",
  organizationId: "org-1",
  orgNodeId: null,
  parentElementId: null,
  type: "PILLAR",
  versionId: "pillar-v1",
  version: 1,
  current: true,
  title: "Digital transformation",
  description: "Build future-ready capabilities",
  outcomeSummary: null,
  targetValue: null,
  unit: null,
  periodStart: null,
  periodEnd: null,
  status: "PUBLISHED",
  children: [objective],
};

const tree = [pillar];
const summary: StrategySummary = {
  organizationId: "org-1",
  pillarCount: 1,
  objectiveCount: 1,
  initiativeCount: 1,
  activityCount: 0,
  kpiCount: 1,
  totalElementCount: 4,
};
const insights: StrategyInsights = {
  organizationId: "org-1",
  currentPublishedElementCount: 4,
  outstandingDraftCount: 0,
  pendingApprovalCount: 0,
  kpiCount: 1,
  kpisWithProgressCount: 1,
  kpisWithoutProgressCount: 0,
};
const detail: StrategyElementDetail = {
  id: "kpi-1",
  organizationId: "org-1",
  orgNodeId: "node-1",
  parentElementId: "initiative-1",
  type: "KPI",
  elementCreatedByUserId: "user-1",
  elementCreatedAt: "2026-09-23T10:00:00Z",
  currentVersion: {
    id: "kpi-v1",
    version: 1,
    current: true,
    title: "Digital adoption",
    description: "Percentage of services adopted",
    outcomeSummary: null,
    targetValue: 90,
    unit: "%",
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    status: "PUBLISHED",
    createdByUserId: "user-1",
    createdAt: "2026-09-23T10:00:00Z",
  },
  draftVersion: null,
};
const draftVersion = {
  id: "kpi-v2",
  version: 2,
  current: false,
  title: "Digital adoption revised",
  description: "Revised KPI target",
  outcomeSummary: null,
  targetValue: 95,
  unit: "%",
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  status: "DRAFT" as const,
  createdByUserId: "user-1",
  createdAt: "2026-09-24T10:00:00Z",
};
const history: StrategyVersion[] = [
  {
    id: "kpi-1",
    organizationId: "org-1",
    orgNodeId: "node-1",
    parentElementId: "initiative-1",
    type: "KPI",
    versionId: "kpi-v1",
    version: 1,
    current: true,
    title: "Digital adoption",
    description: "Percentage of services adopted",
    outcomeSummary: null,
    targetValue: 90,
    unit: "%",
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    status: "PUBLISHED",
    elementCreatedByUserId: "user-1",
    elementCreatedAt: "2026-09-23T10:00:00Z",
    versionCreatedByUserId: "user-1",
    versionCreatedAt: "2026-09-23T10:00:00Z",
  },
];

const mutation = (fn: ReturnType<typeof vi.fn>) => ({ mutateAsync: fn, isPending: false });

vi.mock("@/hooks/use-org-nodes", () => ({
  useOrgNodes: () => ({ data: session.orgNodes, isPending: false, error: null }),
}));

vi.mock("@/hooks/use-strategy-formulation", () => ({
  useStrategyTree: () => ({ data: tree, isPending: false, error: null }),
  useStrategySummary: () => ({ data: summary, isPending: false, error: null }),
  useStrategyInsights: () => ({ data: insights, isPending: false, error: null }),
  useStrategyFormulationSettings: () => ({
    data: { organizationId: "org-1", requiresApproval: true, strictTypeHierarchy: false },
    isPending: false,
    error: null,
  }),
  useCreateStrategyElement: () => mutation(session.create),
  useCreateStrategyVersion: () => mutation(session.createVersion),
  usePublishStrategyVersion: () => mutation(session.publish),
  useRecordStrategyApprovalDecision: () => mutation(session.decide),
  useArchiveStrategyElement: () => mutation(session.archive),
  useRecordStrategyProgress: () => mutation(session.progress),
  useUpdateStrategyFormulationSettings: () => mutation(session.updateSettings),
  useStrategyElementDetail: () => ({
    data: session.detailHasDraft ? { ...detail, draftVersion } : detail,
    isLoading: false,
    error: null,
  }),
  useStrategyVersionHistory: () => ({ data: history, isLoading: false }),
  useStrategyVersion: () => ({ data: history[0], isLoading: false }),
  useStrategyProgressHistory: () => ({
    data: [
      {
        id: "progress-1",
        strategyElementId: "kpi-1",
        reportedValue: 63.5,
        note: "Monthly observation",
        recordedByUserId: "user-1",
        recordedAt: "2026-09-23T12:00:00Z",
      },
    ],
    isLoading: false,
  }),
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <StrategyFormulation />
      </MemoryRouter>
    </HelmetProvider>,
  );

const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole("tab", { name }));

describe("StrategyFormulation API workspace", () => {
  beforeEach(() => {
    session.permissions = ["strategy.contribute", "strategy.approve"];
    session.hasGovernance = true;
    session.create.mockResolvedValue({});
    session.createVersion.mockResolvedValue({});
    session.publish.mockResolvedValue({ current: true });
    session.decide.mockResolvedValue({});
    session.archive.mockResolvedValue({});
    session.progress.mockResolvedValue({});
    session.updateSettings.mockResolvedValue({});
    session.detailHasDraft = false;
    session.orgNodes = [];
    vi.clearAllMocks();
  });

  it("renders API summary, insights and the recursive blueprint data", () => {
    renderPage();

    expect(screen.getAllByText("Digital transformation").length).toBeGreaterThan(0);
    expect(screen.getByText("Publication health")).toBeInTheDocument();
    expect(screen.getByText("Formulation readiness")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /4 published, 0 draft and 0 pending approval/ })).toBeInTheDocument();
  });

  it("keeps users without manage permission read-only", () => {
    session.permissions = [];
    renderPage();

    expect(screen.getByText(/read-only formulation view/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New element/ })).not.toBeInTheDocument();
  });

  it("gates the workspace when the Governance module is not allocated", () => {
    session.hasGovernance = false;
    renderPage();

    expect(screen.getByText("Governance module not allocated")).toBeInTheDocument();
    expect(screen.queryByText("Publication health")).not.toBeInTheDocument();
  });

  it("creates a pillar draft with explicit null structural fields", async () => {
    renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: /New element/ })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title *"), { target: { value: "Customer trust" } });
    fireEvent.change(within(dialog).getByLabelText("Description"), { target: { value: "Strengthen customer trust" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create draft" }));

    await waitFor(() =>
      expect(session.create).toHaveBeenCalledWith({
        type: "PILLAR",
        orgNodeId: null,
        parentElementId: null,
        title: "Customer trust",
        description: "Strengthen customer trust",
        outcomeSummary: null,
        targetValue: null,
        unit: null,
        periodStart: null,
        periodEnd: null,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Pillar draft created");
  });

  it("opens a KPI and records nullable-safe progress from the detail drawer", async () => {
    renderPage();
    openTab(/KPIs & Progress/);
    fireEvent.click(screen.getByRole("button", { name: /Log progress/ }));

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getAllByText("63.5 %").length).toBeGreaterThan(0);
    expect(within(drawer).getByText("Monthly observation")).toBeInTheDocument();
    fireEvent.change(within(drawer).getByLabelText("Reported value"), { target: { value: "70" } });
    fireEvent.change(within(drawer).getByLabelText("Observation note"), { target: { value: "Quarterly review" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Record" }));

    await waitFor(() =>
      expect(session.progress).toHaveBeenCalledWith({
        elementId: "kpi-1",
        body: {
          reportedValue: 70,
          note: "Quarterly review",
        },
      }),
    );
  });

  it("creates a non-pillar only with an active parent and responsible unit", async () => {
    session.orgNodes = [{
      id: "node-1",
      organizationId: "org-1",
      parentId: null,
      name: "Risk & Compliance",
      type: "DEPARTMENT",
      description: null,
      headcount: null,
      location: null,
      riskRating: null,
      regulatoryBody: null,
      contactEmail: null,
      costCenterCode: null,
      metadata: null,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }];
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /New element/ })[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Element type *"));
    fireEvent.click(await screen.findByText("Objective"));
    fireEvent.click(within(dialog).getByLabelText("Responsible unit *"));
    fireEvent.click(await screen.findByText("Risk & Compliance"));
    fireEvent.change(within(dialog).getByLabelText("Title *"), { target: { value: "Meet regulatory obligations" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create draft" }));

    await waitFor(() => expect(session.create).toHaveBeenCalledWith(expect.objectContaining({
      type: "OBJECTIVE",
      parentElementId: "pillar-1",
      orgNodeId: "node-1",
      title: "Meet regulatory obligations",
    })));
  });

  it("prevents read-only viewers from recording KPI progress", async () => {
    session.permissions = [];
    renderPage();
    openTab(/KPIs & Progress/);
    fireEvent.click(screen.getByRole("button", { name: /View KPI/ }));

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).queryByRole("button", { name: "Record" })).not.toBeInTheDocument();
    expect(within(drawer).getByText(/Read-only view/)).toBeInTheDocument();
  });

  it("creates an immutable version with editable planning periods", async () => {
    renderPage();
    openTab(/KPIs & Progress/);
    fireEvent.click(screen.getByRole("button", { name: /Log progress/ }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(within(drawer).getByRole("button", { name: /New version/ }));
    fireEvent.change(within(drawer).getByLabelText("Title *"), { target: { value: "Digital adoption v2" } });
    fireEvent.change(within(drawer).getByLabelText("Period start"), { target: { value: "2027-01-01" } });
    fireEvent.change(within(drawer).getByLabelText("Period end"), { target: { value: "2027-12-31" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "Create draft" }));

    await waitFor(() => expect(session.createVersion).toHaveBeenCalledWith({
      elementId: "kpi-1",
      body: expect.objectContaining({
        title: "Digital adoption v2",
        targetValue: 90,
        unit: "%",
        periodStart: "2027-01-01",
        periodEnd: "2027-12-31",
      }),
    }));
  });

  it("exposes approval decisions only after a draft is submitted", async () => {
    session.detailHasDraft = true;
    session.publish.mockResolvedValueOnce({ current: false, versionId: "kpi-v2" });
    renderPage();
    openTab(/KPIs & Progress/);
    fireEvent.click(screen.getByRole("button", { name: /Log progress/ }));
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole("button", { name: /Submit for publication/ }));
    fireEvent.click(await within(drawer).findByRole("button", { name: "Approve" }));

    await waitFor(() => expect(session.decide).toHaveBeenCalledWith({
      elementId: "kpi-1",
      versionId: "kpi-v2",
      body: { decision: "APPROVE", comments: null },
    }));
  });

  it("updates publication settings through the settings dialog", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("switch", { name: "Require publication approval" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save settings" }));

    await waitFor(() => expect(session.updateSettings).toHaveBeenCalledWith({
      requiresApproval: false,
      strictTypeHierarchy: false,
    }));
  });
});
