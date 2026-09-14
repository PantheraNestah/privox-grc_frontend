import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, LayoutDashboard, Layers, Network } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type PlatformSection = "dashboard" | "organizations" | "modules" | "templates";

const items: { value: PlatformSection; label: string; href: string; icon: typeof LayoutDashboard }[] = [
  { value: "dashboard", label: "Overview", href: "/platform/dashboard", icon: LayoutDashboard },
  { value: "organizations", label: "Organizations", href: "/platform/organizations", icon: Building2 },
  { value: "modules", label: "Modules", href: "/platform/modules", icon: Layers },
  { value: "templates", label: "Templates", href: "/platform/templates", icon: Network },
];

export function usePlatformSection(): PlatformSection {
  const location = useLocation();
  if (location.pathname.startsWith("/platform/organizations")) return "organizations";
  if (location.pathname.startsWith("/platform/modules")) return "modules";
  if (location.pathname.startsWith("/platform/templates")) return "templates";
  return "dashboard";
}

/**
 * Platform-admin section navigation — same visual language as the tenant
 * `UserManagementSidebar`.
 */
export function PlatformSidebar() {
  const activeSection = usePlatformSection();

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-blue-50/40 px-3 py-6">
      {items.map(({ value, label, href, icon: Icon }) => {
        const isActive = activeSection === value;
        return (
          <Link
            key={value}
            to={href}
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

export { items as platformSidebarItems };

/**
 * Compact section switcher shown in place of the sidebar on small screens
 * (mirrors the tenant User Management mobile tabs).
 */
export function PlatformMobileTabs() {
  const navigate = useNavigate();
  const activeSection = usePlatformSection();

  return (
    <Tabs
      value={activeSection}
      onValueChange={(value) => {
        const target = items.find((item) => item.value === value);
        if (target) navigate(target.href);
      }}
      className="mb-4 md:hidden"
    >
      <TabsList className="w-full" aria-label="Platform section navigation">
        {items.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="flex-1 gap-1.5 text-black data-[state=active]:text-blue-600"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
