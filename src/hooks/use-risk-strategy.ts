/**
 * React Query state layer for Risk Strategy (appetite, likelihood and impact
 * bands). UI components should only import from here — never call
 * `@/lib/riskStrategy` directly.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRiskStrategyVersion,
  decideRiskStrategyVersion,
  fetchCurrentRiskStrategy,
  fetchRiskStrategyHistory,
  fetchRiskStrategySettings,
  fetchRiskStrategyVersion,
  updateRiskStrategySettings,
} from "@/lib/riskStrategy";
import type {
  ApprovalDecisionRequest,
  CreateRiskStrategyVersionRequest,
  UpdateRiskStrategySettingsRequest,
} from "@/lib/governance-types";

export const riskStrategyKeys = {
  all: (orgId: string) => ["risk-strategy", orgId] as const,
  current: (orgId: string, orgNodeId?: string) =>
    [...riskStrategyKeys.all(orgId), "current", orgNodeId ?? null] as const,
  history: (orgId: string, orgNodeId?: string) =>
    [...riskStrategyKeys.all(orgId), "history", orgNodeId ?? null] as const,
  version: (orgId: string, configId: string) =>
    [...riskStrategyKeys.all(orgId), "version", configId] as const,
  settings: (orgId: string) => [...riskStrategyKeys.all(orgId), "settings"] as const,
};

// Rating scales/appetite change rarely relative to how often they're read.
const STALE_TIME = 60_000;

export function useCurrentRiskStrategy(orgId: string | undefined, orgNodeId?: string) {
  return useQuery({
    queryKey: riskStrategyKeys.current(orgId ?? "", orgNodeId),
    queryFn: () => fetchCurrentRiskStrategy(orgId!, orgNodeId),
    enabled: !!orgId,
    staleTime: STALE_TIME,
    // No version has ever been approved yet — a real, expected state, not an error.
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useRiskStrategyHistory(orgId: string | undefined, orgNodeId?: string) {
  return useQuery({
    queryKey: riskStrategyKeys.history(orgId ?? "", orgNodeId),
    queryFn: () => fetchRiskStrategyHistory(orgId!, orgNodeId),
    enabled: !!orgId,
    staleTime: STALE_TIME,
  });
}

export function useRiskStrategyVersion(orgId: string | undefined, configId: string | undefined) {
  return useQuery({
    queryKey: riskStrategyKeys.version(orgId ?? "", configId ?? ""),
    queryFn: () => fetchRiskStrategyVersion(orgId!, configId!),
    enabled: !!orgId && !!configId,
    staleTime: STALE_TIME,
  });
}

export function useRiskStrategySettings(orgId: string | undefined) {
  return useQuery({
    queryKey: riskStrategyKeys.settings(orgId ?? ""),
    queryFn: () => fetchRiskStrategySettings(orgId!),
    enabled: !!orgId,
    staleTime: STALE_TIME,
  });
}

function useInvalidateRiskStrategy(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: riskStrategyKeys.all(orgId) });
}

export function useCreateRiskStrategyVersion(orgId: string) {
  const invalidate = useInvalidateRiskStrategy(orgId);
  return useMutation({
    mutationFn: (body: CreateRiskStrategyVersionRequest) =>
      createRiskStrategyVersion(orgId, body),
    onSuccess: invalidate,
  });
}

export function useDecideRiskStrategyVersion(orgId: string) {
  const invalidate = useInvalidateRiskStrategy(orgId);
  return useMutation({
    mutationFn: ({ configId, body }: { configId: string; body: ApprovalDecisionRequest }) =>
      decideRiskStrategyVersion(orgId, configId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateRiskStrategySettings(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateRiskStrategySettingsRequest) =>
      updateRiskStrategySettings(orgId, body),
    onSuccess: (data) =>
      queryClient.setQueryData(riskStrategyKeys.settings(orgId), data),
  });
}
