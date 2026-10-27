/**
 * Presentation helpers for organization cards.
 *
 * The picker and the header switcher must never show raw permission or module
 * codes, so every code that reaches the UI goes through here first.
 */

import { MODULES } from "@/data/modules";
import { toStaticModuleId } from "@/lib/organizationModules";
import type { OrganizationOptionDto } from "@/lib/auth-types";

const LAST_ORGANIZATION_KEY = "grc_last_organization";

export const SELECTION_EXPIRED_MESSAGE =
  "Your organization selection expired. Please sign in again.";

export const ORGANIZATION_ACCESS_LOST_MESSAGE =
  "You no longer have access to this organization.";

/** Backend group codes → human labels. Unknown codes are title-cased. */
const GROUP_LABELS: Record<string, string> = {
  ORG_ADMIN: "Organization Admin",
  ORGANIZATION_ADMIN: "Organization Admin",
  ORG_MEMBER: "Organization Member",
  ORGANIZATION_MEMBER: "Organization Member",
  GOVERNANCE_APPROVER: "Governance Approver",
  GOVERNANCE_CONTRIBUTOR: "Governance Contributor",
  RISK_APPROVER: "Risk Approver",
  RISK_CONTRIBUTOR: "Risk Contributor",
  READ_ONLY: "Read Only",
  VIEWER: "Viewer",
};

const titleCase = (value: string): string =>
  value
    .replace(/[._-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

/** `GNC_ORG_ADMIN` → "Organization Admin"; unmapped codes are title-cased. */
export function formatGroupLabel(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return "";
  if (GROUP_LABELS[normalized]) return GROUP_LABELS[normalized];

  const withoutOrgPrefix = normalized.replace(/^[A-Z0-9]{2,6}_/, "");
  if (GROUP_LABELS[withoutOrgPrefix]) return GROUP_LABELS[withoutOrgPrefix];

  return titleCase(normalized);
}

/** `RISK_MANAGEMENT` → "Risk Management"; unknown codes are title-cased. */
export function formatModuleLabel(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return "";

  const staticId = toStaticModuleId(normalized);
  const known = MODULES.find((module) => module.id === staticId);
  return known?.name ?? titleCase(normalized);
}

/** De-duplicated, readable group labels (never raw codes). */
export function toGroupLabels(groups?: string[] | null): string[] {
  return [...new Set((groups ?? []).map(formatGroupLabel).filter(Boolean))];
}

/** De-duplicated, readable module labels (never raw codes). */
export function toModuleLabels(modules?: string[] | null): string[] {
  return [...new Set((modules ?? []).map(formatModuleLabel).filter(Boolean))];
}

/**
 * "Last used 5 min ago". Callers pass a fixed `now` in tests for determinism.
 * Missing/invalid timestamps render nothing.
 */
export function formatLastUsed(
  value: string | undefined | null,
  now = Date.now(),
): string {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 60) return "Last used just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Last used ${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Last used ${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `Last used ${days} day${days === 1 ? "" : "s"} ago`;

  return `Last used ${new Date(then).toLocaleDateString()}`;
}

/** The most recently used organization, used to highlight a picker card. */
export function mostRecentlyUsed(
  organizations: OrganizationOptionDto[],
): OrganizationOptionDto | undefined {
  return organizations.reduce<OrganizationOptionDto | undefined>((latest, org) => {
    if (!org.lastUsedAt) return latest;
    const time = new Date(org.lastUsedAt).getTime();
    if (Number.isNaN(time)) return latest;
    if (!latest?.lastUsedAt) return org;
    return time > new Date(latest.lastUsedAt).getTime() ? org : latest;
  }, undefined);
}

export interface RememberedOrganization {
  id: string;
  name: string;
  code: string;
}

/**
 * Non-secret hint for the picker's "Welcome back" subtitle. It never
 * auto-selects an organization: multi-org users asked to choose every time.
 */
export function rememberLastOrganization(org: Pick<OrganizationOptionDto, "id" | "name" | "code">) {
  try {
    const value: RememberedOrganization = { id: org.id, name: org.name, code: org.code };
    localStorage.setItem(LAST_ORGANIZATION_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the picker then has no hint.
  }
}

export function getLastOrganization(): RememberedOrganization | null {
  try {
    const raw = localStorage.getItem(LAST_ORGANIZATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedOrganization>;
    return parsed.id && parsed.name && parsed.code
      ? { id: parsed.id, name: parsed.name, code: parsed.code }
      : null;
  } catch {
    return null;
  }
}

export function clearLastOrganization() {
  try {
    localStorage.removeItem(LAST_ORGANIZATION_KEY);
  } catch {
    // ignore
  }
}
