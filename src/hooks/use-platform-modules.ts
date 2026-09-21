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

/**
 * Per-organization module assignments merged with the full platform catalogue
 * so every module on the platform shows up with enable/disable controls even
 * when the assignment listing only includes enabled/subscribed rows.
 */
export function usePlatformOrganizationModules(organizationId: string | undefined) {
  return useQuery({
    queryKey: platformModuleKeys.organization(organizationId ?? ""),
    queryFn: async () => {
      const [catalogue, assignments] = await Promise.all([
        listPlatformModules(),
        listPlatformOrganizationModules(organizationId!),
      ]);
      const enabledByModuleId = new Map(assignments.map((row) => [row.moduleId, row]));
      return catalogue
        .filter((module) => module.active)
        .map((module) => {
          const assignment = enabledByModuleId.get(module.id);
          return {
            id: assignment?.id ?? `catalogue:${module.id}`,
            moduleId: module.id,
            code: module.code,
            name: module.name,
            description: assignment?.description ?? module.description,
            sortOrder: module.sortOrder,
            enabled: assignment?.enabled ?? false,
            enabledAt: assignment?.enabledAt ?? null,
            disabledAt: assignment?.disabledAt ?? null,
          } satisfies OrganizationModuleAssignment;
        })
        .concat(
          // keep any assignments whose module is missing from the catalogue
          assignments.filter(
            (assignment) => !catalogue.some((module) => module.id === assignment.moduleId),
          ),
        );
    },
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
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      // The tenant workspace caches this organization's enabled modules under its own key.
      void queryClient.invalidateQueries({ queryKey: ["organization-modules", organizationId] });
    },
  });
}
