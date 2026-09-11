/**
 * Platform Admin API service.
 *
 * Covers the platform-scoped (non-org) endpoints from the
 * "GRC Platfom Admin APIs" Postman collection: organization onboarding
 * (create / list / approve / suspend / reactivate) and platform module
 * catalogue / per-organization module assignment.
 *
 * The platform org-node-template endpoints live in `orgNodeTemplates.ts`
 * (same platform scope), so they are intentionally not duplicated here.
 *
 * All requests are authenticated via the shared axios interceptor in
 * `api.ts`. Note that a platform admin token has no `org` claim, so it must
 * be obtained with a login call that omits `organizationId`
 * (see `loginPlatformAdmin`).
 */

import { platformApi } from "./api";

// ─── Organizations ─────────────────────────────────────────

export type OrganizationStatus =
  | "PENDING_VALIDATION"
  | "ACTIVE"
  | "SUSPENDED"
  | "DEACTIVATED"
  | "REJECTED"
  | (string & {});

export type PlanTier = "STANDARD" | "PREMIUM" | "ENTERPRISE" | (string & {});

export interface PlatformOrganization {
  id: string;
  name: string;
  code: string;
  slug: string;
  planTier: PlanTier | null;
  countryCode: string | null;
  status: OrganizationStatus;
  validatedByUserId: string | null;
  validatedAt: string | null;
  validationNotes: string | null;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
}

export interface CreatePlatformOrganizationRequest {
  name: string;
  code: string;
  slug: string;
  countryCode: string;
  planTier?: PlanTier;
}

export interface ListPlatformOrganizationsParams {
  /** Filter the list, e.g. `PENDING_VALIDATION` for the approval queue. */
  status?: OrganizationStatus;
}

export interface ApprovePlatformOrganizationRequest {
  /** Email of the first org admin to be created/notified on approval. */
  adminEmail: string;
  /** Optional access group to place the new admin into. */
  initialGroupId?: string;
  notes?: string;
}

/** `POST /v1/platform/organizations` — register a new tenant. */
export async function createPlatformOrganization(
  body: CreatePlatformOrganizationRequest,
): Promise<PlatformOrganization> {
  const { data } = await platformApi.post<PlatformOrganization>(
    "/v1/platform/organizations",
    body,
  );
  return data;
}

/** `GET /v1/platform/organizations` — list tenants, optionally by status. */
export async function listPlatformOrganizations(
  params: ListPlatformOrganizationsParams = {},
): Promise<PlatformOrganization[]> {
  const { data } = await platformApi.get<PlatformOrganization[]>(
    "/v1/platform/organizations",
    { params: params.status ? { status: params.status } : undefined },
  );
  return data;
}

/** `GET /v1/platform/organizations/{organizationId}` — one tenant. */
export async function getPlatformOrganization(
  organizationId: string,
): Promise<PlatformOrganization> {
  const { data } = await platformApi.get<PlatformOrganization>(
    `/v1/platform/organizations/${organizationId}`,
  );
  return data;
}

/** `POST /v1/platform/organizations/{organizationId}/approve` — validate/onboard. */
export async function approvePlatformOrganization(
  organizationId: string,
  body: ApprovePlatformOrganizationRequest,
): Promise<PlatformOrganization> {
  const { data } = await platformApi.post<PlatformOrganization>(
    `/v1/platform/organizations/${organizationId}/approve`,
    body,
  );
  return data;
}

/** `POST /v1/platform/organizations/{organizationId}/suspend`. */
export async function suspendPlatformOrganization(
  organizationId: string,
): Promise<PlatformOrganization> {
  const { data } = await platformApi.post<PlatformOrganization>(
    `/v1/platform/organizations/${organizationId}/suspend`,
  );
  return data;
}

/** `POST /v1/platform/organizations/{organizationId}/reactivate`. */
export async function reactivatePlatformOrganization(
  organizationId: string,
): Promise<PlatformOrganization> {
  const { data } = await platformApi.post<PlatformOrganization>(
    `/v1/platform/organizations/${organizationId}/reactivate`,
  );
  return data;
}

// ─── Modules ───────────────────────────────────────────────

export interface PlatformModule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface OrganizationModuleAssignment {
  /** Assignment row id (not the module id). */
  id: string;
  moduleId: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  enabled: boolean;
  enabledAt: string | null;
  disabledAt: string | null;
}

/** `GET /v1/platform/modules` — the platform-wide module catalogue. */
export async function listPlatformModules(): Promise<PlatformModule[]> {
  const { data } = await platformApi.get<PlatformModule[]>("/v1/platform/modules");
  return data;
}

/** `GET /v1/platform/organizations/{organizationId}/modules` — assignments for one tenant. */
export async function listPlatformOrganizationModules(
  organizationId: string,
): Promise<OrganizationModuleAssignment[]> {
  const { data } = await platformApi.get<OrganizationModuleAssignment[]>(
    `/v1/platform/organizations/${organizationId}/modules`,
  );
  return data;
}

/** `POST /v1/platform/organizations/{organizationId}/modules/{moduleId}/enable`. */
export async function enablePlatformOrganizationModule(
  organizationId: string,
  moduleId: string,
): Promise<OrganizationModuleAssignment> {
  const { data } = await platformApi.post<OrganizationModuleAssignment>(
    `/v1/platform/organizations/${organizationId}/modules/${moduleId}/enable`,
  );
  return data;
}

/** `POST /v1/platform/organizations/{organizationId}/modules/{moduleId}/disable`. */
export async function disablePlatformOrganizationModule(
  organizationId: string,
  moduleId: string,
): Promise<OrganizationModuleAssignment> {
  const { data } = await platformApi.post<OrganizationModuleAssignment>(
    `/v1/platform/organizations/${organizationId}/modules/${moduleId}/disable`,
  );
  return data;
}

// ─── Platform login ────────────────────────────────────────

export interface PlatformUser {
  id: string;
  email: string;
  username: string | null;
  fullName: string;
}

export interface PlatformLoginRequest {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

export interface PlatformLoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  accessTokenExpiresAt: string;
  user: PlatformUser;
  organization: null;
  permissions: string[];
}

/**
 * `POST /v1/auth/login` — platform-admin variant.
 *
 * Deliberately omits `organizationId` (the shared `AuthContext.login` hard-codes
 * one for the org dashboard), which asks the backend to mint a platform token
 * with no `org` claim — required for every platform-scoped endpoint above.
 */
export async function loginPlatformAdmin(
  body: PlatformLoginRequest,
): Promise<PlatformLoginResponse> {
  const { data } = await platformApi.post<PlatformLoginResponse>("/v1/auth/login", {
    identifier: body.identifier,
    password: body.password,
    rememberMe: body.rememberMe ?? false,
  });
  return data;
}
