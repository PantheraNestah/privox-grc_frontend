import { api } from "./api";
import type {
  CreateStrategyElementRequest,
  CreateStrategyVersionRequest,
  RecordStrategyProgressRequest,
  StrategyApprovalDecisionRequest,
  StrategyElementDetail,
  StrategyElementFilters,
  StrategyFormulationSettings,
  StrategyInsights,
  StrategyProgress,
  StrategySummary,
  StrategyTreeNode,
  StrategyVersion,
  UpdateStrategyFormulationSettingsRequest,
} from "./strategy-formulation-types";

function basePath(orgId: string): string {
  return `/v1/organizations/${orgId}/strategy-formulation`;
}

function normalizeArray<T>(data: T[] | null | undefined): T[] {
  return Array.isArray(data) ? data : [];
}

function normalizeTree(
  data: Array<StrategyTreeNode | null> | null | undefined,
): StrategyTreeNode[] {
  return normalizeArray(data)
    .filter((node): node is StrategyTreeNode => node !== null)
    .map((node) => ({
      ...node,
      children: normalizeTree(node.children),
    }));
}

export async function fetchStrategyFormulationSettings(
  orgId: string,
): Promise<StrategyFormulationSettings> {
  const { data } = await api.get<StrategyFormulationSettings>(
    `${basePath(orgId)}/settings`,
  );
  return data;
}

export async function updateStrategyFormulationSettings(
  orgId: string,
  body: UpdateStrategyFormulationSettingsRequest,
): Promise<StrategyFormulationSettings> {
  const { data } = await api.put<StrategyFormulationSettings>(
    `${basePath(orgId)}/settings`,
    body,
  );
  return data;
}

export async function createStrategyElement(
  orgId: string,
  body: CreateStrategyElementRequest,
): Promise<StrategyVersion> {
  const { data } = await api.post<StrategyVersion>(
    `${basePath(orgId)}/elements`,
    body,
  );
  return data;
}

export async function fetchStrategyElements(
  orgId: string,
  filters: StrategyElementFilters = {},
): Promise<StrategyVersion[]> {
  const params = {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.parentElementId ? { parentElementId: filters.parentElementId } : {}),
    ...(filters.orgNodeId ? { orgNodeId: filters.orgNodeId } : {}),
  };
  const { data } = await api.get<StrategyVersion[] | null>(
    `${basePath(orgId)}/elements`,
    { params: Object.keys(params).length ? params : undefined },
  );
  return normalizeArray(data);
}

export async function fetchStrategyElementDetail(
  orgId: string,
  elementId: string,
): Promise<StrategyElementDetail> {
  const { data } = await api.get<StrategyElementDetail>(
    `${basePath(orgId)}/elements/${elementId}`,
  );
  return data;
}

export async function fetchStrategyTree(
  orgId: string,
): Promise<StrategyTreeNode[]> {
  const { data } = await api.get<Array<StrategyTreeNode | null> | null>(
    `${basePath(orgId)}/tree`,
  );
  return normalizeTree(data);
}

export async function publishStrategyVersion(
  orgId: string,
  elementId: string,
  versionId: string,
): Promise<StrategyVersion> {
  const { data } = await api.post<StrategyVersion>(
    `${basePath(orgId)}/elements/${elementId}/versions/${versionId}/publish`,
  );
  return data;
}

export async function recordStrategyApprovalDecision(
  orgId: string,
  elementId: string,
  versionId: string,
  body: StrategyApprovalDecisionRequest,
): Promise<StrategyVersion> {
  const { data } = await api.post<StrategyVersion>(
    `${basePath(orgId)}/elements/${elementId}/versions/${versionId}/decision`,
    body,
  );
  return data;
}

export async function createStrategyVersion(
  orgId: string,
  elementId: string,
  body: CreateStrategyVersionRequest,
): Promise<StrategyVersion> {
  const { data } = await api.post<StrategyVersion>(
    `${basePath(orgId)}/elements/${elementId}/versions`,
    body,
  );
  return data;
}

export async function fetchStrategyVersionHistory(
  orgId: string,
  elementId: string,
): Promise<StrategyVersion[]> {
  const { data } = await api.get<StrategyVersion[] | null>(
    `${basePath(orgId)}/elements/${elementId}/versions`,
  );
  return normalizeArray(data);
}

export async function fetchStrategyVersion(
  orgId: string,
  elementId: string,
  versionId: string,
): Promise<StrategyVersion> {
  const { data } = await api.get<StrategyVersion>(
    `${basePath(orgId)}/elements/${elementId}/versions/${versionId}`,
  );
  return data;
}

export async function archiveStrategyElement(
  orgId: string,
  elementId: string,
): Promise<StrategyVersion> {
  const { data } = await api.post<StrategyVersion>(
    `${basePath(orgId)}/elements/${elementId}/archive`,
  );
  return data;
}

export async function recordStrategyProgress(
  orgId: string,
  elementId: string,
  body: RecordStrategyProgressRequest,
): Promise<StrategyProgress> {
  const { data } = await api.post<StrategyProgress>(
    `${basePath(orgId)}/elements/${elementId}/progress`,
    body,
  );
  return data;
}

export async function fetchStrategyProgressHistory(
  orgId: string,
  elementId: string,
): Promise<StrategyProgress[]> {
  const { data } = await api.get<StrategyProgress[] | null>(
    `${basePath(orgId)}/elements/${elementId}/progress`,
  );
  return normalizeArray(data);
}

export async function fetchStrategySummary(
  orgId: string,
): Promise<StrategySummary> {
  const { data } = await api.get<StrategySummary>(`${basePath(orgId)}/summary`);
  return data;
}

export async function fetchStrategyInsights(
  orgId: string,
): Promise<StrategyInsights> {
  const { data } = await api.get<StrategyInsights>(`${basePath(orgId)}/insights`);
  return data;
}
