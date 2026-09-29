import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import RiskGovernance from "./RiskGovernance";
import * as orgNodes from "@/lib/orgNodes";
import * as orgNodeTemplates from "@/lib/orgNodeTemplates";
import * as strategyFormulation from "@/lib/strategy-formulation";
import type { OrgNodeResponse } from "@/lib/governance-types";

const auth = vi.hoisted(() => ({
  permissions: ["organization.manage"] as string[],
  hasModule: true,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: "u1", email: "admin@org.com", username: "admin", fullName: "Org Admin" },
    organization: { id: "org-1", code: "ORG", name: "Org" },
    permissions: auth.permissions,
    hasModule: () => auth.hasModule,
  }),
}));

// React Flow needs real layout, which jsdom lacks.
vi.mock("@/components/grc/OrgMapGraph", () => ({ OrgMapGraph: () => <div data-testid="org-map" /> }));
vi.mock("@/components/grc/OrgTreeGraph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/grc/OrgTreeGraph")>()),
  OrgTreeGraph: () => <div data-testid="tree-graph" />,
}));

const templates = [
  {
    id: "tpl-1",
    name: "Insurance Group Standard",
    description: "Group with core departments.",
    rootOrgNodeId: "r1",
    createdByUserId: "u0",
    createdAt: "2026-08-01T10:00:00Z",
  },
  {
    id: "tpl-2",
    name: "Lean Structure",
    description: null,
    rootOrgNodeId: "r2",
    createdByUserId: "u0",
    createdAt: "2026-08-02T10:00:00Z",
  },
];

const preview = {
  templateId: "tpl-1",
  name: "Insurance Group Standard",
  description: null,
  rootNode: {
    id: "n1",
    name: "Standard Group",
    type: "GROUP" as const,
    description: null,
    children: [
      { id: "n2", name: "Finance Department", type: "DEPARTMENT" as const, description: null, children: [] },
    ],
  },
};

const existingNode: OrgNodeResponse = {
  id: "node-1",
  organizationId: "org-1",
  parentId: null,
  name: "Acme Holdings",
  type: "GROUP",
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
};

const httpError = (status: number) =>
  new AxiosError("failed", String(status), undefined, undefined, { status, data: {} } as AxiosResponse);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter>
          <RiskGovernance />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

describe("RiskGovernance template cloning", () => {
  beforeEach(() => {
    auth.permissions = ["organization.manage"];
    auth.hasModule = true;
    localStorage.clear();
    vi.spyOn(orgNodes, "fetchOrgNodes").mockResolvedValue([]);
    vi.spyOn(orgNodeTemplates, "fetchOrgNodeTemplates").mockResolvedValue(templates);
    vi.spyOn(orgNodeTemplates, "fetchOrgNodeTemplatePreview").mockResolvedValue(preview);
    vi.spyOn(orgNodes, "cloneOrgNodeTemplate").mockResolvedValue(existingNode);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("blocks unallocated users and issues no organisation-tree request", async () => {
    auth.permissions = [];
    auth.hasModule = false;
    renderPage();

    expect(await screen.findByText("Governance module not allocated")).toBeInTheDocument();
    expect(screen.queryByText("Organisation Structure")).not.toBeInTheDocument();
    expect(orgNodes.fetchOrgNodes).not.toHaveBeenCalled();
  });

  it("offers templates when the organisation has no units yet", async () => {
    renderPage();

    expect(await screen.findByText("Start from a template")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Insurance Group Standard/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lean Structure/ })).toBeInTheDocument();
    expect(screen.getByText("Select a template to preview the structure it will create.")).toBeInTheDocument();
  });

  it("previews the selected template inline and clones it as a root", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Insurance Group Standard/ }));

    expect(await screen.findByText("Standard Group")).toBeInTheDocument();
    expect(screen.getByText("Finance Department")).toBeInTheDocument();
    expect(screen.getByText("2 units will be created.")).toBeInTheDocument();
    expect(orgNodeTemplates.fetchOrgNodeTemplatePreview).toHaveBeenCalledWith("tpl-1");

    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));

    await waitFor(() =>
      expect(orgNodes.cloneOrgNodeTemplate).toHaveBeenCalledWith("org-1", {
        templateId: "tpl-1",
        targetParentId: null,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("refetches the tree after a successful clone", async () => {
    renderPage();
    await screen.findByText("Start from a template");
    const before = vi.mocked(orgNodes.fetchOrgNodes).mock.calls.length;

    fireEvent.click(await screen.findByRole("button", { name: /Insurance Group Standard/ }));
    await screen.findByText("Standard Group");
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));

    await waitFor(() => expect(vi.mocked(orgNodes.fetchOrgNodes).mock.calls.length).toBeGreaterThan(before));
  });

  it("does not let users without organization.manage apply a template", async () => {
    auth.permissions = [];
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Insurance Group Standard/ }));
    await screen.findByText("Standard Group");

    expect(screen.getByRole("button", { name: "Use this template" })).toBeDisabled();
    expect(screen.getAllByText(/organization\.manage permission/).length).toBeGreaterThan(0);
    expect(orgNodes.cloneOrgNodeTemplate).not.toHaveBeenCalled();
  });

  it("shows an inline explanation and a toast when the API rejects the clone", async () => {
    vi.spyOn(orgNodes, "cloneOrgNodeTemplate").mockRejectedValue(httpError(403));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Insurance Group Standard/ }));
    await screen.findByText("Standard Group");
    fireEvent.click(screen.getByRole("button", { name: "Use this template" }));

    expect(await screen.findByText(/Governance module isn't enabled/)).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalled();
  });

  it("offers add-from-template on an existing tree and defaults to the top level", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodes").mockResolvedValue([existingNode]);
    renderPage();

    expect(screen.queryByText("Start from a template")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Add from template" }));
    fireEvent.click(await screen.findByRole("button", { name: /Lean Structure/ }));
    await waitFor(() => expect(orgNodeTemplates.fetchOrgNodeTemplatePreview).toHaveBeenCalledWith("tpl-2"));

    // Default target is the top level.
    fireEvent.click(await screen.findByRole("button", { name: "Use this template" }));
    await waitFor(() =>
      expect(orgNodes.cloneOrgNodeTemplate).toHaveBeenCalledWith("org-1", {
        templateId: "tpl-2",
        targetParentId: null,
      }),
    );
  });

  it("hides the add-from-template action for users without organization.manage", async () => {
    auth.permissions = [];
    vi.spyOn(orgNodes, "fetchOrgNodes").mockResolvedValue([existingNode]);
    renderPage();

    await screen.findByText("Acme Holdings");
    expect(screen.queryByRole("button", { name: "Add from template" })).not.toBeInTheDocument();
  });
});

describe("RiskGovernance strategy roll-up", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(orgNodes, "fetchOrgNodes").mockResolvedValue([existingNode]);
    vi.spyOn(strategyFormulation, "fetchStrategyTree").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("loads the strategy tree for a user who can work with the org tree", async () => {
    auth.permissions = ["orgnode.contribute"];
    renderPage();

    await waitFor(() => expect(strategyFormulation.fetchStrategyTree).toHaveBeenCalledWith("org-1"));
  });

  it("skips the strategy request for a read-only user instead of collecting a 403", async () => {
    auth.permissions = [];
    renderPage();

    expect(await screen.findByText("Read-only view")).toBeInTheDocument();
    expect(strategyFormulation.fetchStrategyTree).not.toHaveBeenCalled();
  });
});
