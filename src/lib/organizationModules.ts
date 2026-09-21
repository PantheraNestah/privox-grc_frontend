import { api } from "@/lib/api";
import { MODULES, type ModuleDef } from "@/data/modules";

/**
 * Organization module subscription row (backend OrganizationModuleResponse).
 *
 * The listing endpoint (§3.7, GET /v1/organizations/{id}/modules) now returns
 * ALL catalogued modules — including disabled ones — with an explicit
 * `enabled` boolean flag.
 */
export interface OrganizationModuleStatus {
  /** OrganizationModule row id (subscription record). */
  id: string;
  moduleId: string;
  /** Module code from the platform catalogue, e.g. GOVERNANCE, RISK_MANAGEMENT. */
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
  enabled: boolean;
  enabledAt?: string | null;
  disabledAt?: string | null;
}

type OrganizationModuleDto = {
  id?: string;
  moduleId?: string;
  code?: string;
  name?: string;
  description?: string;
  sortOrder?: number;
  enabled?: boolean;
  isEnabled?: boolean;
  enabledAt?: string | null;
  disabledAt?: string | null;
};

type OrganizationModulesResponse =
  | OrganizationModuleDto[]
  | { modules?: OrganizationModuleDto[]; data?: OrganizationModuleDto[]; items?: OrganizationModuleDto[] };

/** Platform catalogue codes → static MODULES ids used across the UI. */
const CODE_TO_MODULE_ID: Record<string, string> = {
  CORE: "dashboard",
  REPORTING: "dashboard",
  USER_MANAGEMENT: "settings",
  GOVERNANCE: "governance",
  RISK_MANAGEMENT: "risk",
  COMPLIANCE: "compliance",
  DATA_PROTECTION: "data",
  RESILIENCE: "resilience",
  CYBER_RISK: "cyber",
};

const responseModules = (payload: OrganizationModulesResponse): OrganizationModuleDto[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.modules)) return payload.modules;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
};

export const toStaticModuleId = (code?: string): string | null =>
  code ? (CODE_TO_MODULE_ID[code.toUpperCase()] ?? null) : null;

/** True when the module (or one derived from its code) is enabled. */
const enabledFlag = (module: OrganizationModuleDto): boolean =>
  module.enabled ?? module.isEnabled ?? false;

/**
 * Fetches every module subscribed by the organization, disabled ones included,
 * each mapped to the static MODULES catalogue entry when known.
 */
export async function fetchOrganizationModules(
  organizationId: string,
): Promise<OrganizationModuleStatus[]> {
  const { data } = await api.get<OrganizationModulesResponse>(
    `/v1/organizations/${organizationId}/modules`,
  );

  return responseModules(data)
    .map((module) => ({
      id: module.id ?? module.moduleId ?? module.code ?? "",
      moduleId: module.moduleId ?? "",
      code: module.code ?? "",
      name: module.name ?? module.code ?? "Module",
      description: module.description,
      sortOrder: module.sortOrder,
      enabled: enabledFlag(module),
      enabledAt: module.enabledAt ?? null,
      disabledAt: module.disabledAt ?? null,
    }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Pure mapping from subscription rows to the static MODULES catalogue, in dashboard order. */
export function toEnabledModules(rows: OrganizationModuleStatus[]): ModuleDef[] {
  const enabledIds = new Set(
    rows.filter((row) => row.enabled).map((row) => toStaticModuleId(row.code)),
  );
  return MODULES.filter((module) => enabledIds.has(module.id));
}

/** Modules currently enabled for the organization, in dashboard order. */
export async function getOrganizationEnabledModules(
  organizationId: string,
): Promise<ModuleDef[]> {
  return toEnabledModules(await fetchOrganizationModules(organizationId));
}

/** Fake per-module enable map so callers can render fallback states server-agnostically. */
export function toEnabledMap(rows: OrganizationModuleStatus[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const row of rows) {
    const staticId = toStaticModuleId(row.code);
    if (staticId) map[staticId] = row.enabled;
  }
  return map;
}

