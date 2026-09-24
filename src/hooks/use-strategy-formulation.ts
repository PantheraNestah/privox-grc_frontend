import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveStrategyElement,
  createStrategyElement,
  createStrategyVersion,
  fetchStrategyElementDetail,
  fetchStrategyElements,
  fetchStrategyFormulationSettings,
  fetchStrategyInsights,
  fetchStrategyProgressHistory,
  fetchStrategySummary,
  fetchStrategyTree,
  fetchStrategyVersion,
  fetchStrategyVersionHistory,
  publishStrategyVersion,
  recordStrategyApprovalDecision,
  recordStrategyProgress,
  updateStrategyFormulationSettings,
} from "@/lib/strategy-formulation";
import type {
  CreateStrategyElementRequest,
  CreateStrategyVersionRequest,
  RecordStrategyProgressRequest,
  StrategyApprovalDecisionRequest,
  StrategyElementFilters,
  UpdateStrategyFormulationSettingsRequest,
} from "@/lib/strategy-formulation-types";

const SETTINGS_STALE_TIME = 5 * 60_000;
const STRUCTURE_STALE_TIME = 2 * 60_000;
const LIVE_STALE_TIME = 30_000;

export const strategyFormulationKeys = {
  all: (orgId: string) => ["strategy-formulation", orgId] as const,
  settings: (orgId: string) =>
    [...strategyFormulationKeys.all(orgId), "settings"] as const,
  elements: (orgId: string, filters: StrategyElementFilters = {}) =>
    [
      ...strategyFormulationKeys.all(orgId),
      "elements",
      {
        type: filters.type ?? null,
        parentElementId: filters.parentElementId ?? null,
        orgNodeId: filters.orgNodeId ?? null,
      },
    ] as const,
  element: (orgId: string, elementId: string) =>
    [...strategyFormulationKeys.all(orgId), "element", elementId] as const,
  tree: (orgId: string) => [...strategyFormulationKeys.all(orgId), "tree"] as const,
  versions: (orgId: string, elementId: string) =>
    [...strategyFormulationKeys.all(orgId), "versions", elementId] as const,
  version: (orgId: string, elementId: string, versionId: string) =>
    [
      ...strategyFormulationKeys.all(orgId),
      "version",
      elementId,
      versionId,
    ] as const,
  progress: (orgId: string, elementId: string) =>
    [...strategyFormulationKeys.all(orgId), "progress", elementId] as const,
  summary: (orgId: string) =>
    [...strategyFormulationKeys.all(orgId), "summary"] as const,
  insights: (orgId: string) =>
    [...strategyFormulationKeys.all(orgId), "insights"] as const,
};

export function useStrategyFormulationSettings(orgId: string | undefined) {
  return useQuery({
    queryKey: strategyFormulationKeys.settings(orgId ?? ""),
    queryFn: () => fetchStrategyFormulationSettings(orgId!),
    enabled: !!orgId,
    staleTime: SETTINGS_STALE_TIME,
  });
}

export function useStrategyElements(
  orgId: string | undefined,
  filters?: StrategyElementFilters,
) {
  return useQuery({
    queryKey: strategyFormulationKeys.elements(orgId ?? "", filters),
    queryFn: () => fetchStrategyElements(orgId!, filters),
    enabled: !!orgId,
    staleTime: STRUCTURE_STALE_TIME,
  });
}

export function useStrategyElementDetail(
  orgId: string | undefined,
  elementId: string | undefined,
) {
  return useQuery({
    queryKey: strategyFormulationKeys.element(orgId ?? "", elementId ?? ""),
    queryFn: () => fetchStrategyElementDetail(orgId!, elementId!),
    enabled: !!orgId && !!elementId,
    staleTime: STRUCTURE_STALE_TIME,
  });
}

export function useStrategyTree(orgId: string | undefined) {
  return useQuery({
    queryKey: strategyFormulationKeys.tree(orgId ?? ""),
    queryFn: () => fetchStrategyTree(orgId!),
    enabled: !!orgId,
    staleTime: STRUCTURE_STALE_TIME,
  });
}

export function useStrategyVersionHistory(
  orgId: string | undefined,
  elementId: string | undefined,
) {
  return useQuery({
    queryKey: strategyFormulationKeys.versions(orgId ?? "", elementId ?? ""),
    queryFn: () => fetchStrategyVersionHistory(orgId!, elementId!),
    enabled: !!orgId && !!elementId,
    staleTime: STRUCTURE_STALE_TIME,
  });
}

export function useStrategyVersion(
  orgId: string | undefined,
  elementId: string | undefined,
  versionId: string | undefined,
) {
  return useQuery({
    queryKey: strategyFormulationKeys.version(
      orgId ?? "",
      elementId ?? "",
      versionId ?? "",
    ),
    queryFn: () => fetchStrategyVersion(orgId!, elementId!, versionId!),
    enabled: !!orgId && !!elementId && !!versionId,
    staleTime: STRUCTURE_STALE_TIME,
  });
}

export function useStrategyProgressHistory(
  orgId: string | undefined,
  elementId: string | undefined,
) {
  return useQuery({
    queryKey: strategyFormulationKeys.progress(orgId ?? "", elementId ?? ""),
    queryFn: () => fetchStrategyProgressHistory(orgId!, elementId!),
    enabled: !!orgId && !!elementId,
    staleTime: LIVE_STALE_TIME,
  });
}

export function useStrategySummary(orgId: string | undefined) {
  return useQuery({
    queryKey: strategyFormulationKeys.summary(orgId ?? ""),
    queryFn: () => fetchStrategySummary(orgId!),
    enabled: !!orgId,
    staleTime: LIVE_STALE_TIME,
  });
}

export function useStrategyInsights(orgId: string | undefined) {
  return useQuery({
    queryKey: strategyFormulationKeys.insights(orgId ?? ""),
    queryFn: () => fetchStrategyInsights(orgId!),
    enabled: !!orgId,
    staleTime: LIVE_STALE_TIME,
  });
}

function useInvalidateStrategyFormulation(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: strategyFormulationKeys.all(orgId) });
}

export function useUpdateStrategyFormulationSettings(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateStrategyFormulationSettingsRequest) =>
      updateStrategyFormulationSettings(orgId, body),
    onSuccess: (data) =>
      queryClient.setQueryData(strategyFormulationKeys.settings(orgId), data),
  });
}

export function useCreateStrategyElement(orgId: string) {
  const invalidate = useInvalidateStrategyFormulation(orgId);
  return useMutation({
    mutationFn: (body: CreateStrategyElementRequest) =>
      createStrategyElement(orgId, body),
    onSuccess: invalidate,
  });
}

export function usePublishStrategyVersion(orgId: string) {
  const invalidate = useInvalidateStrategyFormulation(orgId);
  return useMutation({
    mutationFn: ({ elementId, versionId }: { elementId: string; versionId: string }) =>
      publishStrategyVersion(orgId, elementId, versionId),
    onSuccess: invalidate,
  });
}

export function useRecordStrategyApprovalDecision(orgId: string) {
  const invalidate = useInvalidateStrategyFormulation(orgId);
  return useMutation({
    mutationFn: ({
      elementId,
      versionId,
      body,
    }: {
      elementId: string;
      versionId: string;
      body: StrategyApprovalDecisionRequest;
    }) => recordStrategyApprovalDecision(orgId, elementId, versionId, body),
    onSuccess: invalidate,
  });
}

export function useCreateStrategyVersion(orgId: string) {
  const invalidate = useInvalidateStrategyFormulation(orgId);
  return useMutation({
    mutationFn: ({
      elementId,
      body,
    }: {
      elementId: string;
      body: CreateStrategyVersionRequest;
    }) => createStrategyVersion(orgId, elementId, body),
    onSuccess: invalidate,
  });
}

export function useArchiveStrategyElement(orgId: string) {
  const invalidate = useInvalidateStrategyFormulation(orgId);
  return useMutation({
    mutationFn: (elementId: string) => archiveStrategyElement(orgId, elementId),
    onSuccess: invalidate,
  });
}

export function useRecordStrategyProgress(orgId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateStrategyFormulation(orgId);
  return useMutation({
    mutationFn: ({
      elementId,
      body,
    }: {
      elementId: string;
      body: RecordStrategyProgressRequest;
    }) => recordStrategyProgress(orgId, elementId, body),
    onSuccess: (data, { elementId }) => {
      queryClient.setQueryData<unknown[]>(
        strategyFormulationKeys.progress(orgId, elementId),
        (current) => [data, ...(Array.isArray(current) ? current : [])],
      );
      return invalidate();
    },
  });
}
