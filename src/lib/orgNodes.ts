/**
 * Org Tree API service (Governance module — Risk Governance).
 * All endpoints require the signed-in user's access token
 * (automatically attached via the axios interceptor in api.ts).
 * See GOVERNANCE_API_ENDPOINTS.md §15 for the full reference.
 */

import { api } from "./api";
import type {
  OrgNodeResponse,
  CreateOrgNodeRequest,
  UpdateOrgNodeRequest,
  MoveOrgNodeRequest,
  OrgTreeSettingsResponse,
  UpdateOrgTreeSettingsRequest,
  CloneOrgNodeTemplateRequest,
} from "./governance-types";

export async function fetchOrgNodes(
  orgId: string,
  scopeRootNodeId?: string,
): Promise<OrgNodeResponse[]> {
  const { data } = await api.get<OrgNodeResponse[]>(
    `/v1/organizations/${orgId}/org-nodes`,
    { params: scopeRootNodeId ? { scopeRootNodeId } : undefined },
  );
  return data;
}

export async function fetchOrgNode(
  orgId: string,
  nodeId: string,
): Promise<OrgNodeResponse> {
  const { data } = await api.get<OrgNodeResponse>(
    `/v1/organizations/${orgId}/org-nodes/${nodeId}`,
  );
  return data;
}

export async function createOrgNode(
  orgId: string,
  body: CreateOrgNodeRequest,
): Promise<OrgNodeResponse> {
  const { data } = await api.post<OrgNodeResponse>(
    `/v1/organizations/${orgId}/org-nodes`,
    body,
  );
  return data;
}

export async function updateOrgNode(
  orgId: string,
  nodeId: string,
  body: UpdateOrgNodeRequest,
): Promise<OrgNodeResponse> {
  const { data } = await api.patch<OrgNodeResponse>(
    `/v1/organizations/${orgId}/org-nodes/${nodeId}`,
    body,
  );
  return data;
}

export async function moveOrgNode(
  orgId: string,
  nodeId: string,
  body: MoveOrgNodeRequest,
): Promise<OrgNodeResponse> {
  const { data } = await api.post<OrgNodeResponse>(
    `/v1/organizations/${orgId}/org-nodes/${nodeId}/move`,
    body,
  );
  return data;
}

export async function softDeleteOrgNode(
  orgId: string,
  nodeId: string,
): Promise<void> {
  await api.delete(`/v1/organizations/${orgId}/org-nodes/${nodeId}`);
}

export async function hardDeleteOrgNode(
  orgId: string,
  nodeId: string,
): Promise<void> {
  await api.post(`/v1/organizations/${orgId}/org-nodes/${nodeId}/hard-delete`);
}

export async function fetchOrgTreeSettings(
  orgId: string,
): Promise<OrgTreeSettingsResponse> {
  const { data } = await api.get<OrgTreeSettingsResponse>(
    `/v1/organizations/${orgId}/org-nodes/settings`,
  );
  return data;
}

export async function updateOrgTreeSettings(
  orgId: string,
  body: UpdateOrgTreeSettingsRequest,
): Promise<OrgTreeSettingsResponse> {
  const { data } = await api.put<OrgTreeSettingsResponse>(
    `/v1/organizations/${orgId}/org-nodes/settings`,
    body,
  );
  return data;
}

export async function cloneOrgNodeTemplate(
  orgId: string,
  body: CloneOrgNodeTemplateRequest,
): Promise<OrgNodeResponse> {
  const { data } = await api.post<OrgNodeResponse>(
    `/v1/organizations/${orgId}/org-nodes/clone-template`,
    body,
  );
  return data;
}
