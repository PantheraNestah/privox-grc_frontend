import { fireEvent, render, screen } from "@testing-library/react";
import { BatchReportView, StrategyBulkView } from "./StrategyBulkViews";
import type { BatchReport } from "@/lib/strategy-batches";

const mocks = vi.hoisted(() => ({
  dryRun: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("@/hooks/use-strategy-batches", () => ({
  useBatchDryRun: () => ({ mutateAsync: mocks.dryRun, isPending: false }),
  useBatchSubmit: () => ({ mutateAsync: mocks.submit, isPending: false }),
  useBatchDecision: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useStrategyBatches: () => ({ data: [], isPending: false, error: null }),
  useStrategyBatch: () => ({ data: undefined, isPending: false, error: null }),
  useStrategyHierarchyRules: () => ({ data: undefined, isPending: true, error: null }),
  useStrategyConformance: () => ({ data: undefined, isPending: true, error: null }),
}));

const invalidReport: BatchReport = {
  dryRun: true,
  outcome: "INVALID",
  summary: { total: 3, create: 2, newVersion: 0, unchanged: 1, errors: 1, warnings: 1 },
  issues: [
    {
      severity: "ERROR",
      rule: "N-2",
      item: "P1.K1",
      message: "Org node 'Claims' matches more than one unit.",
      source: { pointer: "/elements/0/orgNode" },
      candidates: ["Head Office / Claims", "Nairobi / Claims"],
    },
    { severity: "WARNING", rule: "W-1", item: "P1", message: "Title is long.", source: null },
  ],
  tree: [
    {
      type: "PILLAR",
      code: "P1",
      title: "Customer trust",
      action: "CREATE",
      status: "OK",
      children: [
        {
          type: "KPI",
          code: "P1.K1",
          title: "Median days to settle",
          action: "CREATE",
          status: "ERROR",
          orgNode: { path: "Head Office / Claims", matchedBy: "NAME" },
          children: [],
        },
      ],
    },
  ],
};

describe("BatchReportView", () => {
  it("shows the outcome, the counts, each issue with its rule and location, and the planned structure", () => {
    render(<BatchReportView report={invalidReport} />);

    expect(screen.getByText(/Invalid\. Fix the errors below\./)).toBeInTheDocument();
    expect(screen.getByText("Dry run, nothing written")).toBeInTheDocument();
    expect(screen.getByText("Org node 'Claims' matches more than one unit.")).toBeInTheDocument();
    expect(screen.getByText("N-2")).toBeInTheDocument();
    expect(screen.getByText(/at \/elements\/0\/orgNode/)).toBeInTheDocument();
    expect(screen.getByText("Customer trust")).toBeInTheDocument();
    expect(screen.getByText(/→ Head Office \/ Claims/)).toBeInTheDocument();
  });

  it("does not render an issues section when there are none", () => {
    render(<BatchReportView report={{ ...invalidReport, outcome: "VALID", issues: [] }} />);
    expect(screen.queryByText("Issues")).not.toBeInTheDocument();
  });
});

describe("StrategyBulkView submit gate", () => {
  beforeEach(() => {
    mocks.dryRun.mockReset();
    mocks.submit.mockReset();
  });

  it("keeps submit disabled until the same plan has been checked", async () => {
    mocks.dryRun.mockResolvedValue({ httpStatus: 200, report: { ...invalidReport, outcome: "VALID", issues: [] } });
    render(<StrategyBulkView orgId="org-1" canContribute canApprove={false} canManageSettings={false} />);

    const submit = screen.getByRole("button", { name: /^submit$/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Plan JSON"), {
      target: { value: '{"elements":[{"type":"PILLAR","code":"P1","title":"Trust"}]}' },
    });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /^check$/i }));
    await screen.findByText(/Valid\. Ready to submit\./);
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeEnabled();
  });

  it("blocks pasted text that is not JSON without calling the server", () => {
    render(<StrategyBulkView orgId="org-1" canContribute canApprove={false} canManageSettings={false} />);

    fireEvent.change(screen.getByLabelText("Plan JSON"), { target: { value: "{not json" } });
    fireEvent.click(screen.getByRole("button", { name: /^check$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Line \d+/);
    expect(mocks.dryRun).not.toHaveBeenCalled();
  });
});
