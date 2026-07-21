// Local-storage backed store for initiative self-assessments.
// Each assessment is per-initiative and goes through an approval chain
// derived from the Risk Governance org hierarchy.

import { uid } from "./orgStore";
import type { InitiativeStatus, KpiStatus, EvidenceFile, ApprovalStep, ApprovalDecision } from "./strategyStore";

export type AssessmentStatus = "draft" | "submitted" | "in_review" | "approved" | "rejected";

export type RagStatus = "red" | "amber" | "green";

export interface KpiAssessment {
  kpiId: string;
  actual?: string;                 // free-text actual value (qualitative or formatted)
  actualValue?: number;            // numeric actual for quantitative KPIs
  percentAchievement?: number;     // 0-100 derived or user-entered
  rag?: RagStatus;                 // red / amber / green status
  status: KpiStatus;               // legacy status (kept for back-compat)
  note?: string;
}

export interface OutcomeAssessment {
  outcomeId: string;
  achieved: boolean;
  note?: string;
}

export interface ActivityAssessment {
  activityId: string;
  status: "not-started" | "in-progress" | "completed" | "blocked";
  note?: string;
}

export interface AssessmentComment {
  id: string;
  authorUserId: string;
  authorName: string;
  authorRole: string;
  text: string;
  createdAt: string;
}

export interface InitiativeAssessment {
  id: string;
  initiativeId: string;
  objectiveId: string;
  pillarId: string;

  status: AssessmentStatus;
  initiativeStatus: InitiativeStatus;
  narrative?: string;          // self-assessment summary

  activityAssessments: ActivityAssessment[];
  outcomeAssessments: OutcomeAssessment[];
  kpiAssessments: KpiAssessment[];
  evidence: EvidenceFile[];
  approvals: ApprovalStep[];   // ordered chain (built from org hierarchy)
  comments: AssessmentComment[];

  createdByUserId: string;
  createdAt: string;
  submittedAt?: string;
  updatedAt: string;

  /**
   * Optional explicit approver assigned via upward delegation. When set, this user (and only this
   * user, plus admins as a final safety net) is treated as the eligible approver — overriding the
   * normal hierarchical routing. Used when an approver wants to escalate/delegate the decision
   * upward to a more senior approver anywhere in the system.
   */
  delegatedToUserId?: string;
}

const KEY = "rsolve.assessments.v1";

interface Store {
  assessments: InitiativeAssessment[];
}

const SEED: Store = { assessments: [] };

export function loadAssessments(): InitiativeAssessment[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return [];
    }
    const parsed = JSON.parse(raw) as Store;
    return parsed.assessments ?? [];
  } catch {
    return [];
  }
}

export function saveAssessments(list: InitiativeAssessment[]) {
  localStorage.setItem(KEY, JSON.stringify({ assessments: list }));
}

export function newAssessment(args: {
  initiativeId: string;
  objectiveId: string;
  pillarId: string;
  createdByUserId: string;
  initiativeStatus?: InitiativeStatus;
}): InitiativeAssessment {
  const now = new Date().toISOString();
  return {
    id: uid("ast"),
    initiativeId: args.initiativeId,
    objectiveId: args.objectiveId,
    pillarId: args.pillarId,
    status: "draft",
    initiativeStatus: args.initiativeStatus ?? "not-started",
    narrative: "",
    activityAssessments: [],
    outcomeAssessments: [],
    kpiAssessments: [],
    evidence: [],
    approvals: [],
    comments: [],
    createdByUserId: args.createdByUserId,
    createdAt: now,
    updatedAt: now,
  };
}

export function newAssessmentComment(authorUserId: string, authorName: string, authorRole: string, text: string): AssessmentComment {
  return {
    id: uid("cmt"),
    authorUserId,
    authorName,
    authorRole,
    text,
    createdAt: new Date().toISOString(),
  };
}

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  draft: "Draft (Input User)",
  submitted: "Awaiting Approver",
  in_review: "Awaiting Risk Manager",
  approved: "Approved",
  rejected: "Rejected",
};

export const ASSESSMENT_STATUS_COLORS: Record<AssessmentStatus, string> = {
  draft: "215 16% 47%",
  submitted: "210 61% 49%",
  in_review: "34 89% 61%",
  approved: "158 53% 49%",
  rejected: "352 70% 61%",
};

/**
 * Recomputes overall assessment.status from approval decisions.
 */
export function recomputeStatus(a: InitiativeAssessment): AssessmentStatus {
  if (a.status === "draft") return "draft";
  if (a.approvals.length === 0) return a.status;
  const decisions = a.approvals.map(s => s.decision);
  if (decisions.some(d => d === "rejected")) return "rejected";
  if (decisions.every(d => d === "approved")) return "approved";
  if (decisions.some(d => d === "approved")) return "in_review";
  return "submitted";
}

export type { ApprovalDecision };

// ---- RAG helpers ----
export const RAG_LABELS: Record<RagStatus, string> = { red: "Red", amber: "Amber", green: "Green" };
export const RAG_COLORS: Record<RagStatus, string> = {
  red:   "0 70% 50%",
  amber: "34 89% 55%",
  green: "142 64% 40%",
};

/** Map a percent achievement (0-100) to a RAG band. */
export function ragFromPercent(pct: number | undefined): RagStatus {
  if (pct == null || isNaN(pct)) return "amber";
  if (pct >= 75) return "green";
  if (pct >= 50) return "amber";
  return "red";
}

/** Compute average percent achievement across all KPI assessments in a single assessment. */
export function assessmentScore(a: InitiativeAssessment): number {
  const vals = a.kpiAssessments.map(k => k.percentAchievement).filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}
