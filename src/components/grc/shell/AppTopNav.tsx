import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Logo, BrandName } from "@/components/grc/Logo";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Notification {
  id: string;
  text: string;
  highlight: string;
  meta: string;
  dot: "err" | "ok" | "warn" | "info";
  unread: boolean;
}

const dotClass: Record<Notification["dot"], string> = {
  err: "bg-destructive",
  ok: "bg-success",
  warn: "bg-warn",
  info: "bg-brand-accent",
};

const glassButton =
  "h-9 w-9 rounded-lg border border-white/10 bg-white/[0.07] text-sky hover:bg-white/15 hover:text-white";

interface AppTopNavProps {
  onOpenMenu: () => void;
  homeHref: string;
  /** Context chip beside the brand (organization, "Platform Admin"…). Hidden below `lg`. */
  chip?: ReactNode;
  notifications: Notification[];
  notificationsTitle: string;
  user: { name: string; email?: string; detail?: string };
  onSignOut: () => void | Promise<void>;
}

/**
 * Shared navy top bar for both portals, built from shadcn primitives: Popover
 * (activity), DropdownMenu (account) and a hamburger that opens the drawer.
 */
export function AppTopNav({
  onOpenMenu,
  homeHref,
  chip,
  notifications: initial,
  notificationsTitle,
  user,
  onSignOut,
}: AppTopNavProps) {
  const [notifs, setNotifs] = useState(initial);
  const unreadCount = notifs.filter((n) => n.unread).length;
  const markRead = (id: string) =>
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  const markAll = () => setNotifs((prev) => prev.map((n) => ({ ...n, unread: false })));

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 bg-navy-deep px-3 text-white shadow-nav sm:gap-3 sm:px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className={cn(glassButton, "md:hidden")}
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Link to={homeHref} className="flex min-w-0 items-center gap-2.5">
        <Logo size={28} className="shrink-0" />
        <BrandName className="truncate text-lg font-semibold tracking-tight sm:text-xl" />
      </Link>

      {chip && <div className="ml-1 hidden min-w-0 lg:block">{chip}</div>}

      <div className="flex-1" />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={cn(glassButton, "relative")} aria-label="Notifications">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-navy-deep bg-destructive" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-navy-deep">{notificationsTitle}</span>
            <button onClick={markAll} className="text-xs font-medium text-brand-accent hover:text-navy">
              Mark all read
            </button>
          </div>
          <Separator />
          <div className="max-h-[360px] overflow-y-auto">
            {notifs.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition last:border-0 hover:bg-offwhite",
                  n.unread && "bg-brand-accent/[0.05]",
                )}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotClass[n.dot])} />
                <div>
                  <div className="text-[13px] leading-snug text-navy-dark">
                    {n.text}
                    {n.highlight && <strong className="font-semibold">{n.highlight}</strong>}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-brand-muted">{n.meta}</div>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.07] pl-1 pr-2 text-sm text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:pr-3"
            aria-label="Account menu"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-brand-accent text-[11px] font-semibold text-white">
                {initials(user.name, "U")}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[9rem] truncate font-medium md:inline">{user.name}</span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-sky sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="space-y-0.5 font-normal">
            <p className="truncate text-sm font-semibold text-navy-deep">{user.name}</p>
            {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
            {user.detail && <p className="pt-1 text-[11px] text-muted-foreground">{user.detail}</p>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
            onSelect={() => void onSignOut()}
          >
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
