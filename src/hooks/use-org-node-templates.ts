/**
 * React Query state layer for the Org Node Templates catalogue
 * (platform-admin registration + org-side preview/clone browsing).
 * UI components should only import from here — never call
 * `@/lib/orgNodeTemplates` directly.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchOrgNodeTemplatePreview,
  fetchOrgNodeTemplates,
  registerOrgNodeTemplate,
} from "@/lib/orgNodeTemplates";
import type { RegisterOrgNodeTemplateRequest } from "@/lib/governance-types";

export const orgNodeTemplateKeys = {
  all: ["org-node-templates"] as const,
  list: () => [...orgNodeTemplateKeys.all, "list"] as const,
  preview: (templateId: string) =>
    [...orgNodeTemplateKeys.all, "preview", templateId] as const,
};

// Platform catalogue changes rarely; cache generously.
const CATALOGUE_STALE_TIME = 5 * 60_000;

export function useOrgNodeTemplates() {
  return useQuery({
    queryKey: orgNodeTemplateKeys.list(),
    queryFn: fetchOrgNodeTemplates,
    staleTime: CATALOGUE_STALE_TIME,
  });
}

export function useOrgNodeTemplatePreview(templateId: string | undefined) {
  return useQuery({
    queryKey: orgNodeTemplateKeys.preview(templateId ?? ""),
    queryFn: () => fetchOrgNodeTemplatePreview(templateId!),
    enabled: !!templateId,
    staleTime: CATALOGUE_STALE_TIME,
  });
}

export function useRegisterOrgNodeTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterOrgNodeTemplateRequest) =>
      registerOrgNodeTemplate(body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: orgNodeTemplateKeys.list() }),
  });
}
