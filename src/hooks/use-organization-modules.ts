/**
 * React Query state layer for the signed-in organization's module
 * subscriptions. One cached request feeds the dashboard, the settings page and
 * the sidebar, so navigating between them never refetches inside the window.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchOrganizationModules,
  toEnabledMap,
  toEnabledModules,
  type OrganizationModuleStatus,
} from "@/lib/organizationModules";

export const organizationModuleKeys = {
  all: (orgId: string) => ["organization-modules", orgId] as const,
  list: (orgId: string) => [...organizationModuleKeys.all(orgId), "list"] as const,
};

// Subscriptions only change when a platform admin toggles a module.
const MODULES_STALE_TIME = 5 * 60_000;

export function useOrganizationModules(orgId: string | undefined) {
  return useQuery({
    queryKey: organizationModuleKeys.list(orgId ?? ""),
    queryFn: () => fetchOrganizationModules(orgId!),
    enabled: !!orgId,
    staleTime: MODULES_STALE_TIME,
  });
}

/** Modules enabled for the organization, mapped to the static catalogue. */
export function useEnabledModules(orgId: string | undefined) {
  return useQuery({
    queryKey: organizationModuleKeys.list(orgId ?? ""),
    queryFn: () => fetchOrganizationModules(orgId!),
    enabled: !!orgId,
    staleTime: MODULES_STALE_TIME,
    select: toEnabledModules,
  });
}

/**
 * Static-module-id → enabled map for gating navigation. While the request is
 * pending or failed the map is empty, and `isModuleEnabled` treats unknown
 * modules as enabled so a slow/failed lookup never hides the app.
 */
export function useModuleAccess(orgId: string | undefined) {
  const query = useQuery({
    queryKey: organizationModuleKeys.list(orgId ?? ""),
    queryFn: () => fetchOrganizationModules(orgId!),
    enabled: !!orgId,
    staleTime: MODULES_STALE_TIME,
    select: (rows: OrganizationModuleStatus[]) => toEnabledMap(rows),
  });
  const map = query.data ?? {};
  return {
    isLoading: query.isLoading,
    isModuleEnabled: (staticModuleId: string) => map[staticModuleId] ?? true,
  };
}
