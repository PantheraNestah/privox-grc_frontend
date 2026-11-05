import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  amendAssessment,
  createAssessment,
  decideRevision,
  discardRevision,
  fetchAssessment,
  fetchAssessmentSettings,
  fetchAssessmentSummary,
  fetchAssessments,
  fetchPendingApprovals,
  fetchRevisions,
  fetchRollup,
  fetchWorklist,
  resyncRevision,
  saveDraft,
  submitRevision,
  updateAssessmentSettings,
  type AssessmentDecision,
  type AssessmentRevisionStatus,
  type AssessmentSettings,
  type UpdateDraftRequest,
} from "@/lib/strategy-assessment";

export interface AssessmentPeriod {
  periodStart: string;
  periodEnd: string;
}

export const strategyAssessmentKeys = {
  all: (orgId: string) => ["strategy-assessment", orgId] as const,
  settings: (orgId: string) => [...strategyAssessmentKeys.all(orgId), "settings"] as const,
  worklist: (orgId: string, period: AssessmentPeriod, status?: AssessmentRevisionStatus) =>
    [...strategyAssessmentKeys.all(orgId), "worklist", period.periodStart, period.periodEnd, status ?? "all"] as const,
  assessments: (orgId: string, elementId?: string) =>
    [...strategyAssessmentKeys.all(orgId), "assessments", elementId ?? "all"] as const,
  assessment: (orgId: string, assessmentId: string) =>
    [...strategyAssessmentKeys.all(orgId), "assessment", assessmentId] as const,
  revisions: (orgId: string, assessmentId: string) =>
    [...strategyAssessmentKeys.all(orgId), "revisions", assessmentId] as const,
  approvals: (orgId: string) => [...strategyAssessmentKeys.all(orgId), "approvals"] as const,
  summary: (orgId: string, period: AssessmentPeriod) =>
    [...strategyAssessmentKeys.all(orgId), "summary", period.periodStart, period.periodEnd] as const,
  rollup: (orgId: string, period: AssessmentPeriod) =>
    [...strategyAssessmentKeys.all(orgId), "rollup", period.periodStart, period.periodEnd] as const,
};

export function useAssessmentSettings(orgId: string | undefined) {
  return useQuery({
    queryKey: strategyAssessmentKeys.settings(orgId ?? ""),
    queryFn: () => fetchAssessmentSettings(orgId!),
    enabled: Boolean(orgId),
    staleTime: 5 * 60_000,
  });
}

export function useWorklist(orgId: string | undefined, period: AssessmentPeriod, status?: AssessmentRevisionStatus) {
  return useQuery({
    queryKey: strategyAssessmentKeys.worklist(orgId ?? "", period, status),
    queryFn: () => fetchWorklist(orgId!, { ...period, status }),
    enabled: Boolean(orgId),
  });
}

export function useAssessments(orgId: string | undefined, elementId?: string) {
  return useQuery({
    queryKey: strategyAssessmentKeys.assessments(orgId ?? "", elementId),
    queryFn: () => fetchAssessments(orgId!, { elementId }),
    enabled: Boolean(orgId),
  });
}

export function useAssessment(orgId: string | undefined, assessmentId: string | null) {
  return useQuery({
    queryKey: strategyAssessmentKeys.assessment(orgId ?? "", assessmentId ?? ""),
    queryFn: () => fetchAssessment(orgId!, assessmentId!),
    enabled: Boolean(orgId && assessmentId),
  });
}

export function useRevisions(orgId: string | undefined, assessmentId: string | null) {
  return useQuery({
    queryKey: strategyAssessmentKeys.revisions(orgId ?? "", assessmentId ?? ""),
    queryFn: () => fetchRevisions(orgId!, assessmentId!),
    enabled: Boolean(orgId && assessmentId),
  });
}

export function usePendingApprovals(orgId: string | undefined) {
  return useQuery({
    queryKey: strategyAssessmentKeys.approvals(orgId ?? ""),
    queryFn: () => fetchPendingApprovals(orgId!),
    enabled: Boolean(orgId),
    refetchInterval: 60_000,
  });
}

export function useAssessmentSummary(orgId: string | undefined, period: AssessmentPeriod) {
  return useQuery({
    queryKey: strategyAssessmentKeys.summary(orgId ?? "", period),
    queryFn: () => fetchAssessmentSummary(orgId!, period),
    enabled: Boolean(orgId),
  });
}

export function useRollup(orgId: string | undefined, period: AssessmentPeriod) {
  return useQuery({
    queryKey: strategyAssessmentKeys.rollup(orgId ?? "", period),
    queryFn: () => fetchRollup(orgId!, period),
    enabled: Boolean(orgId),
  });
}

/** Every write refreshes the whole assessment cache, because a decision changes the worklist, approvals and rollup at once. */
function useAssessmentWrite<TVariables, TResult>(orgId: string, run: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: strategyAssessmentKeys.all(orgId) }),
  });
}

export function useCreateAssessment(orgId: string) {
  return useAssessmentWrite(orgId, (body: { strategyElementId: string } & AssessmentPeriod) =>
    createAssessment(orgId, body),
  );
}

export function useAmendAssessment(orgId: string) {
  return useAssessmentWrite(orgId, (assessmentId: string) => amendAssessment(orgId, assessmentId));
}

export function useSaveDraft(orgId: string) {
  return useAssessmentWrite(orgId, (input: { revisionId: string; body: UpdateDraftRequest }) =>
    saveDraft(orgId, input.revisionId, input.body),
  );
}

export function useResyncRevision(orgId: string) {
  return useAssessmentWrite(orgId, (revisionId: string) => resyncRevision(orgId, revisionId));
}

export function useDiscardRevision(orgId: string) {
  return useAssessmentWrite(orgId, (revisionId: string) => discardRevision(orgId, revisionId));
}

export function useSubmitRevision(orgId: string) {
  return useAssessmentWrite(orgId, (revisionId: string) => submitRevision(orgId, revisionId));
}

export function useDecideRevision(orgId: string) {
  return useAssessmentWrite(
    orgId,
    (input: { revisionId: string; decision: AssessmentDecision; comments?: string }) =>
      decideRevision(orgId, input.revisionId, { decision: input.decision, comments: input.comments }),
  );
}

export function useUpdateAssessmentSettings(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AssessmentSettings) => updateAssessmentSettings(orgId, body),
    onSuccess: (data) => queryClient.setQueryData(strategyAssessmentKeys.settings(orgId), data),
  });
}
