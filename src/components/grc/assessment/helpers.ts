import type { Initiative, StrategyConfig } from "@/data/strategyStore";
import { assessmentScore, type InitiativeAssessment } from "@/data/assessmentStore";

export interface VisibleRow {
  pillarId: string;
  pillarName: string;
  objectiveId: string;
  objectiveTitle: string;
  objLinkedOrgNodeIds: string[];
  init: Initiative;
}

/**
 * Flat list of initiatives a user may see. Global viewers see everything;
 * everyone else only initiatives whose objective is linked to their unit (or a
 * unit below it), so an unscoped user sees nothing.
 */
export function buildVisibleRows(
  cfg: StrategyConfig,
  scope: { isGlobalViewer: boolean; userScopeNodeIds: ReadonlySet<string> },
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  cfg.pillars.forEach((p) => {
    cfg.objectives
      .filter((o) => o.pillarId === p.id)
      .forEach((o) => {
        if (!scope.isGlobalViewer) {
          if (scope.userScopeNodeIds.size === 0) return;
          if (!o.linkedOrgNodeIds.some((id) => scope.userScopeNodeIds.has(id))) return;
        }
        o.initiatives.forEach((init) => {
          rows.push({
            pillarId: p.id,
            pillarName: p.name,
            objectiveId: o.id,
            objectiveTitle: o.title,
            objLinkedOrgNodeIds: o.linkedOrgNodeIds,
            init,
          });
        });
      });
  });
  return rows;
}

export const isAwaitingDecision = (a: InitiativeAssessment) =>
  a.status === "submitted" || a.status === "in_review";

export function computeStats(initiativeCount: number, assessments: InitiativeAssessment[]) {
  return {
    total: initiativeCount,
    draft: assessments.filter((a) => a.status === "draft").length,
    submitted: assessments.filter(isAwaitingDecision).length,
    approved: assessments.filter((a) => a.status === "approved").length,
    rejected: assessments.filter((a) => a.status === "rejected").length,
  };
}

export interface PillarPerformance {
  id: string;
  name: string;
  avg: number;
  count: number;
}

/** Average % achievement per pillar over assessed initiatives (unscored ones are skipped). */
export function computePillarPerformance(
  cfg: StrategyConfig,
  rows: Pick<VisibleRow, "pillarId" | "init">[],
  assessments: InitiativeAssessment[],
): PillarPerformance[] {
  const byPillar = new Map<string, { name: string; scores: number[] }>();
  cfg.pillars.forEach((p) => byPillar.set(p.id, { name: p.name, scores: [] }));
  rows.forEach((r) => {
    const a = assessments.find((x) => x.initiativeId === r.init.id);
    if (!a || a.kpiAssessments.length === 0) return;
    byPillar.get(r.pillarId)?.scores.push(assessmentScore(a));
  });
  return Array.from(byPillar.entries()).map(([id, v]) => ({
    id,
    name: v.name,
    count: v.scores.length,
    avg: v.scores.length === 0 ? 0 : Math.round(v.scores.reduce((s, n) => s + n, 0) / v.scores.length),
  }));
}

/** Mean of the pillar averages, ignoring pillars with nothing assessed. */
export function overallScore(perf: PillarPerformance[]): number {
  const assessed = perf.filter((p) => p.count > 0);
  if (assessed.length === 0) return 0;
  return Math.round(assessed.reduce((s, p) => s + p.avg, 0) / assessed.length);
}

export function performanceLabel(score: number): "On Track" | "At Risk" | "Off Track" {
  return score >= 75 ? "On Track" : score >= 50 ? "At Risk" : "Off Track";
}

/** Concrete reasons an approver's queue is empty. */
export function approvalEmptyReasons(args: {
  roleLabel: string;
  canApproveRole: boolean;
  isAdmin: boolean;
  hasOrgUnit: boolean;
  submittedCount: number;
}): string[] {
  const { roleLabel, canApproveRole, isAdmin, hasOrgUnit, submittedCount } = args;
  const reasons: string[] = [];
  if (!canApproveRole) reasons.push(`Your role (${roleLabel}) cannot approve assessments.`);
  if (canApproveRole && !isAdmin && !hasOrgUnit) {
    reasons.push("You aren't linked to an org unit, so the system can't tell which submissions sit below you.");
  }
  if (submittedCount === 0) reasons.push("No one has submitted an assessment yet.");
  if (submittedCount > 0 && canApproveRole && (isAdmin || hasOrgUnit)) {
    reasons.push(
      `${submittedCount} assessment${submittedCount === 1 ? " is" : "s are"} pending — but the submitter${
        submittedCount === 1 ? " sits" : "s sit"
      } outside your branch of the hierarchy.`,
    );
  }
  return reasons;
}
