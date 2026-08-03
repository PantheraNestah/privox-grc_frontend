/**
 * Organization API service.
 * All endpoints require the signed-in user's access token
 * (automatically attached via the axios interceptor in api.ts).
 */

import { api } from "./api";
import type {
  CreateOrganizationGroupRequest,
  UpdateOrganizationGroupRequest,
  OrganizationMember,
  OrganizationGroup,
  OrganizationGroupDetail,
  OrganizationPermission,
  OrganizationDetailDto,
  GroupMember,
} from "./auth-types";

type GroupDetailResponse = Omit<OrganizationGroupDetail, "permissions"> & {
  permissions?: Array<string | OrganizationPermission>;
};

function normalizePermissions(
  permissions: Array<string | OrganizationPermission> = [],
): OrganizationPermission[] {
  return permissions.map((permission) =>
    typeof permission === "string"
      ? { id: permission, code: permission, name: permission, scopeType: "" }
      : permission,
  );
}

function normalizeGroup<T extends OrganizationGroup>(group: T): T {
  if (typeof group.active !== "boolean") return group;
  return {
    ...group,
    status: group.active ? "active" : "inactive",
  };
}

export async function fetchOrganization(
  orgId: string,
): Promise<OrganizationDetailDto> {
  const { data } = await api.get<OrganizationDetailDto>(
    `/v1/organizations/${orgId}`,
  );
  return data;
}

export async function fetchOrganizationMembers(
  orgId: string,
): Promise<OrganizationMember[]> {
  const { data } = await api.get<OrganizationMember[]>(
    `/v1/organizations/${orgId}/members`,
  );
  return data;
}

export async function fetchMemberGroups(
  orgId: string,
  memberId: string,
): Promise<OrganizationGroup[]> {
  const { data } = await api.get<OrganizationGroup[]>(
    `/v1/organizations/${orgId}/members/${memberId}/groups`,
  );
  return data.map(normalizeGroup);
}

export async function fetchOrganizationGroups(
  orgId: string,
): Promise<OrganizationGroup[]> {
  const { data } = await api.get<OrganizationGroup[]>(
    `/v1/organizations/${orgId}/groups`,
  );
  return data.map(normalizeGroup);
}

export async function fetchOrganizationGroup(
  orgId: string,
  groupId: string,
): Promise<OrganizationGroupDetail> {
  const { data } = await api.get<GroupDetailResponse>(
    `/v1/organizations/${orgId}/groups/${groupId}`,
  );
  return normalizeGroup({
    ...data,
    memberCount: data.memberCount ?? 0,
    permissions: normalizePermissions(data.permissions),
  });
}

export async function createOrganizationGroup(
  orgId: string,
  body: CreateOrganizationGroupRequest,
): Promise<OrganizationGroup> {
  const { data } = await api.post<OrganizationGroup>(
    `/v1/organizations/${orgId}/groups`,
    body,
  );
  return normalizeGroup(data);
}

export async function updateOrganizationGroup(
  orgId: string,
  groupId: string,
  body: UpdateOrganizationGroupRequest,
): Promise<OrganizationGroupDetail> {
  const { data } = await api.patch<GroupDetailResponse>(
    `/v1/organizations/${orgId}/groups/${groupId}`,
    body,
  );
  return normalizeGroup({
    ...data,
    memberCount: data.memberCount ?? 0,
    permissions: normalizePermissions(data.permissions),
  });
}

export async function activateOrganizationGroup(
  orgId: string,
  groupId: string,
): Promise<void> {
  await api.post(`/v1/organizations/${orgId}/groups/${groupId}/activate`);
}

export async function deactivateOrganizationGroup(
  orgId: string,
  groupId: string,
): Promise<void> {
  await api.post(`/v1/organizations/${orgId}/groups/${groupId}/deactivate`);
}

export async function fetchGroupMembers(
  orgId: string,
  groupId: string,
): Promise<GroupMember[]> {
  const { data } = await api.get<GroupMember[]>(
    `/v1/organizations/${orgId}/groups/${groupId}/members`,
  );
  return data;
}

export async function addGroupMember(
  orgId: string,
  groupId: string,
  userId: string,
): Promise<void> {
  await api.post(`/v1/organizations/${orgId}/groups/${groupId}/members`, {
    userId,
  });
}

export async function removeGroupMember(
  orgId: string,
  groupId: string,
  membershipId: string,
): Promise<void> {
  await api.delete(
    `/v1/organizations/${orgId}/groups/${groupId}/members/${membershipId}`,
  );
}

export async function fetchPermissionCatalog(): Promise<OrganizationPermission[]> {
  const { data } = await api.get<OrganizationPermission[]>("/v1/permissions");
  return data;
}

export async function fetchGroupPermissions(
  orgId: string,
  groupId: string,
): Promise<OrganizationPermission[]> {
  const { data } = await api.get<Array<string | OrganizationPermission>>(
    `/v1/organizations/${orgId}/groups/${groupId}/permissions`,
  );
  return normalizePermissions(data);
}

export async function updateGroupPermissions(
  orgId: string,
  groupId: string,
  permissionIds: string[],
): Promise<void> {
  await api.put(
    `/v1/organizations/${orgId}/groups/${groupId}/permissions`,
    { permissionIds },
  );
}
