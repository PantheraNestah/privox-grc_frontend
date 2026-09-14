import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Search, ShieldCheck } from "lucide-react";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";
import { Logo, BrandName } from "@/components/grc/Logo";
import { cn } from "@/lib/utils";

interface Notif {
  id: string;
  text: string;
  highlight: string;
  meta: string;
  dot: "err" | "ok" | "warn" | "info";
  unread: boolean;
}

const initialNotifs: Notif[] = [
  { id: "p1", text: "Organisation awaiting validation — ", highlight: "G & Nestahs Co.", meta: "Onboarding · 5 min ago", dot: "warn", unread: true },
  { id: "p2", text: "Module assignment changed — ", highlight: "RESILIENCE disabled", meta: "Modules · 1 hr ago", dot: "info", unread: true },
  { id: "p3", text: "Organisation onboarded — ", highlight: "Savanna Insurance Co.", meta: "Onboarding · Yesterday", dot: "ok", unread: false },
];

const dotClass: Record<Notif["dot"], string> = {
  err: "bg-destructive",
  ok: "bg-success",
  warn: "bg-warn",
  info: "bg-brand-accent",
};

/**
 * Platform-admin chrome. Mirrors the tenant `TopNav` styling, but shows a
 * "Platform Admin" identity chip instead of an organization and sends sign-out
 * back to the platform login.
 */
export const PlatformTopNav = () => {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notif[]>(initialNotifs);
  const [open, setOpen] = useState(false);
  const { logout, user } = usePlatformAuth();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const unreadCount = notifs.filter((n) => n.unread).length;
  const markRead = (id: string) =>
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  const markAll = () => setNotifs((prev) => prev.map((n) => ({ ...n, unread: false })));

  const identity = user?.fullName?.trim() || "Platform Admin";

  return (
    <nav className="sticky top-0 z-40 flex min-h-16 items-center gap-3 bg-navy-deep px-4 py-3 shadow-nav text-white sm:gap-5 md:px-8">
      <div className="flex min-w-0 items-center gap-2.5 mr-auto">
        <Logo size={28} />
        <BrandName className="truncate text-xl font-semibold tracking-tight sm:text-2xl" />
        <button
          type="button"
          onClick={() => navigate("/platform/dashboard")}
          className="ml-1 inline-flex min-h-8 max-w-[34vw] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-sky transition hover:bg-white/15 hover:text-white sm:max-w-[210px] lg:max-w-[280px]"
          title={identity}
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Platform Admin</span>
        </button>
      </div>

      <div className="hidden md:flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-lg px-3.5 py-1.5 w-[250px]">
        <Search className="w-3.5 h-3.5 text-sky/60" />
        <input
          className="bg-transparent border-0 outline-none text-[13px] text-white placeholder:text-sky/55 w-full"
          placeholder="Search organisations, modules…"
        />
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3.5">
        <div className="relative" ref={wrapRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative w-9 h-9 rounded-lg bg-white/[0.07] border border-white/10 flex items-center justify-center text-sky hover:bg-white/15 transition"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border-2 border-navy-deep" />
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[calc(100vw-2rem)] max-w-[380px] bg-white rounded-lg border border-brand-accent/10 shadow-card-hover z-50 overflow-hidden text-foreground animate-drop-in">
              <div className="px-4.5 pt-4 pb-3 border-b border-surface flex justify-between items-center">
                <span className="text-sm font-semibold text-navy-deep">Platform Activity</span>
                <button onClick={markAll} className="text-xs font-medium text-brand-accent">
                  Mark all read
                </button>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {notifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={cn(
                      "w-full text-left flex items-start gap-3 px-4.5 py-3 border-b border-surface last:border-0 hover:bg-offwhite transition",
                      n.unread && "bg-brand-accent/[0.04]",
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", dotClass[n.dot])} />
                    <div>
                      <div className="text-[13px] text-navy-dark leading-snug mb-0.5">
                        {n.text}
                        {n.highlight && <strong className="font-semibold">{n.highlight}</strong>}
                      </div>
                      <div className="text-[11px] text-brand-muted font-mono">{n.meta}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={async () => {
            await logout();
            navigate("/platform/login");
          }}
          className="flex min-h-9 items-center gap-1.5 border border-destructive/35 text-destructive/80 rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-destructive/10 hover:border-destructive/60 hover:text-destructive transition sm:px-3"
        >
          <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Log out</span>
        </button>
      </div>
    </nav>
  );
};
