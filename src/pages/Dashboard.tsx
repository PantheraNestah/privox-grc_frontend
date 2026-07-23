import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { TopNav } from "@/components/grc/TopNav";
import { ModuleCard } from "@/components/grc/ModuleCard";
import { QuickActionsPanel } from "@/components/grc/QuickActionsPanel";
import { MODULES } from "@/data/modules";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useActiveUser } from "@/hooks/use-active-user";
import type { ModuleDef } from "@/data/modules";
import type { QuickAction } from "@/data/quickActions";

const greetingFor = (h: number) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

const Dashboard = () => {
  const navigate = useNavigate();
  const activeUser = useActiveUser();
  const [openModule, setOpenModule] = useState<ModuleDef | null>(null);
  const [openAction, setOpenAction] = useState<QuickAction | null>(null);
  const [now, setNow] = useState(() => new Date());

  const handleModuleClick = (m: ModuleDef) => {
    if (m.id === "governance") {
      navigate("/governance");
      return;
    }
    if (m.id === "settings") {
      navigate("/settings/users");
      return;
    }
    setOpenModule(m);
  };

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const greeting = useMemo(() => greetingFor(now.getHours()), [now]);
  const dateStr = useMemo(
    () => now.toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    [now]
  );

  const handleAction = (a: QuickAction) => setOpenAction(a);
  const linkedModule = openAction?.moduleId ? MODULES.find(m => m.id === openAction.moduleId) : null;

  return (
    <>
      <Helmet>
        <title>Dashboard · Rsolve GRC Platform</title>
        <meta name="description" content="Unified Governance, Risk and Compliance workspace — modules, notifications and customisable quick actions." />
        <link rel="canonical" href="/dashboard" />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        <TopNav />

        <main className="flex-1 px-5 md:px-10 py-8 md:py-9">
          <header className="mb-8">
            <h1 className="text-[25px] font-semibold tracking-tight text-navy-deep">{greeting}, {activeUser?.name?.split(" ")[0] ?? "User"} 👋</h1>
            <p className="text-[13.5px] text-brand-muted mt-0.5">Here's your GRC platform overview for today.</p>
            <p className="text-[11px] text-brand-accent font-mono mt-1">{dateStr}</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-6 lg:gap-8">
            {/* Left: Modules */}
            <section>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-base font-semibold tracking-tight text-navy-deep">Modules</h2>
                <span className="text-xs text-brand-muted">Select a module to get started</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {MODULES.map((m, i) => (
                  <ModuleCard key={m.id} module={m} index={i} onClick={() => handleModuleClick(m)} />
                ))}
              </div>
            </section>

            {/* Right: Quick actions */}
            <QuickActionsPanel onActionClick={handleAction} />
          </div>
        </main>
      </div>

      {/* Module modal */}
      <Dialog open={!!openModule} onOpenChange={o => !o && setOpenModule(null)}>
        <DialogContent className="sm:max-w-[420px] text-center">
          {openModule && (
            <>
              <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                   style={{ background: `hsl(${openModule.color} / 0.12)` }}>
                <openModule.icon className="w-7 h-7" style={{ color: `hsl(${openModule.color})` }} strokeWidth={1.6} />
              </div>
              <DialogHeader>
                <DialogTitle className="text-center">{openModule.name}</DialogTitle>
                <DialogDescription className="text-center">
                  {openModule.desc}
                  <br /><br />
                  Full functionality will be available in the next release.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-center">
                <Button onClick={() => setOpenModule(null)} className="bg-navy-deep hover:bg-navy text-white">Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick action modal */}
      <Dialog open={!!openAction} onOpenChange={o => !o && setOpenAction(null)}>
        <DialogContent className="sm:max-w-[400px] text-center">
          {openAction && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">{openAction.title}</DialogTitle>
                <DialogDescription className="text-center">
                  {openAction.description || "Quick action triggered."}
                  {linkedModule && <><br /><br />Routing to <strong className="text-navy-dark">{linkedModule.name}</strong>…</>}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-center">
                <Button onClick={() => setOpenAction(null)} className="bg-navy-deep hover:bg-navy text-white">Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Dashboard;
