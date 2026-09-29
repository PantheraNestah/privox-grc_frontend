/**
 * Org Tree API service (Governance module — Risk Governance).
 * All endpoints require the signed-in user's access token
 * (automatically attached via the axios interceptor in api.ts).
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
  OrgNodeMemberResponse,
  PlaceOrgNodeMemberRequest,
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

/** Users placed at one node. Requires the Governance module to be allocated. */
export async function fetchOrgNodeMembers(
  orgId: string,
  nodeId: string,
): Promise<OrgNodeMemberResponse[]> {
  const { data } = await api.get<OrgNodeMemberResponse[]>(
    `/v1/organizations/${orgId}/org-nodes/${nodeId}/members`,
  );
  return data;
}

/**
 * Places a user at a node. Placing someone who also holds a system-default
 * group (ORG_NODE_LEADER, RISK_CONTRIBUTOR, RISK_APPROVER) grants them
 * node-scoped authority over that unit and its subtree.
 */
export async function placeOrgNodeMember(
  orgId: string,
  nodeId: string,
  body: PlaceOrgNodeMemberRequest,
): Promise<OrgNodeMemberResponse> {
  const { data } = await api.post<OrgNodeMemberResponse>(
    `/v1/organizations/${orgId}/org-nodes/${nodeId}/members`,
    body,
  );
  return data;
}

/** Ends a placement. The path variable is the user id, not the placement id. */
export async function removeOrgNodeMember(
  orgId: string,
  nodeId: string,
  userId: string,
): Promise<void> {
  await api.delete(
    `/v1/organizations/${orgId}/org-nodes/${nodeId}/members/${userId}`,
  );
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
