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
  UpdateOrganizationRequest,
  UserGroupAssignment,
  Invitation,
  CreateInvitationRequest,
  InvitationDetailsResponse,
  AcceptInvitationRequest,
  InvitationAcceptanceResponse,
  UserModuleDto,
  MemberModulesResponse,
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
  // Backend returns List<UserGroupResponse> (groupId/code/...), not AccessGroupResponse.
  const { data } = await api.get<UserGroupAssignment[]>(
    `/v1/organizations/${orgId}/members/${memberId}/groups`,
  );
  return data.map((assignment) =>
    normalizeGroup({
      id: assignment.groupId,
      code: assignment.code,
      name: assignment.name,
      description: assignment.description,
      active: assignment.active,
    } as OrganizationGroup),
  );
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

export async function updateOrganizationDetail(
  orgId: string,
  body: UpdateOrganizationRequest,
): Promise<OrganizationDetailDto> {
  const { data } = await api.patch<OrganizationDetailDto>(
    `/v1/organizations/${orgId}`,
    body,
  );
  return data;
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
  userId: string,
): Promise<void> {
  // Backend DELETE path variable is the user id, not the membership id.
  await api.delete(
    `/v1/organizations/${orgId}/groups/${groupId}/members/${userId}`,
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

// ─── Member lifecycle ────────────────────────────────────

async function memberTransition(
  orgId: string,
  userId: string,
  action: "activate" | "suspend" | "reactivate" | "deactivate",
): Promise<OrganizationMember> {
  const { data } = await api.post<OrganizationMember>(
    `/v1/organizations/${orgId}/members/${userId}/${action}`,
  );
  return data;
}

export const activateOrganizationMember = (orgId: string, userId: string) =>
  memberTransition(orgId, userId, "activate");

export const suspendOrganizationMember = (orgId: string, userId: string) =>
  memberTransition(orgId, userId, "suspend");

export const reactivateOrganizationMember = (orgId: string, userId: string) =>
  memberTransition(orgId, userId, "reactivate");

export const deactivateOrganizationMember = (orgId: string, userId: string) =>
  memberTransition(orgId, userId, "deactivate");

export async function updateOrganizationMember(
  orgId: string,
  userId: string,
  body: { email: string; username?: string; fullName: string },
): Promise<OrganizationMember> {
  const { data } = await api.put<OrganizationMember>(
    `/v1/organizations/${orgId}/members/${userId}`,
    body,
  );
  return data;
}

// ─── Invitations ──────────────────────────────────────────

export async function fetchOrganizationInvitations(
  orgId: string,
  status?: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED",
): Promise<Invitation[]> {
  const search = status ? `?status=${status}` : "";
  const { data } = await api.get<Invitation[]>(
    `/v1/organizations/${orgId}/invitations${search}`,
  );
  return data;
}

export async function createOrganizationInvitation(
  orgId: string,
  body: CreateInvitationRequest,
): Promise<Invitation> {
  const { data } = await api.post<Invitation>(
    `/v1/organizations/${orgId}/invitations`,
    body,
  );
  return data;
}

export async function resendInvitation(
  orgId: string,
  invitationId: string,
): Promise<Invitation> {
  const { data } = await api.post<Invitation>(
    `/v1/organizations/${orgId}/invitations/${invitationId}/resend`,
  );
  return data;
}

export async function revokeInvitation(
  orgId: string,
  invitationId: string,
): Promise<Invitation> {
  const { data } = await api.post<Invitation>(
    `/v1/organizations/${orgId}/invitations/${invitationId}/revoke`,
  );
  return data;
}

// ─── Invitation acceptance (public) ──────────────────────

/**
 * Pre-validates a raw invitation token.
 * `GET /api/v1/auth/invitations/{token}` — public.
 */
export async function fetchInvitationDetails(
  token: string,
): Promise<InvitationDetailsResponse> {
  const { data } = await api.get<InvitationDetailsResponse>(
    `/v1/auth/invitations/${encodeURIComponent(token)}`,
  );
  return data;
}

/**
 * Accepts an invitation and activates organization membership.
 * `POST /api/v1/auth/invitations/{token}/accept` — public.
 *
 * New users pass `{ fullName, username?, password }`; existing users pass an
 * empty body (the request interceptor attaches the session token if present).
 */
export async function acceptInvitation(
  token: string,
  body?: AcceptInvitationRequest,
): Promise<InvitationAcceptanceResponse> {
  const { data } = await api.post<InvitationAcceptanceResponse>(
    `/v1/auth/invitations/${encodeURIComponent(token)}/accept`,
    body ?? {},
  );
  return data;
}

// ─── User module allocations (Redesign V3) ───────────────

/** Active module codes allocated to the calling user. */
export async function fetchMyModules(orgId: string): Promise<UserModuleDto[]> {
  const { data } = await api.get<UserModuleDto[]>(
    `/v1/organizations/${orgId}/my-modules`,
  );
  return data;
}

/**
 * Module codes allocated to one member. The backend has returned both
 * `moduleCodes` and `allocatedModuleCodes`; normalize to a single list.
 */
export async function fetchMemberModules(
  orgId: string,
  userId: string,
): Promise<string[]> {
  const { data } = await api.get<MemberModulesResponse>(
    `/v1/organizations/${orgId}/members/${userId}/modules`,
  );
  return data.moduleCodes ?? data.allocatedModuleCodes ?? [];
}

/** Bulk-replaces a member's module allocations. */
export async function updateMemberModules(
  orgId: string,
  userId: string,
  moduleCodes: string[],
): Promise<string[]> {
  const { data } = await api.put<MemberModulesResponse>(
    `/v1/organizations/${orgId}/members/${userId}/modules`,
    { moduleCodes },
  );
  return data.moduleCodes ?? data.allocatedModuleCodes ?? moduleCodes;
}
