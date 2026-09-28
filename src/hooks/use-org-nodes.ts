/**
 * React Query state layer for the Org Tree (Risk Governance). UI components
 * should only import from here — never call `@/lib/orgNodes` directly.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cloneOrgNodeTemplate,
  createOrgNode,
  fetchOrgNode,
  fetchOrgNodeMembers,
  fetchOrgNodes,
  fetchOrgTreeSettings,
  hardDeleteOrgNode,
  moveOrgNode,
  placeOrgNodeMember,
  removeOrgNodeMember,
  softDeleteOrgNode,
  updateOrgNode,
  updateOrgTreeSettings,
} from "@/lib/orgNodes";
import type {
  CloneOrgNodeTemplateRequest,
  CreateOrgNodeRequest,
  MoveOrgNodeRequest,
  PlaceOrgNodeMemberRequest,
  UpdateOrgNodeRequest,
  UpdateOrgTreeSettingsRequest,
} from "@/lib/governance-types";

export const orgNodeKeys = {
  all: (orgId: string) => ["org-nodes", orgId] as const,
  list: (orgId: string, scopeRootNodeId?: string) =>
    [...orgNodeKeys.all(orgId), "list", scopeRootNodeId ?? null] as const,
  detail: (orgId: string, nodeId: string) =>
    [...orgNodeKeys.all(orgId), "detail", nodeId] as const,
  settings: (orgId: string) => [...orgNodeKeys.all(orgId), "settings"] as const,
  members: (orgId: string, nodeId: string) =>
    [...orgNodeKeys.all(orgId), "members", nodeId] as const,
};

// The org tree changes infrequently relative to how often it's read; keep it
// fresh for a short window so navigating between tabs doesn't re-fetch.
const LIST_STALE_TIME = 60_000;

export function useOrgNodes(orgId: string | undefined, scopeRootNodeId?: string) {
  return useQuery({
    queryKey: orgNodeKeys.list(orgId ?? "", scopeRootNodeId),
    queryFn: () => fetchOrgNodes(orgId!, scopeRootNodeId),
    enabled: !!orgId,
    staleTime: LIST_STALE_TIME,
  });
}

export function useOrgNode(orgId: string | undefined, nodeId: string | undefined) {
  return useQuery({
    queryKey: orgNodeKeys.detail(orgId ?? "", nodeId ?? ""),
    queryFn: () => fetchOrgNode(orgId!, nodeId!),
    enabled: !!orgId && !!nodeId,
    staleTime: LIST_STALE_TIME,
  });
}

/**
 * Users placed at a node. Placements change when someone is added/removed, so
 * keep this fresher than the tree itself; any org-node invalidation refreshes it.
 */
export function useOrgNodeMembers(orgId: string | undefined, nodeId: string | undefined) {
  return useQuery({
    queryKey: orgNodeKeys.members(orgId ?? "", nodeId ?? ""),
    queryFn: () => fetchOrgNodeMembers(orgId!, nodeId!),
    enabled: !!orgId && !!nodeId,
    staleTime: 30_000,
  });
}

export function useOrgTreeSettings(orgId: string | undefined) {
  return useQuery({
    queryKey: orgNodeKeys.settings(orgId ?? ""),
    queryFn: () => fetchOrgTreeSettings(orgId!),
    enabled: !!orgId,
    staleTime: LIST_STALE_TIME,
  });
}

/** Invalidates every cached list/detail for this org's tree after a mutation. */
function useInvalidateOrgNodes(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: orgNodeKeys.all(orgId) });
}

export function useCreateOrgNode(orgId: string) {
  const invalidate = useInvalidateOrgNodes(orgId);
  return useMutation({
    mutationFn: (body: CreateOrgNodeRequest) => createOrgNode(orgId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateOrgNode(orgId: string) {
  const invalidate = useInvalidateOrgNodes(orgId);
  return useMutation({
    mutationFn: ({ nodeId, body }: { nodeId: string; body: UpdateOrgNodeRequest }) =>
      updateOrgNode(orgId, nodeId, body),
    onSuccess: invalidate,
  });
}

export function useMoveOrgNode(orgId: string) {
  const invalidate = useInvalidateOrgNodes(orgId);
  return useMutation({
    mutationFn: ({ nodeId, body }: { nodeId: string; body: MoveOrgNodeRequest }) =>
      moveOrgNode(orgId, nodeId, body),
    onSuccess: invalidate,
  });
}

export function useSoftDeleteOrgNode(orgId: string) {
  const invalidate = useInvalidateOrgNodes(orgId);
  return useMutation({
    mutationFn: (nodeId: string) => softDeleteOrgNode(orgId, nodeId),
    onSuccess: invalidate,
  });
}

export function useHardDeleteOrgNode(orgId: string) {
  const invalidate = useInvalidateOrgNodes(orgId);
  return useMutation({
    mutationFn: (nodeId: string) => hardDeleteOrgNode(orgId, nodeId),
    onSuccess: invalidate,
  });
}

/**
 * Placements are scoped to a single node and never change the tree shape or
 * any node's own fields, so only that node's member list needs refetching.
 */
export function usePlaceOrgNodeMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, body }: { nodeId: string; body: PlaceOrgNodeMemberRequest }) =>
      placeOrgNodeMember(orgId, nodeId, body),
    onSuccess: (_placed, { nodeId }) =>
      queryClient.invalidateQueries({ queryKey: orgNodeKeys.members(orgId, nodeId) }),
  });
}

export function useRemoveOrgNodeMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, userId }: { nodeId: string; userId: string }) =>
      removeOrgNodeMember(orgId, nodeId, userId),
    onSuccess: (_data, { nodeId }) =>
      queryClient.invalidateQueries({ queryKey: orgNodeKeys.members(orgId, nodeId) }),
  });
}

export function useUpdateOrgTreeSettings(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrgTreeSettingsRequest) =>
      updateOrgTreeSettings(orgId, body),
    onSuccess: (data) =>
      queryClient.setQueryData(orgNodeKeys.settings(orgId), data),
  });
}

export function useCloneOrgNodeTemplate(orgId: string) {
  const invalidate = useInvalidateOrgNodes(orgId);
  return useMutation({
    mutationFn: (body: CloneOrgNodeTemplateRequest) =>
      cloneOrgNodeTemplate(orgId, body),
    onSuccess: invalidate,
  });
}
