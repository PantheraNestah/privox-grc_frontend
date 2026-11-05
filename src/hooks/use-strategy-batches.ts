import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decideBatch,
  dryRunJsonBatch,
  fetchBatch,
  fetchBatches,
  fetchConformance,
  fetchHierarchyRules,
  submitJsonBatch,
  uploadBatchFile,
  type BatchDecision,
  type BatchFileOptions,
  type BatchMode,
  type BatchStatus,
} from "@/lib/strategy-batches";
import { strategyFormulationKeys } from "@/hooks/use-strategy-formulation";

export const strategyBatchKeys = {
  list: (orgId: string, status?: BatchStatus) =>
    [...strategyFormulationKeys.all(orgId), "batches", status ?? "all"] as const,
  detail: (orgId: string, batchId: string) =>
    [...strategyFormulationKeys.all(orgId), "batch", batchId] as const,
  conformance: (orgId: string) => [...strategyFormulationKeys.all(orgId), "conformance"] as const,
  hierarchyRules: (orgId: string) => [...strategyFormulationKeys.all(orgId), "hierarchy-rules"] as const,
};

export function useStrategyBatches(orgId: string | undefined, status?: BatchStatus) {
  return useQuery({
    queryKey: strategyBatchKeys.list(orgId ?? "", status),
    queryFn: () => fetchBatches(orgId!, status),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  });
}

export function useStrategyBatch(orgId: string | undefined, batchId: string | null) {
  return useQuery({
    queryKey: strategyBatchKeys.detail(orgId ?? "", batchId ?? ""),
    queryFn: () => fetchBatch(orgId!, batchId!),
    enabled: Boolean(orgId && batchId),
  });
}

export function useStrategyConformance(orgId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: strategyBatchKeys.conformance(orgId ?? ""),
    queryFn: () => fetchConformance(orgId!),
    enabled: Boolean(orgId) && enabled,
  });
}

export function useStrategyHierarchyRules(orgId: string | undefined) {
  return useQuery({
    queryKey: strategyBatchKeys.hierarchyRules(orgId ?? ""),
    queryFn: () => fetchHierarchyRules(orgId!),
    enabled: Boolean(orgId),
    staleTime: 5 * 60_000,
  });
}

/** Dry runs never write, so they do not invalidate anything. */
export function useBatchDryRun(orgId: string) {
  return useMutation({
    mutationFn: (input: { source: { kind: "json"; plan: unknown } | { kind: "file"; file: File; options: BatchFileOptions }; mode: BatchMode }) =>
      input.source.kind === "json"
        ? dryRunJsonBatch(orgId, input.source.plan, input.mode)
        : uploadBatchFile(orgId, input.source.file, { ...input.source.options, mode: input.mode, dryRun: true }),
  });
}

/** Applies (201) or stages (202) a batch, so the whole strategy cache is refreshed. */
export function useBatchSubmit(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { source: { kind: "json"; plan: unknown } | { kind: "file"; file: File; options: BatchFileOptions }; mode: BatchMode }) =>
      input.source.kind === "json"
        ? submitJsonBatch(orgId, input.source.plan, input.mode)
        : uploadBatchFile(orgId, input.source.file, { ...input.source.options, mode: input.mode, dryRun: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: strategyFormulationKeys.all(orgId) }),
  });
}

export function useBatchDecision(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { batchId: string; decision: BatchDecision; comments?: string }) =>
      decideBatch(orgId, input.batchId, { decision: input.decision, comments: input.comments }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: strategyFormulationKeys.all(orgId) }),
  });
}
