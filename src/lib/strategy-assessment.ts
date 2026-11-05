/**
 * Strategy performance assessment. Contract: integration guide §5.7.
 *
 * An assessment is one published initiative for one period. Its revisions are
 * append-only: a draft is edited, submitted for approval, and then either
 * approved, rejected or sent back. Approved work is amended by a new revision.
 */

import { api } from "./api";

export type AssessmentRevisionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUESTED"
  | "DISCARDED";
export type InitiativeStatus = "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type Rag = "GREEN" | "AMBER" | "RED" | "NOT_RATED";
export type RagFinal = Rag;
export type KpiActualSource = "MANUAL" | "PROGRESS_LOG";
export type AssessmentDecision = "APPROVE" | "REJECT" | "REQUEST_REVISION";
export type AssessmentFrequency = "MONTHLY" | "QUARTERLY" | "ANNUALLY";

export interface AssessmentSettings {
  requiresApproval: boolean;
  ragGreenMin: number;
  ragAmberMin: number;
  assessmentFrequency: AssessmentFrequency | null;
}

export interface KpiLine {
  id: string;
  kpiElementId: string;
  kpiVersionId?: string | null;
  title: string;
  unit?: string | null;
  targetValue?: number | null;
  actualValue?: number | null;
  actualSource?: KpiActualSource | null;
  achievementPct?: number | null;
  rag: Rag;
  note?: string | null;
}

export interface EvidenceItem {
  name: string;
  url: string;
}

export interface AssessmentRevision {
  assessmentId: string;
  revisionId: string;
  revision: number;
  current: boolean;
  status: AssessmentRevisionStatus;
  approvalStatus?: string | null;
  approvalComments?: string | null;
  initiativeStatus: InitiativeStatus;
  narrative?: string | null;
  submissionNote?: string | null;
  computedScore?: number | null;
  computedRag?: Rag | null;
  overrideRag?: Rag | null;
  overrideReason?: string | null;
  finalRag?: RagFinal | null;
  kpiLines: KpiLine[];
  evidence: EvidenceItem[];
  stale?: boolean;
  periodOutsidePlanWindow?: boolean;
  lockVersion: number;
  createdAt: string;
  submittedAt?: string | null;
}

export interface AssessmentListItem {
  assessmentId: string;
  organizationId: string;
  strategyElementId: string;
  elementTitle: string;
  orgNodeId: string | null;
  periodStart: string;
  periodEnd: string;
  displayRevision: AssessmentRevision | null;
  createdByUserId: string;
  createdAt: string;
}

export interface AssessmentDetail {
  assessmentId: string;
  strategyElementId: string;
  elementTitle: string;
  orgNodeId: string | null;
  periodStart: string;
  periodEnd: string;
  currentRevision: AssessmentRevision | null;
  openRevision: AssessmentRevision | null;
}

export interface WorklistRow {
  elementId: string;
  elementCode: string | null;
  elementTitle: string;
  orgNodeId: string | null;
  orgNodeName: string | null;
  assessmentId: string | null;
  revisionId: string | null;
  revisionNumber: number | null;
  status: AssessmentRevisionStatus | null;
  computedScore: number | null;
  computedRag: Rag | null;
  overrideRag: Rag | null;
  finalRag: RagFinal | null;
  overdue: boolean;
  periodStart: string;
  periodEnd: string;
  updatedAt: string | null;
}

export interface AssessmentSummary {
  initiativesCount: number;
  draftCount: number;
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
  overdueCount: number;
}

export interface RollupPillar {
  pillarId: string;
  pillarCode: string | null;
  pillarTitle: string;
  assessableCount: number;
  assessedCount: number;
  coverage: number;
  averageScore: number | null;
  ragDistribution: Record<"GREEN" | "AMBER" | "RED" | "NOT_RATED", number>;
}

export interface AssessmentFilters {
  elementId?: string;
  orgNodeId?: string;
  status?: AssessmentRevisionStatus;
  periodFrom?: string;
  periodTo?: string;
}

/** Body of PUT .../revisions/{id}. PUT replaces the draft, so always send the full state. */
export interface UpdateDraftRequest {
  lockVersion: number;
  initiativeStatus: InitiativeStatus;
  narrative: string | null;
  overrideRag: Rag | null;
  overrideReason: string | null;
  kpiLines: Array<{ kpiElementId: string; actualValue: number | null; actualSource: KpiActualSource; note: string | null }>;
  evidence: EvidenceItem[];
}

function base(orgId: string): string {
  return `/v1/organizations/${orgId}/strategy-assessment`;
}

export async function fetchAssessmentSettings(orgId: string): Promise<AssessmentSettings> {
  const { data } = await api.get<AssessmentSettings>(`${base(orgId)}/settings`);
  return data;
}

export async function updateAssessmentSettings(orgId: string, body: AssessmentSettings): Promise<AssessmentSettings> {
  const { data } = await api.put<AssessmentSettings>(`${base(orgId)}/settings`, body);
  return data;
}

export async function fetchWorklist(
  orgId: string,
  period: { periodStart: string; periodEnd: string; orgNodeId?: string; status?: AssessmentRevisionStatus },
): Promise<WorklistRow[]> {
  const { data } = await api.get<WorklistRow[] | null>(`${base(orgId)}/assessable-elements`, { params: period });
  return Array.isArray(data) ? data : [];
}

export async function fetchAssessments(orgId: string, filters: AssessmentFilters = {}): Promise<AssessmentListItem[]> {
  const { data } = await api.get<AssessmentListItem[] | null>(`${base(orgId)}/assessments`, { params: filters });
  return Array.isArray(data) ? data : [];
}

export async function fetchAssessment(orgId: string, assessmentId: string): Promise<AssessmentDetail> {
  const { data } = await api.get<AssessmentDetail>(`${base(orgId)}/assessments/${assessmentId}`);
  return data;
}

export async function fetchRevisions(orgId: string, assessmentId: string): Promise<AssessmentRevision[]> {
  const { data } = await api.get<AssessmentRevision[] | null>(`${base(orgId)}/assessments/${assessmentId}/revisions`);
  return Array.isArray(data) ? data : [];
}

export async function createAssessment(
  orgId: string,
  body: { strategyElementId: string; periodStart: string; periodEnd: string },
): Promise<AssessmentRevision> {
  const { data } = await api.post<AssessmentRevision>(`${base(orgId)}/assessments`, body);
  return data;
}

/** Amends an approved (or rejected, or sent-back) assessment with a new draft revision. */
export async function amendAssessment(orgId: string, assessmentId: string): Promise<AssessmentRevision> {
  const { data } = await api.post<AssessmentRevision>(`${base(orgId)}/assessments/${assessmentId}/revisions`);
  return data;
}

export async function saveDraft(orgId: string, revisionId: string, body: UpdateDraftRequest): Promise<AssessmentRevision> {
  const { data } = await api.put<AssessmentRevision>(`${base(orgId)}/revisions/${revisionId}`, body);
  return data;
}

export async function resyncRevision(orgId: string, revisionId: string): Promise<AssessmentRevision> {
  const { data } = await api.post<AssessmentRevision>(`${base(orgId)}/revisions/${revisionId}/resync`);
  return data;
}

export async function discardRevision(orgId: string, revisionId: string): Promise<AssessmentRevision> {
  const { data } = await api.post<AssessmentRevision>(`${base(orgId)}/revisions/${revisionId}/discard`);
  return data;
}

/** 202 when it went to approval, 200 when approval is off and it was applied at once. */
export async function submitRevision(
  orgId: string,
  revisionId: string,
): Promise<{ httpStatus: number; revision: AssessmentRevision }> {
  const response = await api.post<AssessmentRevision>(`${base(orgId)}/revisions/${revisionId}/submit`);
  return { httpStatus: response.status, revision: response.data };
}

export async function decideRevision(
  orgId: string,
  revisionId: string,
  body: { decision: AssessmentDecision; comments?: string },
): Promise<AssessmentRevision> {
  const { data } = await api.post<AssessmentRevision>(`${base(orgId)}/revisions/${revisionId}/decision`, body);
  return data;
}

export async function fetchPendingApprovals(orgId: string): Promise<AssessmentRevision[]> {
  const { data } = await api.get<AssessmentRevision[] | null>(`${base(orgId)}/approvals/pending`);
  return Array.isArray(data) ? data : [];
}

export async function fetchAssessmentSummary(
  orgId: string,
  period: { periodStart: string; periodEnd: string },
): Promise<AssessmentSummary> {
  const { data } = await api.get<AssessmentSummary>(`${base(orgId)}/summary`, { params: period });
  return data;
}

export async function fetchRollup(
  orgId: string,
  period: { periodStart: string; periodEnd: string },
): Promise<RollupPillar[]> {
  const { data } = await api.get<{ items: RollupPillar[] }>(`${base(orgId)}/rollup`, { params: period });
  return Array.isArray(data?.items) ? data.items : [];
}

/**
 * Server message for assessment failures. "Stale KPI definitions" means the
 * initiative or its KPIs changed since the draft was seeded: resync first.
 */
export function assessmentErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { message?: string } } }).response;
  const message = response?.data?.message ?? "";
  if (response?.status === 409 && /stale/i.test(message)) return "The initiative or its KPIs changed. Resync the draft, then submit.";
  if (response?.status === 409 && /discarded/i.test(message)) return "Every revision was discarded, so there is nothing to amend.";
  if (response?.status === 409 && /concurrent|lock/i.test(message)) return "Someone else changed this draft. Reload it and re-apply your edits.";
  if (response?.status === 409) return message || "This assessment is not in a state that allows that change.";
  if (response?.status === 403) return "You don't have access to change this assessment.";
  if (response?.status === 400) return message || "Check the highlighted fields and try again.";
  return message || "The assessment request failed. Please try again.";
}

/** Achievement and score come from the server. This only formats them for display. */
export function ragLabel(rag: Rag | null | undefined): string {
  switch (rag) {
    case "GREEN":
      return "Green";
    case "AMBER":
      return "Amber";
    case "RED":
      return "Red";
    default:
      return "Not rated";
  }
}
