// Strategy Formulation.
//
// Tabs:
//   • Pillars                  — admin-only create/edit; everyone else sees a read-only catalogue
//   • Objectives & Initiatives — grouped by pillar, all users can add their own
//   • Activities & KPIs        — flat table across all visible initiatives
//   • Insights                 — read-only roll-up and drill-downs
//   • Log entry                — guided form to log Objective → Initiative → Activity → Outcome → KPI in one go
//
// Visibility: non-global users see only objectives linked to their org unit OR a descendant unit.
// Permissions: only Admin can create/edit pillars; ALL roles can build their own objectives/initiatives/etc.

import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  BarChart3,
  ClipboardCheck,
  Compass,
  FileEdit,
  Lock,
  Pencil,
  Table as TableIcon,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { FormulationInsights } from "@/components/grc/FormulationInsights";
import { StrategyEntryForm } from "@/components/grc/StrategyEntryForm";
import { ObjectiveDialog, InitiativeDialog, PillarDialog } from "@/components/grc/strategy/FormulationDialogs";
import { ActivitiesView, ObjectivesView, PillarsView } from "@/components/grc/strategy/FormulationViews";
import { filterByScope, groupByPillar, planTotals } from "@/components/grc/strategy/formulation-helpers";
import { getOrgDescendantChain, loadOrgNodes, type OrgNode } from "@/data/orgStore";
import {
  loadStrategy,
  newInitiative,
  newObjective,
  newPillar,
  saveStrategy,
  type Initiative,
  type StrategicObjective,
  type StrategicPillar,
  type StrategyConfig,
} from "@/data/strategyStore";
import { can, ROLE_LABELS } from "@/data/userStore";
import { useActiveUser } from "@/hooks/use-active-user";

type Tab = "pillars" | "objectives" | "activities" | "insights" | "log";

type ConfirmTarget = { kind: "pillar" | "objective" | "initiative"; id: string; parentId?: string };

const CONFIRM_COPY: Record<ConfirmTarget["kind"], string> = {
  pillar: "All objectives and initiatives under this pillar will also be removed.",
  objective: "All initiatives, activities, outcomes and KPIs under this objective will also be removed.",
  initiative: "All activities, outcomes and KPIs under this initiative will also be removed.",
};

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold leading-none text-navy-deep">{value}</p>
    </CardContent>
  </Card>
);

const StrategyFormulation = () => {
  const activeUser = useActiveUser();
  const canEditPillars = can.editPillars(activeUser.role);
  const canEditPlan = can.editStrategyPlan(activeUser.role);

  // Both stores are synchronous localStorage reads, so load them once up front.
  const [cfg, setCfg] = useState<StrategyConfig>(() => loadStrategy());
  const [orgNodes] = useState<OrgNode[]>(() => loadOrgNodes());
  const [tab, setTab] = useState<Tab>("pillars");

  const [pillarDialog, setPillarDialog] = useState<StrategicPillar | null>(null);
  const [objectiveDialog, setObjectiveDialog] = useState<{ obj: StrategicObjective; isNew: boolean } | null>(null);
  const [initiativeDialog, setInitiativeDialog] = useState<{ objId: string; init: Initiative; isNew: boolean } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget | null>(null);

  const persist = (next: StrategyConfig) => {
    setCfg(next);
    saveStrategy(next);
  };

  // Scope: non-global users see only their unit + descendants.
  const isGlobalViewer = can.viewAllScopes(activeUser.role);
  const scopeNodeIds = useMemo(
    () =>
      activeUser.orgNodeId
        ? new Set(getOrgDescendantChain(orgNodes, activeUser.orgNodeId).map((n) => n.id))
        : new Set<string>(),
    [orgNodes, activeUser.orgNodeId],
  );
  const visibleCfg = useMemo(() => filterByScope(cfg, isGlobalViewer, scopeNodeIds), [cfg, isGlobalViewer, scopeNodeIds]);
  const objectivesByPillar = useMemo(() => groupByPillar(visibleCfg.objectives), [visibleCfg.objectives]);
  const totals = useMemo(() => planTotals(visibleCfg.objectives), [visibleCfg.objectives]);

  // ---- Pillar actions ----
  const savePillar = (pillar: StrategicPillar) => {
    if (!pillar.name.trim()) {
      toast.error("Pillar name required");
      return;
    }
    const exists = cfg.pillars.some((p) => p.id === pillar.id);
    persist({
      ...cfg,
      pillars: exists ? cfg.pillars.map((p) => (p.id === pillar.id ? pillar : p)) : [...cfg.pillars, pillar],
    });
    setPillarDialog(null);
    toast.success(exists ? "Pillar updated" : "Pillar added");
  };

  // ---- Objective actions ----
  const saveObjective = (objective: StrategicObjective, isNew: boolean) => {
    if (!objective.title.trim()) {
      toast.error("Objective title required");
      return;
    }
    persist({
      ...cfg,
      objectives: isNew
        ? [...cfg.objectives, objective]
        : cfg.objectives.map((o) => (o.id === objective.id ? objective : o)),
    });
    setObjectiveDialog(null);
    toast.success(isNew ? "Objective added" : "Objective updated");
  };

  // ---- Initiative actions ----
  const saveInitiative = (objId: string, initiative: Initiative, isNew: boolean) => {
    if (!initiative.name.trim()) {
      toast.error("Initiative name required");
      return;
    }
    persist({
      ...cfg,
      objectives: cfg.objectives.map((o) =>
        o.id !== objId
          ? o
          : {
              ...o,
              initiatives: isNew
                ? [...o.initiatives, initiative]
                : o.initiatives.map((i) => (i.id === initiative.id ? initiative : i)),
            },
      ),
    });
    setInitiativeDialog(null);
    toast.success(isNew ? "Initiative added" : "Initiative updated");
  };

  const confirmDelete = () => {
    if (!confirm) return;
    if (confirm.kind === "pillar") {
      persist({
        pillars: cfg.pillars.filter((p) => p.id !== confirm.id),
        objectives: cfg.objectives.filter((o) => o.pillarId !== confirm.id),
      });
      toast.success("Pillar removed");
    } else if (confirm.kind === "objective") {
      persist({ ...cfg, objectives: cfg.objectives.filter((o) => o.id !== confirm.id) });
      toast.success("Objective removed");
    } else if (confirm.parentId) {
      persist({
        ...cfg,
        objectives: cfg.objectives.map((o) =>
          o.id !== confirm.parentId ? o : { ...o, initiatives: o.initiatives.filter((i) => i.id !== confirm.id) },
        ),
      });
      toast.success("Initiative removed");
    }
    setConfirm(null);
  };

  return (
    <>
      <Helmet>
        <title>Strategy Formulation · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Define strategic pillars, objectives, initiatives, activities, expected outcomes and KPIs."
        />
        <link rel="canonical" href="/governance/strategy-formulation" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Governance", to: "/governance" }, { label: "Strategy Formulation" }]}
        title="Strategy Formulation"
        description={
          <>
            <strong className="font-medium text-navy-deep">Plan setup.</strong> Build your strategy under the
            organisation's pillars: Objectives → Initiatives → Activities → Outcomes → KPIs. Self-assessment and
            approval happen in{" "}
            <Link to="/governance/strategy-assessment" className="text-brand-accent underline-offset-2 hover:underline">
              Strategy Performance Assessment
            </Link>
            .
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/governance/strategy-assessment">
                <ClipboardCheck /> Go to assessment
              </Link>
            </Button>
            <Button variant="brand" onClick={() => setTab("log")}>
              <FileEdit /> Log entry
            </Button>
          </>
        }
      />

      <Alert className="mb-6">
        <Lock className="h-4 w-4" />
        <AlertDescription>
          {isGlobalViewer ? (
            <>
              <strong className="font-medium text-navy-deep">{ROLE_LABELS[activeUser.role]} view —</strong> seeing the
              entire strategy across all organisation units.
            </>
          ) : activeUser.orgNodeId ? (
            <>
              <strong className="font-medium text-navy-deep">Scoped view —</strong> you only see strategy linked to{" "}
              <em>your unit or a unit below it</em>. Anything you log is auto-tagged to your unit.
            </>
          ) : (
            <span className="text-warn">
              <strong>No org unit linked to your profile —</strong> ask an Administrator to assign you in User
              Management.
            </span>
          )}
        </AlertDescription>
      </Alert>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pillars" value={visibleCfg.pillars.length} />
        <Stat label="Objectives" value={visibleCfg.objectives.length} />
        <Stat label="Initiatives" value={totals.initiatives} />
        <Stat label="KPIs / Activities" value={`${totals.kpis} / ${totals.activities}`} />
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="mb-5 h-auto w-full flex-nowrap justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="pillars" className="gap-1.5">
            <Compass className="h-3.5 w-3.5" /> Pillars
          </TabsTrigger>
          <TabsTrigger value="objectives" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Objectives &amp; Initiatives
          </TabsTrigger>
          <TabsTrigger value="activities" className="gap-1.5">
            <TableIcon className="h-3.5 w-3.5" /> Activities &amp; KPIs
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Insights
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Log entry
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pillars" className="mt-0">
          <PillarsView
            cfg={visibleCfg}
            objectivesByPillar={objectivesByPillar}
            canEditPillars={canEditPillars}
            onAdd={() => setPillarDialog(newPillar())}
            onEdit={setPillarDialog}
            onDelete={(id) => setConfirm({ kind: "pillar", id })}
            onJumpToObjectives={() => setTab("objectives")}
          />
        </TabsContent>

        <TabsContent value="objectives" className="mt-0">
          <ObjectivesView
            cfg={visibleCfg}
            objectivesByPillar={objectivesByPillar}
            orgNodes={orgNodes}
            canEditPlan={canEditPlan}
            onAddObjective={(pillarId) =>
              setObjectiveDialog({
                obj: { ...newObjective(pillarId), linkedOrgNodeIds: activeUser.orgNodeId ? [activeUser.orgNodeId] : [] },
                isNew: true,
              })
            }
            onEditObjective={(obj) => setObjectiveDialog({ obj, isNew: false })}
            onDeleteObjective={(id) => setConfirm({ kind: "objective", id })}
            onAddInitiative={(objId) =>
              setInitiativeDialog({ objId, init: { ...newInitiative(), owner: activeUser.name }, isNew: true })
            }
            onEditInitiative={(objId, init) => setInitiativeDialog({ objId, init, isNew: false })}
            onDeleteInitiative={(objId, initId) => setConfirm({ kind: "initiative", id: initId, parentId: objId })}
          />
        </TabsContent>

        <TabsContent value="activities" className="mt-0">
          <ActivitiesView cfg={visibleCfg} />
        </TabsContent>

        <TabsContent value="insights" className="mt-0">
          <FormulationInsights cfg={visibleCfg} orgNodes={orgNodes} />
        </TabsContent>

        <TabsContent value="log" className="mt-0">
          <StrategyEntryForm
            onSubmitted={() => {
              setCfg(loadStrategy());
              setTab("objectives");
            }}
          />
        </TabsContent>
      </Tabs>

      {pillarDialog && (
        <PillarDialog key={pillarDialog.id} pillar={pillarDialog} onClose={() => setPillarDialog(null)} onSave={savePillar} />
      )}
      {objectiveDialog && (
        <ObjectiveDialog
          key={objectiveDialog.obj.id}
          objective={objectiveDialog.obj}
          isNew={objectiveDialog.isNew}
          orgNodes={orgNodes}
          onClose={() => setObjectiveDialog(null)}
          onSave={saveObjective}
        />
      )}
      {initiativeDialog && (
        <InitiativeDialog
          key={initiativeDialog.init.id}
          objectiveId={initiativeDialog.objId}
          initiative={initiativeDialog.init}
          isNew={initiativeDialog.isNew}
          onClose={() => setInitiativeDialog(null)}
          onSave={saveInitiative}
        />
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {confirm?.kind}?</AlertDialogTitle>
            <AlertDialogDescription>{confirm && CONFIRM_COPY[confirm.kind]}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StrategyFormulation;
