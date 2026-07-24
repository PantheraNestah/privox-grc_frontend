/**
 * Organization API service.
 * All endpoints require the signed-in user's access token
 * (automatically attached via the axios interceptor in api.ts).
 */

import { api } from "./api";
import type {
  OrganizationMember,
  OrganizationGroup,
  GroupMember,
} from "./auth-types";

const ORG_ID = "6d46a49f-268c-468a-a9ea-a0407db30d6b";

// ─── Members ─────────────────────────────────────────────

export async function fetchOrganizationMembers(): Promise<OrganizationMember[]> {
  const { data } = await api.get<OrganizationMember[]>(
    `/v1/organizations/${ORG_ID}/members`,
  );
  return data;
}

export async function fetchMemberGroups(
  memberId: string,
): Promise<OrganizationGroup[]> {
  const { data } = await api.get<OrganizationGroup[]>(
    `/v1/organizations/${ORG_ID}/members/${memberId}/groups`,
  );
  return data;
}

// ─── Groups ──────────────────────────────────────────────

export async function fetchOrganizationGroups(): Promise<OrganizationGroup[]> {
  const { data } = await api.get<OrganizationGroup[]>(
    `/v1/organizations/${ORG_ID}/groups`,
  );
  return data;
}

export async function fetchGroupMembers(
  groupId: string,
): Promise<GroupMember[]> {
  const { data } = await api.get<GroupMember[]>(
    `/v1/organizations/${ORG_ID}/groups/${groupId}/members`,
  );
  return data;
}

export async function addGroupMember(
  groupId: string,
  userId: string,
): Promise<void> {
  await api.post(`/v1/organizations/${ORG_ID}/groups/${groupId}/members`, {
    userId,
  });
}

export async function removeGroupMember(
  groupId: string,
  membershipId: string,
): Promise<void> {
  await api.delete(
    `/v1/organizations/${ORG_ID}/groups/${groupId}/members/${membershipId}`,
  );
}
