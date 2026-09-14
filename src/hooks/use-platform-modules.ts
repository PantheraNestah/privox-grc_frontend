/**
 * React Query state layer for the platform module catalogue and per-organization
 * module assignments. UI components should only import from here — never call
 * `@/lib/platformAdmin` directly.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disablePlatformOrganizationModule,
  enablePlatformOrganizationModule,
  listPlatformModules,
  listPlatformOrganizationModules,
  type OrganizationModuleAssignment,
} from "@/lib/platformAdmin";

export const platformModuleKeys = {
  all: ["platform", "modules"] as const,
  catalogue: () => [...platformModuleKeys.all, "catalogue"] as const,
  organization: (organizationId: string) =>
    [...platformModuleKeys.all, "organization", organizationId] as const,
};

// The module catalogue is effectively static; assignments change more often.
const CATALOGUE_STALE_TIME = 5 * 60_000;
const ASSIGNMENT_STALE_TIME = 30_000;

export function usePlatformModules() {
  return useQuery({
    queryKey: platformModuleKeys.catalogue(),
    queryFn: listPlatformModules,
    staleTime: CATALOGUE_STALE_TIME,
  });
}

export function usePlatformOrganizationModules(organizationId: string | undefined) {
  return useQuery({
    queryKey: platformModuleKeys.organization(organizationId ?? ""),
    queryFn: () => listPlatformOrganizationModules(organizationId!),
    enabled: !!organizationId,
    staleTime: ASSIGNMENT_STALE_TIME,
  });
}

/**
 * Enable/disable a module for one organization with an optimistic cache update.
 * `enabled` selects the endpoint; the mutation variable carries the desired state.
 */
export function useSetPlatformOrganizationModule(organizationId: string) {
  const queryClient = useQueryClient();
  const queryKey = platformModuleKeys.organization(organizationId);

  return useMutation({
    mutationFn: ({ moduleId, enabled }: { moduleId: string; enabled: boolean }) =>
      enabled
        ? enablePlatformOrganizationModule(organizationId, moduleId)
        : disablePlatformOrganizationModule(organizationId, moduleId),
    onMutate: async ({ moduleId, enabled }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<OrganizationModuleAssignment[]>(queryKey);
      queryClient.setQueryData<OrganizationModuleAssignment[]>(queryKey, (current) =>
        current?.map((row) => (row.moduleId === moduleId ? { ...row, enabled } : row)) ?? current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
