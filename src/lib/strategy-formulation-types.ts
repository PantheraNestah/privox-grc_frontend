export type StrategyElementType =
  | "PILLAR"
  | "OBJECTIVE"
  | "INITIATIVE"
  | "ACTIVITY"
  | "KPI";

export type StrategyVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type StrategyApprovalDecision = "APPROVE" | "REJECT" | "REQUEST_REVISION";

export interface StrategyFormulationSettings {
  organizationId: string;
  requiresApproval: boolean;
  strictTypeHierarchy: boolean;
}

export interface UpdateStrategyFormulationSettingsRequest {
  requiresApproval: boolean;
  strictTypeHierarchy: boolean;
}

export interface StrategyVersionContent {
  title: string;
  description: string | null;
  outcomeSummary: string | null;
  targetValue: number | null;
  unit: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface StrategyVersion extends StrategyVersionContent {
  id: string;
  organizationId: string;
  orgNodeId: string | null;
  parentElementId: string | null;
  type: StrategyElementType;
  versionId: string;
  version: number;
  current: boolean;
  status: StrategyVersionStatus;
  elementCreatedByUserId: string;
  elementCreatedAt: string;
  versionCreatedByUserId: string;
  versionCreatedAt: string;
}

export interface StrategyElementDetailVersion extends StrategyVersionContent {
  id: string;
  version: number;
  current: boolean;
  status: StrategyVersionStatus;
  createdByUserId: string;
  createdAt: string;
}

export interface StrategyElementDetail {
  id: string;
  organizationId: string;
  orgNodeId: string | null;
  parentElementId: string | null;
  type: StrategyElementType;
  elementCreatedByUserId: string;
  elementCreatedAt: string;
  currentVersion: StrategyElementDetailVersion | null;
  draftVersion: StrategyElementDetailVersion | null;
}

export interface StrategyTreeNode extends StrategyVersionContent {
  id: string;
  organizationId: string;
  orgNodeId: string | null;
  parentElementId: string | null;
  type: StrategyElementType;
  versionId: string;
  version: number;
  current: boolean;
  status: StrategyVersionStatus;
  children: StrategyTreeNode[];
}

export interface StrategyElementFilters {
  type?: StrategyElementType | null;
  parentElementId?: string | null;
  orgNodeId?: string | null;
}

export interface CreateStrategyElementRequest {
  type: StrategyElementType;
  orgNodeId: string | null;
  parentElementId: string | null;
  title: string;
  description?: string | null;
  outcomeSummary?: string | null;
  targetValue?: number | null;
  unit?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface CreateStrategyVersionRequest {
  title: string;
  description?: string | null;
  outcomeSummary?: string | null;
  targetValue?: number | null;
  unit?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface StrategyApprovalDecisionRequest {
  decision: StrategyApprovalDecision;
  comments?: string | null;
}

export type RecordStrategyProgressRequest =
  | { reportedValue: number; note?: string | null }
  | { reportedValue?: null; note: string };

export interface StrategyProgress {
  id: string;
  strategyElementId: string;
  reportedValue: number | null;
  note: string | null;
  recordedByUserId: string;
  recordedAt: string;
}

export interface StrategySummary {
  organizationId: string;
  pillarCount: number;
  objectiveCount: number;
  initiativeCount: number;
  activityCount: number;
  kpiCount: number;
  totalElementCount: number;
}

export interface StrategyInsights {
  organizationId: string;
  currentPublishedElementCount: number;
  outstandingDraftCount: number;
  pendingApprovalCount: number;
  kpiCount: number;
  kpisWithProgressCount: number;
  kpisWithoutProgressCount: number;
}
