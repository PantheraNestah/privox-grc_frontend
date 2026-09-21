import { useEffect, useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { AppMobileNav } from "./AppMobileNav";
import { AppSidebar } from "./AppSidebar";
import type { NavGroup } from "./nav";

function initialCollapsed(storageKey: string): boolean {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) return stored === "true";
  } catch {
    // Storage unavailable; fall back to the viewport default.
  }
  return typeof window !== "undefined" && window.innerWidth < 1024;
}

interface AppLayoutProps {
  /** localStorage key remembering whether the sidebar is collapsed. */
  storageKey: string;
  groups: NavGroup[];
  topNav: (openMenu: () => void) => ReactNode;
  sidebarFooter?: (collapsed: boolean) => ReactNode;
  drawerSubtitle: string;
  drawerFooter?: (close: () => void) => ReactNode;
}

/**
 * Page chrome shared by the tenant and platform-admin portals: sticky top bar,
 * a collapsible sidebar (remembered per portal) and a drawer on phones. Routed
 * pages render inside the `<Outlet />`.
 */
export function AppLayout({
  storageKey,
  groups,
  topNav,
  sidebarFooter,
  drawerSubtitle,
  drawerFooter,
}: AppLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => initialCollapsed(storageKey));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(collapsed));
    } catch {
      // Non-fatal: the preference just won't persist.
    }
  }, [collapsed, storageKey]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {topNav(() => setMobileNavOpen(true))}
      <div className="flex flex-1">
        <AppSidebar
          groups={groups}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          footer={sidebarFooter}
        />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <AppMobileNav
        groups={groups}
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        subtitle={drawerSubtitle}
        footer={drawerFooter}
      />
    </div>
  );
}
