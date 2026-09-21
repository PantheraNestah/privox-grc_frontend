import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FileText,
  Landmark,
  LayoutDashboard,
  Layers,
  LineChart,
  LogOut,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/grc/shell/AppLayout";
import { AppTopNav, type Notification } from "@/components/grc/shell/AppTopNav";
import { UserCard } from "@/components/grc/shell/UserCard";
import type { NavGroup } from "@/components/grc/shell/nav";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/use-organization-modules";

const NOTIFICATIONS: Notification[] = [
  { id: "n1", text: "Critical cyber incident logged — ", highlight: "Ransomware alert on NODE-04", meta: "Cyber Risk · 2 min ago", dot: "err", unread: true },
  { id: "n2", text: "Risk register updated — ", highlight: "3 risks elevated to High", meta: "Risk Management · 1 hr ago", dot: "warn", unread: true },
  { id: "n3", text: "POPIA compliance audit completed — ", highlight: "Score: 94%", meta: "Compliance · 2 hrs ago", dot: "ok", unread: true },
  { id: "n4", text: "User ", highlight: "jane.smith@org.co.za", meta: "Profile & Settings · Yesterday", dot: "info", unread: false },
  { id: "n5", text: "BCP for Finance unit approved and activated", highlight: "", meta: "Resilience · Yesterday", dot: "ok", unread: false },
  { id: "n6", text: "Data Protection Impact Assessment due in ", highlight: "3 days", meta: "Data Protection · 2 days ago", dot: "warn", unread: false },
];

/** Static ids match `MODULES` in `@/data/modules` (see `toStaticModuleId`). */
const GOVERNANCE_ITEMS = [
  { label: "Overview", href: "/governance", icon: Landmark, end: true },
  { label: "Risk Governance", href: "/governance/risk-governance", icon: ShieldAlert },
  { label: "Strategy Formulation", href: "/governance/strategy-formulation", icon: Compass },
  { label: "Strategy Assessment", href: "/governance/strategy-assessment", icon: ClipboardCheck },
  { label: "Risk Strategy", href: "/governance/risk-strategy", icon: LineChart },
  { label: "Documents", href: "/governance/documents", icon: FileText },
  { label: "Surveys", href: "/governance/surveys", icon: ClipboardList },
];

/** Chrome for the organization workspace (see `AppLayout` for the shared shell). */
export function TenantLayout() {
  const navigate = useNavigate();
  const { user, organization, logout } = useAuth();
  const { isModuleEnabled } = useModuleAccess(organization?.id);

  const governanceEnabled = isModuleEnabled("governance");
  const usersEnabled = isModuleEnabled("settings");

  const groups = useMemo<NavGroup[]>(
    () => [
      { items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, end: true }] },
      ...(governanceEnabled ? [{ label: "Governance", items: GOVERNANCE_ITEMS }] : []),
      {
        label: "Settings",
        items: [
          { label: "Organization", href: "/settings/organization", icon: Building2 },
          { label: "Modules", href: "/settings/modules", icon: Layers },
          ...(usersEnabled ? [{ label: "Users", href: "/settings/users", icon: Users }] : []),
        ],
      },
    ],
    [governanceEnabled, usersEnabled],
  );

  const name = user?.fullName?.trim() || "Account";
  const orgLabel = organization?.name?.trim() || organization?.code?.trim() || "Organization";
  const signOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <AppLayout
      storageKey="tenant.sidebar.collapsed"
      groups={groups}
      drawerSubtitle={orgLabel}
      topNav={(openMenu) => (
        <AppTopNav
          onOpenMenu={openMenu}
          homeHref="/dashboard"
          chip={
            organization?.id && (
              <Link
                to="/settings/organization"
                title="View organization details"
                className="inline-flex max-w-[280px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.07] px-2.5 py-1.5 text-xs font-medium text-sky transition hover:bg-white/15 hover:text-white"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{orgLabel}</span>
              </Link>
            )
          }
          notifications={NOTIFICATIONS}
          notificationsTitle="Notifications"
          user={{ name, email: user?.email, detail: orgLabel }}
          onSignOut={signOut}
        />
      )}
      sidebarFooter={(collapsed) => <UserCard name={name} detail={orgLabel} collapsed={collapsed} />}
      drawerFooter={() => (
        <>
          <UserCard name={name} detail={orgLabel} />
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
