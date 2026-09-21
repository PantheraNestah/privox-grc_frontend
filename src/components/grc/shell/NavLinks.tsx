import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isNavItemActive, type NavGroup } from "./nav";

interface NavLinksProps {
  groups: NavGroup[];
  /** Icon-only rail with tooltips. */
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NavLinks({ groups, collapsed = false, onNavigate }: NavLinksProps) {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Sections" className="space-y-4">
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="space-y-1">
          {group.label &&
            (collapsed ? (
              index > 0 && <div className="mx-3 mb-2 h-px bg-border" aria-hidden />
            ) : (
              <p className="px-3 pb-1 font-mono text-[10.5px] uppercase tracking-[0.15em] text-brand-muted">
                {group.label}
              </p>
            ))}
          {group.items.map((item) => {
            const active = isNavItemActive(item, pathname);
            const Icon = item.icon;
            const link = (
              <Link
                to={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  collapsed && "justify-center",
                  active
                    ? "bg-gradient-primary text-white shadow-button"
                    : "text-navy-dark hover:bg-brand-accent/10 hover:text-navy",
                )}
              >
                <Icon
                  className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-brand-accent")}
                  strokeWidth={1.8}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            return (
              <Fragment key={item.href}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )}
              </Fragment>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
