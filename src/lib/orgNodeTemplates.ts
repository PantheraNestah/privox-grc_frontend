/**
 * Org Node Templates API service (Governance module — platform catalogue of
 * reusable org-tree starter trees, cloned on demand into an organization).
 * See GOVERNANCE_API_ENDPOINTS.md §16 for the full reference.
 */

import { api } from "./api";
import type {
  OrgNodeTemplateResponse,
  OrgNodeTemplatePreviewResponse,
  RegisterOrgNodeTemplateRequest,
} from "./governance-types";

export async function fetchOrgNodeTemplates(): Promise<OrgNodeTemplateResponse[]> {
  const { data } = await api.get<OrgNodeTemplateResponse[]>(
    "/v1/platform/org-node-templates",
  );
  return data;
}

export async function fetchOrgNodeTemplatePreview(
  templateId: string,
): Promise<OrgNodeTemplatePreviewResponse> {
  const { data } = await api.get<OrgNodeTemplatePreviewResponse>(
    `/v1/platform/org-node-templates/${templateId}/preview`,
  );
  return data;
}

export async function registerOrgNodeTemplate(
  body: RegisterOrgNodeTemplateRequest,
): Promise<OrgNodeTemplateResponse> {
  const { data } = await api.post<OrgNodeTemplateResponse>(
    "/v1/platform/org-node-templates",
    body,
  );
  return data;
}
