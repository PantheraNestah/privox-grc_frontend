/**
 * Placeholder permission data.
 * There is no backend endpoint for permissions yet — once one exists, replace
 * this with a real fetch in src/lib/organization.ts. Creation/edits/deletion
 * made against this data in the UI are local-only and not persisted.
 */

export interface MockPermission {
  key: string;
  description: string;
}

export const DEFAULT_PERMISSIONS: MockPermission[] = [
  { key: "user.view", description: "View organisation members" },
  { key: "user.manage", description: "Add, remove and manage organisation members" },
  { key: "group.view", description: "View groups and their members" },
  { key: "group.manage", description: "Create, edit, delete groups and manage their membership" },
  { key: "organization.view", description: "View organisation details" },
  { key: "organization.manage", description: "Manage organisation settings" },
  { key: "governance.view", description: "View governance records" },
  { key: "governance.manage", description: "Manage governance policies and decisions" },
  { key: "risk.view", description: "View the risk register" },
  { key: "risk.manage", description: "Create, assess and treat risks" },
  { key: "compliance.view", description: "View compliance records" },
  { key: "compliance.manage", description: "Manage compliance frameworks and audits" },
];

const VIEW_ONLY_KEYS = ["user.view", "group.view", "organization.view", "governance.view"];

const ROLE_PERMISSIONS: { match: RegExp; permissions: string[] }[] = [
  {
    match: /admin/i,
    permissions: ["user.manage", "group.manage", "organization.manage", "governance.manage"],
  },
  {
    match: /view/i,
    permissions: VIEW_ONLY_KEYS,
  },
];

export function mockPermissionsForGroup(groupName: string): string[] {
  const matched = ROLE_PERMISSIONS.find((r) => r.match.test(groupName));
  return matched ? matched.permissions : VIEW_ONLY_KEYS;
}
