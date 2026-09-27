/**
 * Local permission catalogue mirroring the backend's streamlined V3 model.
 *
 * The authoritative catalogue is served by `GET /v1/permissions`; this module
 * remains as a static fallback/reference for offline UI affordances and
 * mirrors the same 5 tenant permissions.
 */

export interface MockPermission {
  key: string;
  description: string;
}

export const DEFAULT_PERMISSIONS: MockPermission[] = [
  {
    key: "organization.manage",
    description:
      "Full management of organization profile, user management, access groups, invitations, and settings",
  },
  {
    key: "orgnode.contribute",
    description: "Create drafts and edit organizational tree nodes",
  },
  {
    key: "orgnode.approve",
    description: "Approve organizational node structure modifications, moves, and deletions",
  },
  {
    key: "strategy.contribute",
    description:
      "Draft risk strategy versions, appetite bands, strategy formulation elements, and progress metrics",
  },
  {
    key: "strategy.approve",
    description: "Review, approve, reject, or publish risk strategies and strategy formulation elements",
  },
];

/** Contribution permissions shared by the Governance contributor blueprint. */
const CONTRIBUTOR_KEYS = ["orgnode.contribute", "strategy.contribute"];

/** Approval permissions shared by the Governance approver blueprint. */
const APPROVER_KEYS = ["orgnode.approve", "strategy.approve"];

const ROLE_PERMISSIONS: { match: RegExp; permissions: string[] }[] = [
  {
    match: /admin/i,
    permissions: ["organization.manage"],
  },
  {
    match: /approv/i,
    permissions: APPROVER_KEYS,
  },
  {
    match: /contribut|input|editor/i,
    permissions: CONTRIBUTOR_KEYS,
  },
];

/**
 * Best-effort static mapping of a group name to its likely permission codes.
 * Deferred to the authoritative `GET /v1/permissions` + group detail endpoints
 * wherever possible.
 */
export function mockPermissionsForGroup(groupName: string): string[] {
  const matched = ROLE_PERMISSIONS.find((r) => r.match.test(groupName));
  return matched ? matched.permissions : [];
}
