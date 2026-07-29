import { api } from "@/lib/api";
import { MODULES, type ModuleDef } from "@/data/modules";

type OrganizationModuleDto = {
  id?: string;
  moduleId?: string;
  key?: string;
  code?: string;
  slug?: string;
  name?: string;
  moduleName?: string;
  enabled?: boolean;
  isEnabled?: boolean;
  status?: string;
};

type OrganizationModulesResponse =
  | OrganizationModuleDto[]
  | {
      modules?: OrganizationModuleDto[];
      data?: OrganizationModuleDto[] | { modules?: OrganizationModuleDto[] };
      items?: OrganizationModuleDto[];
    };

const MODULE_ALIASES: Record<string, string> = {
  dashboard: "dashboard",
  dashboardreporting: "dashboard",
  reporting: "dashboard",
  governancemanagement: "governance",
  governance: "governance",
  riskmanagement: "risk",
  risk: "risk",
  compliancemanagement: "compliance",
  compliance: "compliance",
  dataprotectionmanagement: "data",
  dataprotection: "data",
  data: "data",
  resiliencemanagement: "resilience",
  resilience: "resilience",
  cyberriskmanagement: "cyber",
  cyberrisk: "cyber",
  cyber: "cyber",
  usermanagement: "settings",
  users: "settings",
  settings: "settings",
};

const normalizeModuleKey = (value?: string) =>
  value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";

const enabledFlag = (module: OrganizationModuleDto) => {
  if (module.enabled === false || module.isEnabled === false) return false;
  if (module.status && ["disabled", "inactive"].includes(module.status.toLowerCase())) {
    return false;
  }
  return true;
};

const responseModules = (payload: OrganizationModulesResponse): OrganizationModuleDto[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.modules)) return payload.modules;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && !Array.isArray(payload.data) && Array.isArray(payload.data.modules)) {
    return payload.data.modules;
  }
  return [];
};

const toStaticModuleId = (module: OrganizationModuleDto) => {
  const candidates = [
    module.moduleId,
    module.id,
    module.key,
    module.code,
    module.slug,
    module.moduleName,
    module.name,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeModuleKey(candidate);
    if (!normalized) continue;

    const exact = MODULES.find((m) => normalizeModuleKey(m.id) === normalized);
    if (exact) return exact.id;

    const byName = MODULES.find((m) => normalizeModuleKey(m.name) === normalized);
    if (byName) return byName.id;

    const alias = MODULE_ALIASES[normalized];
    if (alias) return alias;
  }

  return null;
};

export async function getOrganizationEnabledModules(organizationId: string): Promise<ModuleDef[]> {
  const { data } = await api.get<OrganizationModulesResponse>(
    `/v1/organizations/${organizationId}/modules`,
  );

  const enabledIds = new Set(
    responseModules(data)
      .filter(enabledFlag)
      .map(toStaticModuleId)
      .filter((id): id is string => Boolean(id)),
  );

  return MODULES.filter((module) => enabledIds.has(module.id));
}
