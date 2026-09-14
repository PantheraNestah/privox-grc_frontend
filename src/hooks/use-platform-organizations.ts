/**
 * React Query state layer for platform organizations. UI components should only
 * import from here — never call `@/lib/platformAdmin` directly.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approvePlatformOrganization,
  createPlatformOrganization,
  getPlatformOrganization,
  listPlatformOrganizations,
  reactivatePlatformOrganization,
  suspendPlatformOrganization,
  type ApprovePlatformOrganizationRequest,
  type CreatePlatformOrganizationRequest,
  type OrganizationStatus,
} from "@/lib/platformAdmin";

export const platformOrganizationKeys = {
  all: ["platform", "organizations"] as const,
  list: (status?: OrganizationStatus) =>
    [...platformOrganizationKeys.all, "list", status ?? "all"] as const,
  detail: (organizationId: string) =>
    [...platformOrganizationKeys.all, "detail", organizationId] as const,
};

const LIST_STALE_TIME = 30_000;

export function usePlatformOrganizations(status?: OrganizationStatus) {
  return useQuery({
    queryKey: platformOrganizationKeys.list(status),
    queryFn: () => listPlatformOrganizations(status ? { status } : {}),
    staleTime: LIST_STALE_TIME,
  });
}

export function usePlatformOrganization(organizationId: string | undefined) {
  return useQuery({
    queryKey: platformOrganizationKeys.detail(organizationId ?? ""),
    queryFn: () => getPlatformOrganization(organizationId!),
    enabled: !!organizationId,
    staleTime: LIST_STALE_TIME,
  });
}

/** Invalidates every cached organization list and detail after a mutation. */
function useInvalidatePlatformOrganizations() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: platformOrganizationKeys.all });
}

export function useCreatePlatformOrganization() {
  const invalidate = useInvalidatePlatformOrganizations();
  return useMutation({
    mutationFn: (body: CreatePlatformOrganizationRequest) => createPlatformOrganization(body),
    onSuccess: invalidate,
  });
}

export function useApprovePlatformOrganization() {
  const invalidate = useInvalidatePlatformOrganizations();
  return useMutation({
    mutationFn: ({
      organizationId,
      body,
    }: {
      organizationId: string;
      body: ApprovePlatformOrganizationRequest;
    }) => approvePlatformOrganization(organizationId, body),
    onSuccess: invalidate,
  });
}

export function useSuspendPlatformOrganization() {
  const invalidate = useInvalidatePlatformOrganizations();
  return useMutation({
    mutationFn: (organizationId: string) => suspendPlatformOrganization(organizationId),
    onSuccess: invalidate,
  });
}

export function useReactivatePlatformOrganization() {
  const invalidate = useInvalidatePlatformOrganizations();
  return useMutation({
    mutationFn: (organizationId: string) => reactivatePlatformOrganization(organizationId),
    onSuccess: invalidate,
  });
}
