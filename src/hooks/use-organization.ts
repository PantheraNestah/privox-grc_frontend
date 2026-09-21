/**
 * React Query state layer for the signed-in organization: profile, members,
 * groups, permissions and invitations. UI components should import from here,
 * never call `@/lib/organization` directly, so every read is cached and every
 * write invalidates exactly the queries it affects.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateOrganizationGroup,
  addGroupMember,
  createOrganizationGroup,
  createOrganizationInvitation,
  deactivateOrganizationGroup,
  deactivateOrganizationMember,
  activateOrganizationMember,
  fetchGroupMembers,
  fetchGroupPermissions,
  fetchMemberGroups,
  fetchOrganization,
  fetchOrganizationGroup,
  fetchOrganizationGroups,
  fetchOrganizationInvitations,
  fetchOrganizationMembers,
  fetchPermissionCatalog,
  reactivateOrganizationMember,
  removeGroupMember,
  resendInvitation,
  revokeInvitation,
  suspendOrganizationMember,
  updateGroupPermissions,
  updateOrganizationDetail,
  updateOrganizationGroup,
  updateOrganizationMember,
} from "@/lib/organization";
import type {
  CreateInvitationRequest,
  CreateOrganizationGroupRequest,
  UpdateOrganizationGroupRequest,
  UpdateOrganizationRequest,
} from "@/lib/auth-types";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
export type MemberAction = "activate" | "suspend" | "reactivate" | "deactivate";

export const organizationKeys = {
  all: (orgId: string) => ["organization", orgId] as const,
  detail: (orgId: string) => [...organizationKeys.all(orgId), "detail"] as const,
  members: (orgId: string) => [...organizationKeys.all(orgId), "members"] as const,
  memberGroups: (orgId: string, memberId: string) =>
    [...organizationKeys.all(orgId), "member-groups", memberId] as const,
  groups: (orgId: string) => [...organizationKeys.all(orgId), "groups"] as const,
  group: (orgId: string, groupId: string) => [...organizationKeys.groups(orgId), groupId] as const,
  groupMembers: (orgId: string, groupId: string) =>
    [...organizationKeys.group(orgId, groupId), "members"] as const,
  groupPermissions: (orgId: string, groupId: string) =>
    [...organizationKeys.group(orgId, groupId), "permissions"] as const,
  invitations: (orgId: string, status?: InvitationStatus) =>
    [...organizationKeys.all(orgId), "invitations", status ?? "all"] as const,
};

export const permissionCatalogKey = ["permission-catalog"] as const;

const PROFILE_STALE_TIME = 5 * 60_000;
const CATALOGUE_STALE_TIME = 10 * 60_000;
const LIVE_STALE_TIME = 30_000;

// ─── Queries ──────────────────────────────────────────────

export function useOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.detail(orgId ?? ""),
    queryFn: () => fetchOrganization(orgId!),
    enabled: !!orgId,
    staleTime: PROFILE_STALE_TIME,
  });
}

export function useOrganizationMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.members(orgId ?? ""),
    queryFn: () => fetchOrganizationMembers(orgId!),
    enabled: !!orgId,
  });
}

export function useMemberGroups(orgId: string | undefined, memberId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.memberGroups(orgId ?? "", memberId ?? ""),
    queryFn: () => fetchMemberGroups(orgId!, memberId!),
    enabled: !!orgId && !!memberId,
  });
}

export function useOrganizationGroups(orgId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.groups(orgId ?? ""),
    queryFn: () => fetchOrganizationGroups(orgId!),
    enabled: !!orgId,
  });
}

export function useOrganizationGroup(orgId: string | undefined, groupId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.group(orgId ?? "", groupId ?? ""),
    queryFn: () => fetchOrganizationGroup(orgId!, groupId!),
    enabled: !!orgId && !!groupId,
  });
}

export function useGroupMembers(orgId: string | undefined, groupId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.groupMembers(orgId ?? "", groupId ?? ""),
    queryFn: () => fetchGroupMembers(orgId!, groupId!),
    enabled: !!orgId && !!groupId,
  });
}

export function useGroupPermissions(orgId: string | undefined, groupId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.groupPermissions(orgId ?? "", groupId ?? ""),
    queryFn: () => fetchGroupPermissions(orgId!, groupId!),
    enabled: !!orgId && !!groupId,
  });
}

/** The platform permission catalogue is global and near-static. */
export function usePermissionCatalog() {
  return useQuery({
    queryKey: permissionCatalogKey,
    queryFn: fetchPermissionCatalog,
    staleTime: CATALOGUE_STALE_TIME,
  });
}

/** Switching the status filter keeps the previous list on screen while the next loads. */
export function useOrganizationInvitations(orgId: string | undefined, status?: InvitationStatus) {
  return useQuery({
    queryKey: organizationKeys.invitations(orgId ?? "", status),
    queryFn: () => fetchOrganizationInvitations(orgId!, status),
    enabled: !!orgId,
    staleTime: LIVE_STALE_TIME,
    placeholderData: keepPreviousData,
  });
}

// ─── Mutations ────────────────────────────────────────────

export function useUpdateOrganization(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrganizationRequest) => updateOrganizationDetail(orgId, body),
    onSuccess: (updated) => queryClient.setQueryData(organizationKeys.detail(orgId), updated),
  });
}

export function useCreateOrganizationGroup(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrganizationGroupRequest) => createOrganizationGroup(orgId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.groups(orgId) }),
  });
}

export function useUpdateOrganizationGroup(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, body }: { groupId: string; body: UpdateOrganizationGroupRequest }) =>
      updateOrganizationGroup(orgId, groupId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.groups(orgId) }),
  });
}

export function useSetGroupActive(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, active }: { groupId: string; active: boolean }) =>
      active ? activateOrganizationGroup(orgId, groupId) : deactivateOrganizationGroup(orgId, groupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.groups(orgId) }),
  });
}

export function useAddGroupMember(orgId: string, groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => addGroupMember(orgId, groupId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.groups(orgId) }),
  });
}

export function useRemoveGroupMember(orgId: string, groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeGroupMember(orgId, groupId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.groups(orgId) }),
  });
}

export function useUpdateGroupPermissions(orgId: string, groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permissionIds: string[]) => updateGroupPermissions(orgId, groupId, permissionIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.group(orgId, groupId) }),
  });
}

const memberActions: Record<MemberAction, typeof suspendOrganizationMember> = {
  activate: activateOrganizationMember,
  suspend: suspendOrganizationMember,
  reactivate: reactivateOrganizationMember,
  deactivate: deactivateOrganizationMember,
};

/** Backend member lifecycle (§3.2): activate / suspend / reactivate / deactivate. */
export function useMemberTransition(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: MemberAction }) =>
      memberActions[action](orgId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.members(orgId) }),
  });
}

export function useUpdateOrganizationMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      body,
    }: {
      userId: string;
      body: { email: string; username?: string; fullName: string };
    }) => updateOrganizationMember(orgId, userId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.members(orgId) }),
  });
}

function useInvitationMutation<TVars, TResult>(orgId: string, fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...organizationKeys.all(orgId), "invitations"] }),
  });
}

export function useCreateInvitation(orgId: string) {
  return useInvitationMutation(orgId, (body: CreateInvitationRequest) =>
    createOrganizationInvitation(orgId, body),
  );
}

export function useResendInvitation(orgId: string) {
  return useInvitationMutation(orgId, (invitationId: string) => resendInvitation(orgId, invitationId));
}

export function useRevokeInvitation(orgId: string) {
  return useInvitationMutation(orgId, (invitationId: string) => revokeInvitation(orgId, invitationId));
}
