/**
 * Org Node Templates API service (platform catalogue of reusable org-tree
 * starter trees, cloned on demand into an organization).
 *
 * The endpoints are platform-scoped, so the `scope` argument selects which
 * auth client to use: platform-admin pages pass `"platform"` (token with no
 * `org` claim), while the tenant Governance module defaults to the
 * organization-scoped client.
 */

import { api, platformApi } from "./api";
import type { AuthScope } from "./token";
import type {
  OrgNodeTemplateResponse,
  OrgNodeTemplatePreviewResponse,
  RegisterOrgNodeTemplateRequest,
} from "./governance-types";

const clientFor = (scope: AuthScope) => (scope === "platform" ? platformApi : api);

export async function fetchOrgNodeTemplates(
  scope: AuthScope = "tenant",
): Promise<OrgNodeTemplateResponse[]> {
  const { data } = await clientFor(scope).get<OrgNodeTemplateResponse[]>(
    "/v1/platform/org-node-templates",
  );
  return data;
}

export async function fetchOrgNodeTemplatePreview(
  templateId: string,
  scope: AuthScope = "tenant",
): Promise<OrgNodeTemplatePreviewResponse> {
  const { data } = await clientFor(scope).get<OrgNodeTemplatePreviewResponse>(
    `/v1/platform/org-node-templates/${templateId}/preview`,
  );
  return data;
}

export async function registerOrgNodeTemplate(
  body: RegisterOrgNodeTemplateRequest,
  scope: AuthScope = "tenant",
): Promise<OrgNodeTemplateResponse> {
  const { data } = await clientFor(scope).post<OrgNodeTemplateResponse>(
    "/v1/platform/org-node-templates",
    body,
  );
  return data;
}
