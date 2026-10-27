import type { Page } from "@playwright/test";
import type { ApiStubs } from "./api-stub";

/** Shared fixtures for the organization-selection journeys. */

export const ORGANIZATIONS = {
  sic: { id: "org-sic", code: "SIC", name: "Savanna Insurance" },
  gnc: { id: "org-gnc", code: "GNC", name: "GNC Holdings" },
} as const;

export type OrganizationFixture = { id: string; code: string; name: string };

export const USER = {
  id: "user-gift",
  email: "giftnestah@gmail.com",
  username: "giftnestah",
  fullName: "Gift Nestah",
};

/** Always > 30 minutes out so the proactive refresh timer stays quiet. */
export const expiresAt = () => new Date(Date.now() + 60 * 60_000).toISOString();

export const PASSWORD = process.env.E2E_PASSWORD ?? "correct-horse-battery";

export function authenticatedSession(
  organization: OrganizationFixture,
  overrides: Record<string, unknown> = {},
) {
  return {
    status: "AUTHENTICATED",
    accessToken: `access-${organization.code.toLowerCase()}`,
    refreshToken: `refresh-${organization.code.toLowerCase()}`,
    tokenType: "Bearer",
    expiresIn: 3600,
    accessTokenExpiresAt: expiresAt(),
    user: USER,
    organization,
    permissions: ["organization.manage"],
    allocatedModules: ["CORE", "GOVERNANCE", "RISK_MANAGEMENT", "USER_MANAGEMENT"],
    orgNodeIds: [],
    ...overrides,
  };
}

export function organizationCards() {
  return [
    {
      id: ORGANIZATIONS.sic.id,
      code: ORGANIZATIONS.sic.code,
      name: ORGANIZATIONS.sic.name,
      primary: true,
      lastUsedAt: new Date(Date.now() - 86_400_000).toISOString(),
      groups: ["SIC_ORG_ADMIN"],
      modules: ["CORE", "GOVERNANCE"],
    },
    {
      id: ORGANIZATIONS.gnc.id,
      code: ORGANIZATIONS.gnc.code,
      name: ORGANIZATIONS.gnc.name,
      primary: false,
      lastUsedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      groups: ["GNC_GOVERNANCE_APPROVER"],
      modules: ["CORE", "RISK_MANAGEMENT"],
    },
  ];
}

export function selectionRequiredResponse() {
  return {
    status: "ORGANIZATION_SELECTION_REQUIRED",
    accessToken: null,
    refreshToken: null,
    organization: null,
    permissions: [],
    user: USER,
    selectionToken: "selection-token-1",
    selectionTokenExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    organizations: organizationCards(),
  };
}

const MODULE_NAMES: Record<string, string> = {
  CORE: "CORE",
  GOVERNANCE: "GOVERNANCE",
  RISK_MANAGEMENT: "RISK_MANAGEMENT",
  USER_MANAGEMENT: "USER_MANAGEMENT",
};

/** `GET /v1/organizations/:orgId/modules` payload. */
export function modulesFor(codes: string[]) {
  return codes.map((code, index) => ({
    id: `module-${code}`,
    moduleId: `module-${code}`,
    code,
    name: MODULE_NAMES[code] ?? code,
    enabled: true,
    sortOrder: index,
  }));
}

export function meResponse(organization: OrganizationFixture) {
  return {
    id: USER.id,
    email: USER.email,
    username: USER.username,
    fullName: USER.fullName,
    organization,
    permissions: ["organization.manage"],
    allocatedModules: ["CORE", "GOVERNANCE", "RISK_MANAGEMENT", "USER_MANAGEMENT"],
    accessTokenExpiresAt: expiresAt(),
  };
}

/** Drives the real credentials form (auth lives in memory, so it cannot be seeded). */
export async function signIn(
  page: Page,
  { email = USER.email, password = PASSWORD }: { email?: string; password?: string } = {},
) {
  await page.goto("/");
  await page.getByLabel("Email or Username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

/**
 * Registers the session-restore endpoints so a reload keeps the current
 * organization (the access token is memory-only; a reload refreshes).
 */
export function stubSessionRestore(
  stubs: ApiStubs,
  organization: () => OrganizationFixture,
) {
  stubs.on("POST", "/v1/auth/refresh", ({ route }) => {
    const org = organization();
    stubs.json(route, {
      accessToken: `access-refreshed-${org.code.toLowerCase()}`,
      refreshToken: `refresh-${org.code.toLowerCase()}-rotated`,
      tokenType: "Bearer",
      expiresIn: 3600,
      accessTokenExpiresAt: expiresAt(),
      permissions: ["organization.manage"],
    });
  });

  stubs.on("GET", "/v1/me", ({ route }) => {
    stubs.json(route, meResponse(organization()));
  });
}
