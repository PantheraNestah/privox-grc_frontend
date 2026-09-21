import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match only the exact path (for overview pages that share a prefix with children). */
  end?: boolean;
  /** Extra path prefixes that should also mark this item active. */
  match?: string[];
}

export interface NavGroup {
  /** Small heading above the group; hidden when the sidebar is collapsed. */
  label?: string;
  items: NavItem[];
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return [item.href, ...(item.match ?? [])].some((prefix) =>
    item.end ? pathname === prefix : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
