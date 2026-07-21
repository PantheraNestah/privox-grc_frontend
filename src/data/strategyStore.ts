// Local-storage backed store for Organization Strategy Formulation.
// Hierarchy: Pillar -> Objective -> Initiative -> (Activities, Outcomes, KPIs)

import { uid } from "./orgStore";

export type KpiType = "quantitative" | "qualitative";
export type KpiStatus = "not-started" | "on-track" | "at-risk" | "off-track" | "met" | "not-met";

export type InitiativeStatus = "not-started" | "in-progress" | "completed";

export type ApprovalDecision = "pending" | "approved" | "rejected";

export interface EvidenceFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string; // base64 data URL stored locally
  uploadedAt: string; // ISO datetime
  uploadedBy?: string;
  note?: string;
}

export type ApprovalRole = "approver" | "risk_manager";

export interface ApprovalStep {
  id: string;
  role: ApprovalRole;           // which role is responsible for this step
  approverName?: string;        // optional named approver (filled when decided)
  approverUserId?: string;
  decision: ApprovalDecision;
  comment?: string;
  decidedAt?: string;           // ISO datetime
  // legacy field kept for migration; no longer drives logic
  orgNodeId?: string;
}

export interface Activity {
  id: string;
  description: string;
  owner?: string;
  dueDate?: string; // ISO yyyy-mm-dd
  status: "not-started" | "in-progress" | "completed" | "blocked";
}

export interface Outcome {
  id: string;
  description: string;
  expectedDate?: string;
  achieved: boolean;
}

export interface Kpi {
  id: string;
  name: string;
  type: KpiType;
  target?: string;       // qualitative target description OR quantitative target value
  unit?: string;         // for quantitative (e.g. %, USD, count)
  actual?: string;       // current/actual value or qualitative status note
  status: KpiStatus;
}

export type FormulationStatus = "draft" | "submitted" | "approved" | "rejected";

export interface Initiative {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  startDate?: string;
  expectedCompletion?: string;
  status: InitiativeStatus;
  activities: Activity[];
  outcomes: Outcome[];
  kpis: Kpi[];
  linkedKpiIds: string[];      // KPI ids (defined on this initiative) explicitly linked for tracking
  evidence: EvidenceFile[];    // performance evidence attachments
  approvals: ApprovalStep[];   // legacy assessment approval chain (kept for back-compat)
  formulationStatus: FormulationStatus;
  formulationApprovals: ApprovalStep[]; // 2-step: approver -> risk_manager
  submittedByUserId?: string;
  submittedAt?: string;
}

export interface StrategicObjective {
  id: string;
  pillarId: string;
  title: string;
  description?: string;
  linkedOrgNodeIds: string[]; // links to org structure (Risk Governance)
  initiatives: Initiative[];
}

export interface StrategicPillar {
  id: string;
  name: string;
  description?: string;
}

export interface StrategyConfig {
  pillars: StrategicPillar[];
  objectives: StrategicObjective[];
}

const KEY = "rsolve.strategy.v1";

const SEED: StrategyConfig = {
  pillars: [],
  objectives: [],
};

export function loadStrategy(): StrategyConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED));
      return SEED;
    }
    const parsed = JSON.parse(raw) as StrategyConfig;
    return {
      pillars: parsed.pillars ?? [],
      objectives: (parsed.objectives ?? []).map(o => ({
        ...o,
        initiatives: (o.initiatives ?? []).map(i => ({
          ...i,
          status: i.status ?? "not-started",
          linkedKpiIds: i.linkedKpiIds ?? (i.kpis ?? []).map(k => k.id),
          evidence: i.evidence ?? [],
          approvals: (i.approvals ?? []).map(a => ({ ...a, role: a.role ?? "approver" })),
          formulationStatus: i.formulationStatus ?? "draft",
          formulationApprovals: i.formulationApprovals ?? [],
        })),
      })),
    };
  } catch {
    return SEED;
  }
}

export function saveStrategy(cfg: StrategyConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export function newPillar(): StrategicPillar {
  return { id: uid("pil"), name: "", description: "" };
}

export function newObjective(pillarId: string): StrategicObjective {
  return {
    id: uid("obj"),
    pillarId,
    title: "",
    description: "",
    linkedOrgNodeIds: [],
    initiatives: [],
  };
}

export function newInitiative(): Initiative {
  return {
    id: uid("ini"),
    name: "",
    description: "",
    owner: "",
    startDate: "",
    expectedCompletion: "",
    status: "not-started",
    activities: [],
    outcomes: [],
    kpis: [],
    linkedKpiIds: [],
    evidence: [],
    approvals: [],
    formulationStatus: "draft",
    formulationApprovals: [],
  };
}

export function newActivity(): Activity {
  return { id: uid("act"), description: "", owner: "", dueDate: "", status: "not-started" };
}

export function newOutcome(): Outcome {
  return { id: uid("out"), description: "", expectedDate: "", achieved: false };
}

export function newKpi(type: KpiType = "quantitative"): Kpi {
  return { id: uid("kpi"), name: "", type, target: "", unit: "", actual: "", status: "not-started" };
}

export function newApprovalStep(role: ApprovalRole, orgNodeId?: string): ApprovalStep {
  return { id: uid("apr"), role, decision: "pending", orgNodeId };
}

/** Standard 2-step approval chain: Approver → Risk Manager (final). */
export function buildTwoStepApprovalChain(): ApprovalStep[] {
  return [newApprovalStep("approver"), newApprovalStep("risk_manager")];
}

export const APPROVAL_ROLE_LABELS: Record<ApprovalRole, string> = {
  approver: "Approver",
  risk_manager: "Risk Manager (final)",
};

export const FORMULATION_STATUS_LABELS: Record<FormulationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

export const FORMULATION_STATUS_COLORS: Record<FormulationStatus, string> = {
  draft: "215 16% 47%",
  submitted: "210 61% 49%",
  approved: "158 53% 49%",
  rejected: "352 70% 61%",
};

/** Recompute formulation status based on the 2-step approval chain. */
export function recomputeFormulationStatus(i: Initiative): FormulationStatus {
  if (i.formulationStatus === "draft") return "draft";
  const decisions = i.formulationApprovals.map(s => s.decision);
  if (decisions.length === 0) return i.formulationStatus;
  if (decisions.some(d => d === "rejected")) return "rejected";
  if (decisions.every(d => d === "approved")) return "approved";
  return "submitted";
}

export const INITIATIVE_STATUS_LABELS: Record<InitiativeStatus, string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  "completed": "Completed",
};

export const INITIATIVE_STATUS_COLORS: Record<InitiativeStatus, string> = {
  "not-started": "215 16% 47%",
  "in-progress": "210 61% 49%",
  "completed": "158 53% 49%",
};

export const APPROVAL_DECISION_LABELS: Record<ApprovalDecision, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const APPROVAL_DECISION_COLORS: Record<ApprovalDecision, string> = {
  pending: "34 89% 61%",
  approved: "158 53% 49%",
  rejected: "352 70% 61%",
};

export const KPI_STATUS_LABELS: Record<KpiStatus, string> = {
  "not-started": "Not Started",
  "on-track": "On Track",
  "at-risk": "At Risk",
  "off-track": "Off Track",
  "met": "Met",
  "not-met": "Not Met",
};

export const KPI_STATUS_COLORS: Record<KpiStatus, string> = {
  "not-started": "215 16% 47%",
  "on-track": "158 53% 49%",
  "at-risk": "34 89% 61%",
  "off-track": "352 70% 61%",
  "met": "158 64% 40%",
  "not-met": "352 70% 50%",
};

export const ACTIVITY_STATUS_LABELS: Record<Activity["status"], string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  "completed": "Completed",
  "blocked": "Blocked",
};

export const ACTIVITY_STATUS_COLORS: Record<Activity["status"], string> = {
  "not-started": "215 16% 47%",
  "in-progress": "210 61% 49%",
  "completed": "158 53% 49%",
  "blocked": "352 70% 61%",
};
