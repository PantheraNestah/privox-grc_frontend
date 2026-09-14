/** Small display helpers shared by the platform-admin pages. */

export function formatDateTime(value?: string | null, fallback = "—"): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
