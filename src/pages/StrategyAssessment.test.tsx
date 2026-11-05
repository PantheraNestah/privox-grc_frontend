import { fireEvent, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import StrategyAssessment from "./StrategyAssessment";

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  pending: [] as unknown[],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    organization: { id: "org-1", code: "SIC", name: "Savanna" },
    permissions: mocks.permissions,
    hasModule: () => true,
  }),
}));

vi.mock("@/hooks/use-strategy-assessment", () => ({
  usePendingApprovals: () => ({ data: mocks.pending, isPending: false, error: null }),
}));

vi.mock("@/components/grc/assessment/ServerAssessmentViews", () => ({
  currentQuarter: () => ({ periodStart: "2026-04-01", periodEnd: "2026-06-30" }),
  PeriodBar: () => <div>period bar</div>,
  WorklistView: () => <div>worklist content</div>,
  ApprovalsView: () => <div>approvals content</div>,
  ReportsView: () => <div>reports content</div>,
  AssessmentSettingsDialog: () => <div>settings dialog</div>,
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <StrategyAssessment />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("StrategyAssessment page", () => {
  beforeEach(() => {
    mocks.permissions = [];
    mocks.pending = [];
  });

  it("opens on the initiatives worklist", () => {
    renderPage();
    expect(screen.getByText("worklist content")).toBeInTheDocument();
  });

  it("shows the number of revisions awaiting a decision on the approvals tab", () => {
    mocks.pending = [{ revisionId: "r1" }, { revisionId: "r2" }];
    renderPage();
    expect(screen.getByRole("tab", { name: /Approvals/ })).toHaveTextContent("2");
  });

  it("switches to reports", () => {
    renderPage();
    // Radix tabs activate on mouse-down.
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Reports/ }), { button: 0 });
    expect(screen.getByText("reports content")).toBeInTheDocument();
  });

  it("offers settings only to organization admins", () => {
    const { unmount } = renderPage();
    expect(screen.queryByRole("button", { name: /Settings/ })).not.toBeInTheDocument();
    unmount();

    mocks.permissions = ["organization.manage"];
    renderPage();
    expect(screen.getByRole("button", { name: /Settings/ })).toBeInTheDocument();
  });
});
