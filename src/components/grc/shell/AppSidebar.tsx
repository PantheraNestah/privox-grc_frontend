import { type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NavLinks } from "./NavLinks";
import type { NavGroup } from "./nav";

interface AppSidebarProps {
  groups: NavGroup[];
  collapsed: boolean;
  onToggle: () => void;
  /** Rendered at the bottom; receives the collapsed state. */
  footer?: (collapsed: boolean) => ReactNode;
}

/** Collapsible section sidebar (md and up); phones use `AppMobileNav`. */
export function AppSidebar({ groups, collapsed, onToggle, footer }: AppSidebarProps) {
  return (
    <aside
      className={cn(
        "sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      <div className="flex-1 overflow-y-auto p-3">
        <div className={cn("mb-3 flex items-center", collapsed ? "justify-center" : "justify-end")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-navy"
                onClick={onToggle}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!collapsed}
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
          </Tooltip>
        </div>
        <NavLinks groups={groups} collapsed={collapsed} />
      </div>
      {footer && <div className="p-3">{footer(collapsed)}</div>}
    </aside>
  );
}
