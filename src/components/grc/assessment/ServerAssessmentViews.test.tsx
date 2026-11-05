import { fireEvent, render, screen } from "@testing-library/react";
import { ApprovalsView } from "./ServerAssessmentViews";

const mocks = vi.hoisted(() => ({
  pending: [] as unknown[],
  decide: vi.fn(),
}));

vi.mock("@/hooks/use-strategy-assessment", () => ({
  usePendingApprovals: () => ({ data: mocks.pending, isPending: false, error: null }),
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
