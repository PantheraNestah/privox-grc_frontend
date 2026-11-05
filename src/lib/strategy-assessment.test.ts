import { api } from "./api";
import { assessmentErrorMessage, ragLabel, saveDraft, submitRevision, type UpdateDraftRequest } from "./strategy-assessment";
import { currentQuarter } from "@/components/grc/assessment/ServerAssessmentViews";

const httpError = (status: number, message?: string) => ({ response: { status, data: { message } } });

describe("assessmentErrorMessage", () => {
  it("tells the user to resync when the initiative changed", () => {
    expect(assessmentErrorMessage(httpError(409, "Stale KPI definitions"))).toMatch(/Resync/);
  });

  it("explains a concurrent edit", () => {
    expect(assessmentErrorMessage(httpError(409, "CONCURRENT_MODIFICATION: lock"))).toMatch(/Reload/);
  });

  it("explains that every revision was discarded", () => {
    expect(assessmentErrorMessage(httpError(409, "Cannot amend: every revision of this assessment was discarded"))).toMatch(/nothing to amend/);
  });

  it("speaks plainly about forbidden actions", () => {
    expect(assessmentErrorMessage(httpError(403))).toMatch(/access/);
  });

  it("falls back to the server message for other statuses", () => {
    expect(assessmentErrorMessage(httpError(400, "Override needs a reason"))).toBe("Override needs a reason");
  });
});

describe("ragLabel", () => {
  it("labels every rating, including not rated", () => {
    expect(ragLabel("GREEN")).toBe("Green");
    expect(ragLabel("NOT_RATED")).toBe("Not rated");
    expect(ragLabel(null)).toBe("Not rated");
  });
});

describe("submitRevision", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the 202 status so the UI says it went to approval", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ status: 202, data: { revisionId: "r1" } } as never);
    const result = await submitRevision("org-1", "r1");
    expect(result.httpStatus).toBe(202);
  });
});

describe("saveDraft", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the full draft with the lock version it was loaded at", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: { revisionId: "r1", lockVersion: 4 } } as never);
    const body: UpdateDraftRequest = {
      lockVersion: 3,
      initiativeStatus: "IN_PROGRESS",
      narrative: "On track",
      overrideRag: null,
      overrideReason: null,
      kpiLines: [{ kpiElementId: "k1", actualValue: 9, actualSource: "MANUAL", note: null }],
      evidence: [],
    };
    await saveDraft("org-1", "r1", body);
    expect(put).toHaveBeenCalledWith("/v1/organizations/org-1/strategy-assessment/revisions/r1", body);
  });
});

describe("currentQuarter", () => {
  it("returns the calendar quarter that contains the date", () => {
    expect(currentQuarter(new Date(2026, 4, 15))).toEqual({ periodStart: "2026-04-01", periodEnd: "2026-06-30" });
    expect(currentQuarter(new Date(2026, 0, 1))).toEqual({ periodStart: "2026-01-01", periodEnd: "2026-03-31" });
  });
});
