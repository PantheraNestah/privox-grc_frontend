/**
 * Breadcrumb roots shared by both portals, kept out of `PageHeader` so that
 * module exports only its component (see react-refresh/only-export-components).
 */

export const PLATFORM_HOME = { label: "Platform", to: "/platform/dashboard" };

/** Breadcrumb root for organization-workspace pages: `<PageHeader home={TENANT_HOME} …/>`. */
export const TENANT_HOME = { label: "Home", to: "/dashboard" };
