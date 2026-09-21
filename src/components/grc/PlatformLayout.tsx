import { useNavigate } from "react-router-dom";
import { Building2, LayoutDashboard, Layers, LogOut, Network, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/grc/shell/AppLayout";
import { AppTopNav, type Notification } from "@/components/grc/shell/AppTopNav";
import { UserCard } from "@/components/grc/shell/UserCard";
import type { NavGroup } from "@/components/grc/shell/nav";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Console",
    items: [
      { label: "Overview", href: "/platform/dashboard", icon: LayoutDashboard },
      { label: "Organizations", href: "/platform/organizations", icon: Building2 },
      { label: "Modules", href: "/platform/modules", icon: Layers },
      { label: "Templates", href: "/platform/templates", icon: Network },
    ],
  },
];

const NOTIFICATIONS: Notification[] = [
  { id: "p1", text: "Organisation awaiting validation — ", highlight: "G & Nestahs Co.", meta: "Onboarding · 5 min ago", dot: "warn", unread: true },
  { id: "p2", text: "Module assignment changed — ", highlight: "RESILIENCE disabled", meta: "Modules · 1 hr ago", dot: "info", unread: true },
  { id: "p3", text: "Organisation onboarded — ", highlight: "Savanna Insurance Co.", meta: "Onboarding · Yesterday", dot: "ok", unread: false },
];

/** Chrome for the platform-admin portal (see `AppLayout` for the shared shell). */
export function PlatformLayout() {
  const navigate = useNavigate();
  const { user, permissions, logout } = usePlatformAuth();

  const name = user?.fullName?.trim() || "Platform Admin";
  const detail = `${permissions.length} permission${permissions.length === 1 ? "" : "s"}`;
  const signOut = async () => {
    await logout();
    navigate("/platform/login");
  };

  return (
    <AppLayout
      storageKey="platform.sidebar.collapsed"
      groups={NAV_GROUPS}
      drawerSubtitle="Platform administration"
      topNav={(openMenu) => (
        <AppTopNav
          onOpenMenu={openMenu}
          homeHref="/platform/dashboard"
          chip={
            <Badge
              variant="outline"
              className="gap-1.5 border-white/15 bg-white/10 py-1 text-[11px] font-medium text-sky"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Platform Admin
            </Badge>
          }
          notifications={NOTIFICATIONS}
          notificationsTitle="Platform activity"
          user={{ name, email: user?.email, detail }}
          onSignOut={signOut}
        />
      )}
      sidebarFooter={(collapsed) => <UserCard name={name} detail={detail} collapsed={collapsed} />}
      drawerFooter={() => (
        <>
          <UserCard name={name} detail={detail} />
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </>
      )}
    />
  );
}
