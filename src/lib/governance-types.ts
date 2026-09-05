/**
 * Types for the Governance module (Org Tree, Org Node Templates, Risk Strategy).
 * See GOVERNANCE_API_ENDPOINTS.md for the authoritative API reference.
 */

// ─── Org Tree (§15) ────────────────────────────────────────

export type OrgNodeType =
  | "GROUP"
  | "COMPANY"
  | "DEPARTMENT"
  | "DIVISION"
  | "SECTION"
  | "PROCESS"
  | "SUB_PROCESS";

export type RiskRating = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface OrgNodeResponse {
  id: string;
  organizationId: string | null;
  parentId: string | null;
  name: string;
  type: OrgNodeType;
  description: string | null;
  headcount: number | null;
  location: string | null;
  riskRating: RiskRating | null;
  regulatoryBody: string | null;
  contactEmail: string | null;
  costCenterCode: string | null;
  metadata: Record<string, unknown> | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrgNodeRequest {
  parentId?: string | null;
  name: string;
  type: OrgNodeType;
  description?: string | null;
  headcount?: number | null;
  location?: string | null;
  riskRating?: RiskRating | null;
  regulatoryBody?: string | null;
  contactEmail?: string | null;
  costCenterCode?: string | null;
  metadata?: Record<string, unknown> | null;
}

// Same editable fields as create, minus parentId (use moveOrgNode instead).
export type UpdateOrgNodeRequest = Omit<CreateOrgNodeRequest, "parentId">;

export interface MoveOrgNodeRequest {
  newParentId: string | null;
}

export interface OrgTreeSettingsResponse {
  organizationId: string;
  strictTypeHierarchy: boolean;
}

export interface UpdateOrgTreeSettingsRequest {
  strictTypeHierarchy: boolean;
}

export interface CloneOrgNodeTemplateRequest {
  templateId: string;
  targetParentId?: string | null;
}

// ─── Org Node Templates (§16) ──────────────────────────────

export interface OrgNodeTemplateResponse {
  id: string;
  name: string;
  description: string | null;
  rootOrgNodeId: string;
  createdByUserId: string;
  createdAt: string;
}

export interface OrgNodeTemplateNodeRequest {
  name: string;
  type: OrgNodeType;
  description?: string | null;
  children?: OrgNodeTemplateNodeRequest[];
}

export interface RegisterOrgNodeTemplateRequest {
  name: string;
  description?: string | null;
  rootNode: OrgNodeTemplateNodeRequest;
}

export interface OrgNodeTemplatePreviewNode {
  id: string;
  name: string;
  type: OrgNodeType;
  description: string | null;
  children: OrgNodeTemplatePreviewNode[];
}

export interface OrgNodeTemplatePreviewResponse {
  templateId: string;
  name: string;
  description: string | null;
  rootNode: OrgNodeTemplatePreviewNode;
}

// ─── Risk Strategy (§17) ────────────────────────────────────

export type ReviewFrequency = "MONTHLY" | "QUARTERLY" | "ANNUALLY";
export type LikelihoodMode = "PROBABILITY" | "TIMELINE" | "BOTH";
export type ImpactMode = "QUANTITATIVE" | "QUALITATIVE" | "BOTH";
export type ApprovalDecisionType = "APPROVE" | "REJECT" | "REQUEST_REVISION";

export interface RiskAppetiteCategoryResponse {
  id: string;
  name: string;
  statement: string;
  sortOrder: number;
}

export interface RiskAppetiteCategoryInput {
  name: string;
  statement: string;
}

export interface RiskBandResponse {
  id: string;
  position: number;
  label: string;
  minValue: number | null;
  maxValue: number | null;
}

export interface RiskBandInput {
  position: number;
  label: string;
  minValue: number | null;
  maxValue: number | null;
}

export interface LikelihoodBandsResponse {
  probability: RiskBandResponse[];
  timeline: RiskBandResponse[];
}

export interface LikelihoodBandsInput {
  probability?: RiskBandInput[];
  timeline?: RiskBandInput[];
}

export interface RiskImpactParameterResponse {
  id: string;
  name: string;
  enabled: boolean;
  mode: ImpactMode;
  sortOrder: number;
  bands: RiskBandResponse[];
}

export interface RiskImpactParameterInput {
  name: string;
  enabled: boolean;
  mode: ImpactMode;
  bands: RiskBandInput[];
}

export interface RiskStrategyConfigResponse {
  id: string;
  organizationId: string;
  orgNodeId: string | null;
  version: number;
  current: boolean;
  levels: 3 | 4 | 5;
  likelihoodMode: LikelihoodMode;
  toleranceThreshold: number | null;
  reviewFrequency: ReviewFrequency;
  lastReviewedAt: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  appetiteCategories: RiskAppetiteCategoryResponse[];
  likelihoodBands: LikelihoodBandsResponse;
  impactParameters: RiskImpactParameterResponse[];
}

export interface CreateRiskStrategyVersionRequest {
  orgNodeId?: string | null;
  levels: 3 | 4 | 5;
  likelihoodMode: LikelihoodMode;
  toleranceThreshold?: number | null;
  reviewFrequency: ReviewFrequency;
  appetiteCategories?: RiskAppetiteCategoryInput[];
  likelihoodBands?: LikelihoodBandsInput;
  impactParameters?: RiskImpactParameterInput[];
}

export interface ApprovalDecisionRequest {
  decision: ApprovalDecisionType;
  comments?: string;
}

export interface RiskStrategySettingsResponse {
  organizationId: string;
  requiresApproval: boolean;
}

export interface UpdateRiskStrategySettingsRequest {
  requiresApproval: boolean;
}
