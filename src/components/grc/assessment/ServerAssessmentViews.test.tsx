import { fireEvent, render, screen } from "@testing-library/react";
import { AxiosError } from "axios";
import { ApprovalsView, WorklistView } from "./ServerAssessmentViews";

const mocks = vi.hoisted(() => ({
  pending: [] as unknown[],
  decide: vi.fn(),
  worklist: { data: [] as unknown[], isPending: false, isError: false, error: null as unknown, refetch: vi.fn() },
}));

vi.mock("@/hooks/use-strategy-assessment", () => ({
  usePendingApprovals: () => ({ data: mocks.pending, isPending: false, isError: false, error: null, refetch: vi.fn() }),
  useWorklist: () => mocks.worklist,
  useAssessment: () => ({ data: { elementTitle: "Grow claims" }, isPending: false }),
  useDecideRevision: () => ({ mutateAsync: mocks.decide, isPending: false }),
}));

const revision = {
  assessmentId: "a1",
  revisionId: "r1",
  revision: 2,
  status: "SUBMITTED",
  initiativeStatus: "IN_PROGRESS",
  kpiLines: [],
  evidence: [],
  lockVersion: 1,
  current: false,
  createdAt: "2026-05-01T00:00:00Z",
  computedRag: "GREEN",
  finalRag: "GREEN",
  computedScore: 88,
};

describe("ApprovalsView decisions", () => {
  beforeEach(() => {
    mocks.pending = [revision];
    mocks.decide.mockReset();
  });

  it("requires a comment before a revision can be requested", () => {
    render(<ApprovalsView orgId="org-1" canApprove />);
    fireEvent.click(screen.getByRole("button", { name: /Grow claims/ }));
    fireEvent.click(screen.getByRole("button", { name: "Request changes" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Add a comment");
    expect(mocks.decide).not.toHaveBeenCalled();
  });

  it("sends an approval without a comment", async () => {
    mocks.decide.mockResolvedValue({});
    render(<ApprovalsView orgId="org-1" canApprove />);
    fireEvent.click(screen.getByRole("button", { name: /Grow claims/ }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(mocks.decide).toHaveBeenCalledWith({ revisionId: "r1", decision: "APPROVE", comments: undefined });
  });
});

const period = { periodStart: "2026-04-01", periodEnd: "2026-06-30" };

describe("WorklistView empty versus failed", () => {
  beforeEach(() => {
    mocks.worklist = { data: [], isPending: false, isError: false, error: null, refetch: vi.fn() };
  });

  it("shows a calm empty state when there is simply nothing to assess", () => {
    render(<WorklistView orgId="org-1" period={period} canContribute />);
    expect(screen.getByText("No initiatives to assess")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/Couldn't load/)).not.toBeInTheDocument();
  });

  it("shows a retryable failure for a server fault", () => {
    mocks.worklist = {
      data: undefined as never,
      isPending: false,
      isError: true,
      error: new AxiosError("boom", "500", undefined, undefined, { status: 500 } as never),
      refetch: vi.fn(),
    };
    render(<WorklistView orgId="org-1" period={period} canContribute />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load initiatives");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("treats a missing endpoint as 'not available' rather than an error with a retry", () => {
    mocks.worklist = {
      data: undefined as never,
      isPending: false,
      isError: true,
      error: new AxiosError("missing", "404", undefined, undefined, { status: 404 } as never),
      refetch: vi.fn(),
    };
    render(<WorklistView orgId="org-1" period={period} canContribute />);
    expect(screen.getByRole("alert")).toHaveTextContent("isn't available here");
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });
});
