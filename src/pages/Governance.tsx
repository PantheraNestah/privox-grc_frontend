import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { ModuleCard } from "@/components/grc/ModuleCard";
import { GOVERNANCE_MODULES } from "@/data/governanceModules";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ModuleDef } from "@/data/modules";

const MODULE_ROUTES: Record<string, string> = {
  "risk-governance": "/governance/risk-governance",
  "strategy-formulation": "/governance/strategy-formulation",
  "strategy-assessment": "/governance/strategy-assessment",
  "risk-strategy": "/governance/risk-strategy",
  "documents": "/governance/documents",
  "surveys": "/governance/surveys",
};

const Governance = () => {
  const navigate = useNavigate();
  const [openModule, setOpenModule] = useState<ModuleDef | null>(null);

  const handleClick = (m: ModuleDef) => {
    const route = MODULE_ROUTES[m.id];
    if (route) {
      navigate(route);
      return;
    }
    setOpenModule(m);
  };

  return (
    <>
      <Helmet>
        <title>Governance Management · Rsolve GRC Platform</title>
        <meta name="description" content="Governance Management — document management, risk governance, strategy formulation and performance & risk strategy." />
        <link rel="canonical" href="/governance" />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        <TopNav />

        <main className="flex-1 px-5 md:px-10 py-8 md:py-9">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-brand-muted mb-4">
            <Link to="/dashboard" className="hover:text-navy-deep transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-navy-deep font-medium">Governance Management</span>
          </nav>

          <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[25px] font-semibold tracking-tight text-navy-deep">Governance Management</h1>
              <p className="text-[13.5px] text-brand-muted mt-0.5">
                Policies, frameworks, board decisions and organisational governance structures.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="border-brand-accent/30 text-navy-deep">
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Dashboard
              </Link>
            </Button>
          </header>

          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-base font-semibold tracking-tight text-navy-deep">Governance Modules</h2>
              <span className="text-xs text-brand-muted">Select a module to get started</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {GOVERNANCE_MODULES.map((m, i) => (
                <ModuleCard key={m.id} module={m} index={i} onClick={() => handleClick(m)} />
              ))}
            </div>
          </section>
        </main>
      </div>

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
    </>
  );
};

export default Governance;
