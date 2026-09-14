/**
 * React Query state layer for the platform org-node-template catalogue.
 * Uses the platform auth client so the token carries no `org` claim.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchOrgNodeTemplatePreview,
  fetchOrgNodeTemplates,
  registerOrgNodeTemplate,
} from "@/lib/orgNodeTemplates";
import type { RegisterOrgNodeTemplateRequest } from "@/lib/governance-types";

export const platformTemplateKeys = {
  all: ["platform", "org-node-templates"] as const,
  list: () => [...platformTemplateKeys.all, "list"] as const,
  preview: (templateId: string) => [...platformTemplateKeys.all, "preview", templateId] as const,
};

// The template catalogue changes rarely; cache generously.
const CATALOGUE_STALE_TIME = 5 * 60_000;

export function usePlatformTemplates() {
  return useQuery({
    queryKey: platformTemplateKeys.list(),
    queryFn: () => fetchOrgNodeTemplates("platform"),
    staleTime: CATALOGUE_STALE_TIME,
  });
}

export function usePlatformTemplatePreview(templateId: string | undefined) {
  return useQuery({
    queryKey: platformTemplateKeys.preview(templateId ?? ""),
    queryFn: () => fetchOrgNodeTemplatePreview(templateId!, "platform"),
    enabled: !!templateId,
    staleTime: CATALOGUE_STALE_TIME,
  });
}

export function useRegisterPlatformTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterOrgNodeTemplateRequest) =>
      registerOrgNodeTemplate(body, "platform"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformTemplateKeys.list() }),
  });
}
