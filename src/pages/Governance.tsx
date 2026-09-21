import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModuleCard } from "@/components/grc/ModuleCard";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { GOVERNANCE_MODULES } from "@/data/governanceModules";
import type { ModuleDef } from "@/data/modules";

const MODULE_ROUTES: Record<string, string> = {
  "risk-governance": "/governance/risk-governance",
  "strategy-formulation": "/governance/strategy-formulation",
  "strategy-assessment": "/governance/strategy-assessment",
  "risk-strategy": "/governance/risk-strategy",
  documents: "/governance/documents",
  surveys: "/governance/surveys",
};

const Governance = () => {
  const navigate = useNavigate();
  const [openModule, setOpenModule] = useState<ModuleDef | null>(null);

  const handleClick = (m: ModuleDef) => {
    const route = MODULE_ROUTES[m.id];
    if (route) navigate(route);
    else setOpenModule(m);
  };

  return (
    <>
      <Helmet>
        <title>Governance Management · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Governance Management — document management, risk governance, strategy formulation and performance & risk strategy."
        />
        <link rel="canonical" href="/governance" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Governance Management" }]}
        title="Governance Management"
        description="Policies, frameworks, board decisions and organisational governance structures."
      />

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight text-navy-deep">Governance modules</h2>
          <span className="text-xs text-muted-foreground">Select a module to get started</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {GOVERNANCE_MODULES.map((m) => (
            <ModuleCard key={m.id} module={m} onClick={() => handleClick(m)} />
          ))}
        </div>
      </section>

      <Dialog open={!!openModule} onOpenChange={(o) => !o && setOpenModule(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[420px]">
          {openModule && (
            <>
              <span
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: `hsl(${openModule.color} / 0.12)` }}
              >
                <openModule.icon
                  className="h-7 w-7"
                  style={{ color: `hsl(${openModule.color})` }}
                  strokeWidth={1.6}
                />
              </span>
              <DialogHeader className="items-center text-center sm:text-center">
                <DialogTitle>{openModule.name}</DialogTitle>
                <DialogDescription>
                  {openModule.desc}
                  <br />
                  <br />
                  Full functionality will be available in the next release.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-center">
                <Button variant="brand" onClick={() => setOpenModule(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Governance;
