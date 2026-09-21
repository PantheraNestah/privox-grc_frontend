/** Small display helpers shared by the platform-admin pages. */

export function formatDateTime(value?: string | null, fallback = "—"): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/** Up to two initials for avatar tiles ("G & Nestahs Co." -> "GN"). */
export function initials(name?: string | null, fallback = "?"): string {
  const words = (name ?? "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length === 0) return fallback;
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
