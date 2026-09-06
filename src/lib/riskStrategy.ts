/**
 * Risk Strategy API service (Governance module — risk appetite, likelihood
 * and impact bands). Versions are strictly append-only.
 * See GOVERNANCE_API_ENDPOINTS.md §17 for the full reference.
 */

import { api } from "./api";
import type {
  RiskStrategyConfigResponse,
  CreateRiskStrategyVersionRequest,
  ApprovalDecisionRequest,
  RiskStrategySettingsResponse,
  UpdateRiskStrategySettingsRequest,
} from "./governance-types";

export async function fetchCurrentRiskStrategy(
  orgId: string,
  orgNodeId?: string,
): Promise<RiskStrategyConfigResponse> {
  const { data } = await api.get<RiskStrategyConfigResponse>(
    `/v1/organizations/${orgId}/risk-strategy/current`,
    { params: orgNodeId ? { orgNodeId } : undefined },
  );
  return data;
}

export async function fetchRiskStrategyHistory(
  orgId: string,
  orgNodeId?: string,
): Promise<RiskStrategyConfigResponse[]> {
  const { data } = await api.get<RiskStrategyConfigResponse[]>(
    `/v1/organizations/${orgId}/risk-strategy/history`,
    { params: orgNodeId ? { orgNodeId } : undefined },
  );
  return data;
}

export async function fetchRiskStrategyVersion(
  orgId: string,
  configId: string,
): Promise<RiskStrategyConfigResponse> {
  const { data } = await api.get<RiskStrategyConfigResponse>(
    `/v1/organizations/${orgId}/risk-strategy/${configId}`,
  );
  return data;
}

export async function createRiskStrategyVersion(
  orgId: string,
  body: CreateRiskStrategyVersionRequest,
): Promise<RiskStrategyConfigResponse> {
  const { data } = await api.post<RiskStrategyConfigResponse>(
    `/v1/organizations/${orgId}/risk-strategy`,
    body,
  );
  return data;
}

export async function decideRiskStrategyVersion(
  orgId: string,
  configId: string,
  body: ApprovalDecisionRequest,
): Promise<RiskStrategyConfigResponse> {
  const { data } = await api.post<RiskStrategyConfigResponse>(
    `/v1/organizations/${orgId}/risk-strategy/${configId}/decision`,
    body,
  );
  return data;
}

export async function fetchRiskStrategySettings(
  orgId: string,
): Promise<RiskStrategySettingsResponse> {
  const { data } = await api.get<RiskStrategySettingsResponse>(
    `/v1/organizations/${orgId}/risk-strategy/settings`,
  );
  return data;
}

export async function updateRiskStrategySettings(
  orgId: string,
  body: UpdateRiskStrategySettingsRequest,
): Promise<RiskStrategySettingsResponse> {
  const { data } = await api.put<RiskStrategySettingsResponse>(
    `/v1/organizations/${orgId}/risk-strategy/settings`,
    body,
  );
  return data;
}
