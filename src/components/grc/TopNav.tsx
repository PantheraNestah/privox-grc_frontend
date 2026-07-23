import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, LogOut, ChevronDown, UserCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo, BrandName } from "@/components/grc/Logo";
import { cn } from "@/lib/utils";
import { loadUsers, setActiveUserId, ROLE_LABELS, ROLE_COLORS, type AppUser } from "@/data/userStore";
import { useActiveUser } from "@/hooks/use-active-user";

interface Notif {
  id: string;
  text: string;
  highlight: string;
  meta: string;
  dot: "err" | "ok" | "warn" | "info";
  unread: boolean;
}

const initialNotifs: Notif[] = [
  { id: "n1", text: "Critical cyber incident logged — ", highlight: "Ransomware alert on NODE-04", meta: "Cyber Risk · 2 min ago",       dot: "err",  unread: true },
  { id: "n2", text: "Risk register updated — ",          highlight: "3 risks elevated to High",       meta: "Risk Management · 1 hr ago",  dot: "warn", unread: true },
  { id: "n3", text: "POPIA compliance audit completed — ",highlight: "Score: 94%",                    meta: "Compliance · 2 hrs ago",      dot: "ok",   unread: true },
  { id: "n4", text: "User ",                              highlight: "jane.smith@org.co.za",          meta: "Profile & Settings · Yesterday", dot: "info", unread: false },
  { id: "n5", text: "BCP for Finance unit approved and activated", highlight: "",                     meta: "Resilience · Yesterday",      dot: "ok",   unread: false },
  { id: "n6", text: "Data Protection Impact Assessment due in ", highlight: "3 days",                 meta: "Data Protection · 2 days ago",dot: "warn", unread: false },
];

const dotClass: Record<Notif["dot"], string> = {
  err: "bg-destructive",
  ok: "bg-success",
  warn: "bg-warn",
  info: "bg-brand-accent",
};

export const TopNav = () => {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notif[]>(initialNotifs);
  const [open, setOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const { logout } = useAuth();
  const wrapRef = useRef<HTMLDivElement>(null);
  const userWrapRef = useRef<HTMLDivElement>(null);
  const activeUser = useActiveUser();

  useEffect(() => {
    setUsers(loadUsers());
    const refresh = () => setUsers(loadUsers());
    window.addEventListener("rsolve:active-user-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("rsolve:active-user-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
      if (userWrapRef.current && !userWrapRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const unreadCount = notifs.filter(n => n.unread).length;
  const markRead = (id: string) => setNotifs(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  const markAll = () => setNotifs(prev => prev.map(n => ({ ...n, unread: false })));

  const initials = (activeUser?.name || "??")
    .split(" ").map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <nav className="sticky top-0 z-40 h-15 flex items-center gap-5 bg-navy-deep px-5 md:px-8 shadow-nav text-white" style={{ height: 60 }}>
      <div className="flex items-center gap-2.5 mr-auto">
        <Logo size={28} />
        <BrandName className="text-[22px] font-semibold tracking-tight" />
      </div>

      <div className="hidden md:flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-lg px-3.5 py-1.5 w-[250px]">
        <Search className="w-3.5 h-3.5 text-sky/60" />
        <input className="bg-transparent border-0 outline-none text-[13px] text-white placeholder:text-sky/55 w-full" placeholder="Search modules, records…" />
      </div>

      <div className="flex items-center gap-3.5">
        <div className="relative" ref={wrapRef}>
          <button
            onClick={() => setOpen(o => !o)}
            className="relative w-9 h-9 rounded-lg bg-white/[0.07] border border-white/10 flex items-center justify-center text-sky hover:bg-white/15 transition"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border-2 border-navy-deep" />}
          </button>

          {open && (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[360px] bg-white rounded-2xl border border-brand-accent/10 shadow-card-hover z-50 overflow-hidden text-foreground animate-drop-in">
              <div className="px-4.5 pt-4 pb-3 border-b border-surface flex justify-between items-center">
                <span className="text-sm font-semibold text-navy-deep">Recent Activity</span>
                <button onClick={markAll} className="text-xs font-medium text-brand-accent">Mark all read</button>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {notifs.map(n => (
                  <button key={n.id} onClick={() => markRead(n.id)}
                    className={cn(
                      "w-full text-left flex items-start gap-3 px-4.5 py-3 border-b border-surface last:border-0 hover:bg-offwhite transition",
                      n.unread && "bg-brand-accent/[0.04]"
                    )}>
                    <span className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", dotClass[n.dot])} />
                    <div>
                      <div className="text-[13px] text-navy-dark leading-snug mb-0.5">
                        {n.text}{n.highlight && <strong className="font-semibold">{n.highlight}</strong>}
                      </div>
                      <div className="text-[11px] text-brand-muted font-mono">{n.meta}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={userWrapRef}>
          <button
            onClick={() => setUserOpen(o => !o)}
            className="hidden sm:flex items-center gap-2.5 bg-white/[0.07] border border-white/10 rounded-[9px] py-1 pl-1.5 pr-2.5 cursor-pointer hover:bg-white/15 transition"
            aria-label="Switch active user"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                 style={{ background: `linear-gradient(135deg, hsl(${ROLE_COLORS[activeUser?.role ?? "admin"]}), hsl(var(--sky)))` }}>
              {initials}
            </div>
            <div className="text-left">
              <div className="text-[13px] font-semibold leading-tight">{activeUser?.name ?? "—"}</div>
              <div className="text-[10px] text-sky font-mono">{ROLE_LABELS[activeUser?.role ?? "admin"]}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-sky/70" />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] w-[300px] bg-white rounded-2xl border border-brand-accent/10 shadow-card-hover z-50 overflow-hidden text-foreground animate-drop-in">
              <div className="px-4 pt-3 pb-2 border-b border-surface">
                <p className="text-[11px] uppercase tracking-wider text-brand-muted font-semibold">Switch active user</p>
                <p className="text-[11px] text-brand-muted">Prototype role preview</p>
              </div>
              <div className="max-h-[300px] overflow-y-auto py-1">
                {users.map(u => {
                  const active = u.id === activeUser?.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => { setActiveUserId(u.id); setUserOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-offwhite transition",
                        active && "bg-brand-accent/[0.06]"
                      )}
                    >
                      <UserCircle2 className="w-7 h-7 shrink-0" style={{ color: `hsl(${ROLE_COLORS[u.role]})` }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-navy-deep truncate">{u.name || u.email}</div>
                        <div className="text-[10px] text-brand-muted font-mono">{ROLE_LABELS[u.role]}</div>
                      </div>
                      {active && <span className="text-[10px] text-brand-accent font-semibold">ACTIVE</span>}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-surface px-4 py-2">
                <button
                  onClick={() => { setUserOpen(false); navigate("/settings/users"); }}
                  className="w-full text-[12px] text-brand-accent font-medium hover:underline text-left"
                >
                  Manage users →
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => { logout(); navigate("/"); }}
          className="flex items-center gap-1.5 border border-destructive/35 text-destructive/80 rounded-lg px-3 py-1.5 text-[12.5px] font-medium hover:bg-destructive/10 hover:border-destructive/60 hover:text-destructive transition"
        >
          <LogOut className="w-3.5 h-3.5" /> Log out
        </button>
      </div>
    </nav>
  );
};
