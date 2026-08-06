import { Link, useLocation, useSearchParams } from "react-router-dom";
import { LayoutDashboard, Layers, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type UserManagementSection = "dashboard" | "users" | "groups" | "permissions";

const items: { value: UserManagementSection; label: string; icon: typeof LayoutDashboard }[] = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "users", label: "Users", icon: Users },
  { value: "groups", label: "Groups", icon: Layers },
  { value: "permissions", label: "Permissions", icon: ShieldCheck },
];

export function useUserManagementSection(): UserManagementSection {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");

  if (location.pathname.startsWith("/settings/users/members")) return "users";
  if (location.pathname.startsWith("/settings/users/groups")) return "groups";
  if (tab === "groups") return "groups";
  if (tab === "permissions") return "permissions";
  if (tab === "users") return "users";
  return "dashboard";
}

function sectionHref(section: UserManagementSection) {
  return section === "dashboard" ? "/settings/users" : `/settings/users?tab=${section}`;
}

export function UserManagementSidebar() {
  const activeSection = useUserManagementSection();

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-blue-50/40 px-3 py-6">
      {items.map(({ value, label, icon: Icon }) => {
        const isActive = activeSection === value;
        return (
          <Link
            key={value}
            to={sectionHref(value)}
            className={cn(
              "flex items-center gap-2.5 rounded-md border-l-4 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-blue-600 bg-blue-100 text-blue-600"
                : "border-transparent text-black hover:bg-blue-100/60 hover:text-blue-600",
            )}
          >
            <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-blue-600" : "text-black")} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}

export { items as userManagementSidebarItems, sectionHref as userManagementSectionHref };
