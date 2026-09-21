import { fireEvent, render, screen, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import StrategyAssessment from "./StrategyAssessment";
import type { InitiativeAssessment } from "@/data/assessmentStore";
import type { StrategyConfig } from "@/data/strategyStore";
import type { AppUser } from "@/data/userStore";

const state = vi.hoisted(() => ({
  cfg: { pillars: [], objectives: [] } as unknown as StrategyConfig,
  assessments: [] as InitiativeAssessment[],
  saved: [] as InitiativeAssessment[][],
}));

const admin: AppUser = { id: "u1", name: "Ada Admin", email: "ada@example.com", role: "admin", createdAt: "" };

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/use-active-user", () => ({ useActiveUser: () => admin }));
vi.mock("@/data/strategyStore", async (orig) => ({
  ...(await orig<typeof import("@/data/strategyStore")>()),
  loadStrategy: () => state.cfg,
}));
vi.mock("@/data/orgStore", async (orig) => ({
  ...(await orig<typeof import("@/data/orgStore")>()),
  loadOrgNodes: () => [],
}));
vi.mock("@/data/userStore", async (orig) => ({
  ...(await orig<typeof import("@/data/userStore")>()),
  loadUsers: () => [admin],
}));
vi.mock("@/data/assessmentStore", async (orig) => ({
  ...(await orig<typeof import("@/data/assessmentStore")>()),
  loadAssessments: () => state.assessments,
  saveAssessments: (list: InitiativeAssessment[]) => {
    state.saved.push(list);
  },
}));

const configWithInitiative = (): StrategyConfig =>
  ({
    pillars: [{ id: "p1", name: "Growth" }],
    objectives: [
      {
        id: "o1",
        pillarId: "p1",
        title: "Grow premium income",
        linkedOrgNodeIds: [],
        initiatives: [
          {
            id: "i1",
            name: "Launch bancassurance",
            status: "in-progress",
            kpis: [{ id: "k1", name: "Premium growth", type: "quantitative", target: "20", unit: "%", status: "on-track" }],
          },
        ],
      },
    ],
  }) as unknown as StrategyConfig;

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <StrategyAssessment />
      </MemoryRouter>
    </HelmetProvider>,
  );

const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole("tab", { name }));

describe("StrategyAssessment", () => {
  beforeEach(() => {
    state.cfg = { pillars: [], objectives: [] } as unknown as StrategyConfig;
    state.assessments = [];
    state.saved = [];
  });

  it("renders the header, viewer context and an empty state without a strategy", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Performance Assessment" })).toBeInTheDocument();
    expect(screen.getByText(/Viewing as/)).toHaveTextContent("Ada Admin");
    expect(screen.getByText("No initiatives to assess")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Strategy Formulation" })).toHaveAttribute(
      "href",
      "/governance/strategy-formulation",
    );
  });

  it("lists initiatives and lets a user score KPIs and submit for approval", () => {
    state.cfg = configWithInitiative();
    renderPage();

    expect(screen.getByText("Launch bancassurance")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("% Achieved"), { target: { value: "80" } });
    expect(within(dialog).getByText("80%")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /Submit for approval/ }));

    const last = state.saved[state.saved.length - 1];
    expect(last).toHaveLength(1);
    expect(last[0]).toMatchObject({ initiativeId: "i1", status: "submitted" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("refuses to submit an assessment with no scored KPIs", () => {
    state.cfg = configWithInitiative();
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Submit for approval/ }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(state.saved[state.saved.length - 1][0]).toMatchObject({ status: "draft" });
  });

  it("explains an empty approvals queue", () => {
    renderPage();
    openTab(/Approvals/);

    expect(screen.getByText("No assessments awaiting your approval")).toBeInTheDocument();
    expect(screen.getByText("No one has submitted an assessment yet.")).toBeInTheDocument();
  });

  it("shows pillar performance and insights on the reports tab", () => {
    state.cfg = configWithInitiative();
    renderPage();
    openTab(/Reports/);

    expect(screen.getByText("Performance by pillar")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Growth performance" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("Assessment insights")).toBeInTheDocument();
  });
});
