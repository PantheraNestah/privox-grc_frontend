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
  RiskStrategyConfigResponse,
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
    // A 404 means no version has ever been approved: an expected empty state. The
    // global retry policy (src/lib/query-client.ts) already fails 4xx fast.
  });
}

/** True when the query failed for a reason other than "no version approved yet". */
export function isRealStrategyError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return !!error && status !== 404;
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

/**
 * Once a version is the active one, write it straight into the "current" cache
 * entry so the UI shows the saved values immediately, then invalidate so the
 * server stays the source of truth.
 */
function usePrimeCurrentStrategy(orgId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRiskStrategy(orgId);
  return (version: RiskStrategyConfigResponse) => {
    if (version.current) {
      queryClient.setQueryData(riskStrategyKeys.current(orgId), version);
    }
    return invalidate();
  };
}

export function useCreateRiskStrategyVersion(orgId: string) {
  const onSaved = usePrimeCurrentStrategy(orgId);
  return useMutation({
    mutationFn: (body: CreateRiskStrategyVersionRequest) =>
      createRiskStrategyVersion(orgId, body),
    onSuccess: onSaved,
  });
}

export function useDecideRiskStrategyVersion(orgId: string) {
  const onSaved = usePrimeCurrentStrategy(orgId);
  return useMutation({
    mutationFn: ({ configId, body }: { configId: string; body: ApprovalDecisionRequest }) =>
      decideRiskStrategyVersion(orgId, configId, body),
    onSuccess: onSaved,
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
