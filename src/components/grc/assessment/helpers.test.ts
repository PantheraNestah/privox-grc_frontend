import type { InitiativeAssessment } from "@/data/assessmentStore";
import type { StrategyConfig } from "@/data/strategyStore";
import { MAX_EVIDENCE_BYTES, readEvidenceFiles } from "./evidence";
import {
  approvalEmptyReasons,
  buildVisibleRows,
  computePillarPerformance,
  computeStats,
  overallScore,
  performanceLabel,
} from "./helpers";

const init = (id: string) => ({ id, name: id, kpis: [] }) as never;

const cfg = {
  pillars: [
    { id: "p1", name: "Growth" },
    { id: "p2", name: "Risk" },
  ],
  objectives: [
    { id: "o1", pillarId: "p1", title: "Grow", linkedOrgNodeIds: ["n1"], initiatives: [init("i1")] },
    { id: "o2", pillarId: "p2", title: "Control", linkedOrgNodeIds: ["n2"], initiatives: [init("i2")] },
  ],
} as unknown as StrategyConfig;

const assessment = (initiativeId: string, status: string, kpiCount: number, pct = 80) =>
  ({
    id: `a-${initiativeId}`,
    initiativeId,
    status,
    kpiAssessments: Array.from({ length: kpiCount }, (_, i) => ({
      kpiId: `k${i}`,
      status: "on-track",
      percentAchievement: pct,
    })),
  }) as unknown as InitiativeAssessment;

describe("buildVisibleRows", () => {
  it("shows everything to global viewers", () => {
    const rows = buildVisibleRows(cfg, { isGlobalViewer: true, userScopeNodeIds: new Set() });
    expect(rows.map((r) => r.init.id)).toEqual(["i1", "i2"]);
    expect(rows[0]).toMatchObject({ pillarName: "Growth", objectiveTitle: "Grow" });
  });

  it("limits scoped users to objectives linked to their unit chain", () => {
    const rows = buildVisibleRows(cfg, { isGlobalViewer: false, userScopeNodeIds: new Set(["n2"]) });
    expect(rows.map((r) => r.init.id)).toEqual(["i2"]);
  });

  it("shows an unscoped user nothing", () => {
    expect(buildVisibleRows(cfg, { isGlobalViewer: false, userScopeNodeIds: new Set() })).toEqual([]);
  });
});

describe("computeStats", () => {
  it("counts in_review together with submitted as awaiting approval", () => {
    const stats = computeStats(4, [
      assessment("i1", "draft", 0),
      assessment("i2", "submitted", 1),
      assessment("i3", "in_review", 1),
      assessment("i4", "approved", 1),
    ]);
    expect(stats).toEqual({ total: 4, draft: 1, submitted: 2, approved: 1, rejected: 0 });
  });
});

describe("pillar performance", () => {
  it("averages scored assessments per pillar and skips unscored ones", () => {
    const rows = buildVisibleRows(cfg, { isGlobalViewer: true, userScopeNodeIds: new Set() });
    const perf = computePillarPerformance(cfg, rows, [assessment("i1", "approved", 2, 80), assessment("i2", "draft", 0)]);
    expect(perf).toEqual([
      { id: "p1", name: "Growth", avg: 80, count: 1 },
      { id: "p2", name: "Risk", avg: 0, count: 0 },
    ]);
  });

  it("scores overall from assessed pillars only", () => {
    expect(overallScore([])).toBe(0);
    expect(
      overallScore([
        { id: "a", name: "A", avg: 90, count: 2 },
        { id: "b", name: "B", avg: 50, count: 1 },
        { id: "c", name: "C", avg: 0, count: 0 },
      ]),
    ).toBe(70);
  });

  it("labels score bands", () => {
    expect(performanceLabel(75)).toBe("On Track");
    expect(performanceLabel(50)).toBe("At Risk");
    expect(performanceLabel(49)).toBe("Off Track");
  });
});

describe("approvalEmptyReasons", () => {
  const base = { roleLabel: "Viewer", canApproveRole: true, isAdmin: false, hasOrgUnit: true, submittedCount: 0 };

  it("explains a role that cannot approve", () => {
    expect(approvalEmptyReasons({ ...base, canApproveRole: false })).toContain(
      "Your role (Viewer) cannot approve assessments.",
    );
  });

  it("explains a missing org unit for non-admins", () => {
    expect(approvalEmptyReasons({ ...base, hasOrgUnit: false })[0]).toMatch(/aren't linked to an org unit/);
    expect(approvalEmptyReasons({ ...base, hasOrgUnit: false, isAdmin: true })).not.toContain(
      "You aren't linked to an org unit, so the system can't tell which submissions sit below you.",
    );
  });

  it("distinguishes nothing submitted from submissions outside the branch", () => {
    expect(approvalEmptyReasons(base)).toEqual(["No one has submitted an assessment yet."]);
    expect(approvalEmptyReasons({ ...base, submittedCount: 1 })[0]).toMatch(/1 assessment is pending.*submitter sits/);
    expect(approvalEmptyReasons({ ...base, submittedCount: 2 })[0]).toMatch(/2 assessments are pending.*submitters sit/);
  });
});

describe("readEvidenceFiles", () => {
  it("attaches readable files and skips oversized ones", async () => {
    const ok = new File(["hello"], "proof.txt", { type: "text/plain" });
    const big = new File(["x"], "huge.bin");
    Object.defineProperty(big, "size", { value: MAX_EVIDENCE_BYTES + 1 });

    const { added, skipped } = await readEvidenceFiles([ok, big], "Ann");

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ name: "proof.txt", mimeType: "text/plain", uploadedBy: "Ann", size: 5 });
    expect(added[0].dataUrl).toMatch(/^data:text\/plain/);
    expect(skipped).toEqual([{ name: "huge.bin", reason: "too-large" }]);
  });
});
