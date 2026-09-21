import type { OrganizationPermission } from "@/lib/auth-types";

export const FALLBACK_TEXT = "Unknown";

export function statusLabel(status?: string, active?: boolean) {
  if (typeof active === "boolean") return active ? "active" : "inactive";
  return status?.trim() || FALLBACK_TEXT;
}

export function isInactiveStatus(status?: string, active?: boolean) {
  if (typeof active === "boolean") return !active;
  const normalized = status?.toLowerCase() ?? "";
  return ["inactive", "deactivated", "disabled", "suspended", "revoked", "expired"].includes(normalized);
}

export function formatDate(value?: string) {
  if (!value) return FALLBACK_TEXT;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return FALLBACK_TEXT;
  return date.toLocaleDateString();
}

/** "Risk Owners" -> "RISK_OWNERS"; camelCase words are split first. */
export function deriveGroupCode(name: string) {
  return name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export type PermissionDisplay = string | OrganizationPermission;

export const permissionKey = (permission: PermissionDisplay) =>
  typeof permission === "string" ? permission : permission.id || permission.code;

export const permissionCode = (permission: PermissionDisplay) =>
  typeof permission === "string" ? permission : permission.code;

export const permissionName = (permission: PermissionDisplay) =>
  typeof permission === "string" ? permission : permission.name || permission.code;

export const permissionScope = (permission: PermissionDisplay) =>
  typeof permission === "string" ? "" : permission.scopeType;
