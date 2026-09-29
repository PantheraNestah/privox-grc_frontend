import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import RiskStrategy from "./RiskStrategy";
import * as orgNodesApi from "@/lib/orgNodes";
import * as riskStrategyApi from "@/lib/riskStrategy";
import type { OrgNodeResponse, RiskStrategyConfigResponse } from "@/lib/governance-types";

const session = vi.hoisted(() => ({ permissions: ["organization.manage"] as string[], hasModule: true }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    organization: { id: "org-1", code: "ORG", name: "Org" },
    permissions: session.permissions,
    hasModule: () => session.hasModule,
  }),
}));

const saved = {
  id: "cfg-1",
  organizationId: "org-1",
  orgNodeId: null,
  version: 1,
  current: true,
  levels: 3,
  likelihoodMode: "BOTH",
  toleranceThreshold: null,
  reviewFrequency: "ANNUALLY",
  lastReviewedAt: null,
  approvedByUserId: null,
  approvedAt: null,
  createdByUserId: "u1",
  createdAt: "2026-09-01T00:00:00Z",
  appetiteCategories: [{ id: "a1", name: "Strategic", statement: "Low appetite" }],
  likelihoodBands: { probability: [], timeline: [] },
  impactParameters: [],
} as unknown as RiskStrategyConfigResponse;

const httpError = (status: number) =>
  new AxiosError("failed", String(status), undefined, undefined, { status } as AxiosResponse);

const orgNode = (overrides: Partial<OrgNodeResponse>): OrgNodeResponse =>
  ({
    id: "node-1",
    organizationId: "org-1",
    parentId: null,
    name: "Unit",
    type: "DEPARTMENT",
    description: null,
    headcount: null,
    location: null,
    riskRating: null,
    regulatoryBody: null,
    contactEmail: null,
    costCenterCode: null,
    metadata: null,
    effectiveFrom: "2026-01-01T00:00:00Z",
    effectiveTo: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as OrgNodeResponse;

const deptNode = orgNode({ id: "node-ap", name: "Accounts Payable" });
const retiredNode = orgNode({ id: "node-old", name: "Retired Unit", effectiveTo: "2026-06-01T00:00:00Z" });

async function selectScope(name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: /Risk strategy scope/i }));
  fireEvent.click(await screen.findByRole("option", { name }));
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter>
          <RiskStrategy />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

describe("RiskStrategy", () => {
  beforeEach(() => {
    session.permissions = ["organization.manage"];
    session.hasModule = true;
    vi.spyOn(riskStrategyApi, "fetchCurrentRiskStrategy").mockResolvedValue(saved);
    vi.spyOn(riskStrategyApi, "fetchRiskStrategyHistory").mockResolvedValue([]);
    vi.spyOn(riskStrategyApi, "createRiskStrategyVersion").mockResolvedValue({ ...saved, id: "cfg-2", version: 2 });
    vi.spyOn(orgNodesApi, "fetchOrgNodes").mockResolvedValue([]);
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows the saved configuration read-only to non-admins", async () => {
    session.permissions = [];
    renderPage();

    expect(await screen.findByDisplayValue("Low appetite")).toBeDisabled();
    expect(screen.getByText("Read-only view")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
  });

  it("starts from the default categories when no version has been approved yet", async () => {
    vi.mocked(riskStrategyApi.fetchCurrentRiskStrategy).mockRejectedValue(httpError(404));
    renderPage();

    expect(await screen.findByDisplayValue("Cyber & Information Security")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save/ })).toBeEnabled();
  });

  it("refuses to show editable defaults when loading fails for another reason", async () => {
    vi.mocked(riskStrategyApi.fetchCurrentRiskStrategy).mockRejectedValue(httpError(500));
    renderPage();

    expect(await screen.findByText("Couldn't load the risk strategy")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
  });

  it("tracks unsaved edits and saves them as a new version", async () => {
    renderPage();
    const statement = await screen.findByDisplayValue("Low appetite");
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();

    fireEvent.change(statement, { target: { value: "Very low appetite" } });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() =>
      expect(riskStrategyApi.createRiskStrategyVersion).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          appetiteCategories: [{ name: "Strategic", statement: "Very low appetite" }],
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
  });

  it("lets an approver approve a pending draft with a comment", async () => {
    session.permissions = ["strategy.approve"];
    const pending = { ...saved, id: "cfg-2", version: 2, current: false, approvalStatus: "PENDING" as const };
    vi.spyOn(riskStrategyApi, "fetchRiskStrategyHistory").mockResolvedValue([pending, saved]);
    const decide = vi
      .spyOn(riskStrategyApi, "decideRiskStrategyVersion")
      .mockResolvedValue({ ...pending, current: true, approvalStatus: "APPROVED" });
    renderPage();

    expect(await screen.findByText(/Draft version v2 pending approval/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Approve version/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Decision comments/), {
      target: { value: "Aligned with the enterprise risk assessment." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /Confirm & activate/ }));

    await waitFor(() =>
      expect(decide).toHaveBeenCalledWith("org-1", "cfg-2", {
        decision: "APPROVE",
        comments: "Aligned with the enterprise risk assessment.",
      }),
    );
  });

  it("asks for confirmation before resetting to defaults", async () => {
    renderPage();
    await screen.findByDisplayValue("Low appetite");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(riskStrategyApi.createRiskStrategyVersion).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Reset" }).at(-1)!);

    await waitFor(() =>
      expect(riskStrategyApi.createRiskStrategyVersion).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({ appetiteCategories: expect.arrayContaining([{ name: "Compliance", statement: "" }]) }),
      ),
    );
    expect(dialog).toBeDefined();
  });

  it("blocks unallocated users and issues no risk-strategy requests", async () => {
    session.permissions = [];
    session.hasModule = false;
    renderPage();

    expect(await screen.findByText("Governance module not allocated")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
    expect(riskStrategyApi.fetchCurrentRiskStrategy).not.toHaveBeenCalled();
    expect(riskStrategyApi.fetchRiskStrategyHistory).not.toHaveBeenCalled();
    expect(orgNodesApi.fetchOrgNodes).not.toHaveBeenCalled();
  });

  it("lists active units in the scope selector and hides retired ones", async () => {
    vi.mocked(orgNodesApi.fetchOrgNodes).mockResolvedValue([deptNode, retiredNode]);
    renderPage();
    await screen.findByDisplayValue("Low appetite");

    fireEvent.click(screen.getByRole("combobox", { name: /Risk strategy scope/i }));

    expect(await screen.findByRole("option", { name: "Accounts Payable" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Enterprise Baseline/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Retired Unit" })).not.toBeInTheDocument();
  });

  it("loads a unit's localized strategy and scopes the saved proposal to it", async () => {
    const localized = {
      ...saved,
      id: "cfg-ap",
      orgNodeId: "node-ap",
      version: 3,
      appetiteCategories: [{ id: "a-ap", name: "Strategic", statement: "Localized appetite" }],
    } as unknown as RiskStrategyConfigResponse;

    vi.mocked(orgNodesApi.fetchOrgNodes).mockResolvedValue([deptNode]);
    vi.mocked(riskStrategyApi.fetchCurrentRiskStrategy).mockImplementation(async (_orgId, orgNodeId) =>
      orgNodeId === "node-ap" ? localized : saved,
    );
    vi.mocked(riskStrategyApi.fetchRiskStrategyHistory).mockImplementation(async (_orgId, orgNodeId) =>
      orgNodeId === "node-ap" ? [localized] : [saved],
    );

    renderPage();
    await screen.findByDisplayValue("Low appetite");

    await selectScope("Accounts Payable");
    const localizedField = await screen.findByDisplayValue("Localized appetite");
    expect(riskStrategyApi.fetchCurrentRiskStrategy).toHaveBeenCalledWith("org-1", "node-ap");

    fireEvent.change(localizedField, { target: { value: "Unit appetite" } });
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() =>
      expect(riskStrategyApi.createRiskStrategyVersion).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          orgNodeId: "node-ap",
          appetiteCategories: [{ name: "Strategic", statement: "Unit appetite" }],
        }),
      ),
    );
  });

  it("flags an inherited configuration when the selected unit has no localized strategy", async () => {
    vi.mocked(orgNodesApi.fetchOrgNodes).mockResolvedValue([deptNode]);
    // The backend's hierarchical fallback returns the parent/enterprise version.
    const inherited = { ...saved, orgNodeId: "node-parent" } as RiskStrategyConfigResponse;
    vi.mocked(riskStrategyApi.fetchCurrentRiskStrategy).mockImplementation(async (_orgId, orgNodeId) =>
      orgNodeId === "node-ap" ? inherited : saved,
    );
    vi.mocked(riskStrategyApi.fetchRiskStrategyHistory).mockImplementation(async (_orgId, orgNodeId) =>
      orgNodeId === "node-ap" ? [inherited] : [saved],
    );

    renderPage();
    await screen.findByDisplayValue("Low appetite");
    expect(screen.queryByText("Inherited Configuration")).not.toBeInTheDocument();

    await selectScope("Accounts Payable");

    expect(await screen.findByText("Inherited Configuration")).toBeInTheDocument();
    expect(screen.getByText(/a parent unit/)).toBeInTheDocument();
  });
});
