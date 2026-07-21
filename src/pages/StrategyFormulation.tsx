// Organization Strategy Formulation — StratOS-inspired rebuild.
//
// Tabs:
//   • Pillars              — admin-only create/edit; everyone else sees a read-only catalog
//   • Objectives & Initiatives — grouped by pillar, all users can add their own
//   • Activities & KPIs    — flat data table across all visible initiatives
//   • Log Entry            — guided tabbed form to log Pillar → Objective → Initiative → Activity → Outcome → KPI in one go
//
// Visibility: non-global users see only objectives linked to their org unit OR a descendant unit.
// Permissions: only Admin can create/edit pillars; ALL roles can build their own objectives/initiatives/etc.

import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Plus, Pencil, Trash2, Compass, Target, Rocket,
  Gauge, ListChecks, ClipboardCheck, Lock, LayoutGrid, FileEdit, Table as TableIcon, BarChart3,
} from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  loadStrategy, saveStrategy,
  newPillar, newObjective, newInitiative, newActivity, newOutcome, newKpi,
  type StrategyConfig, type StrategicPillar, type StrategicObjective,
  type Initiative, type Activity, type Outcome, type Kpi,
} from "@/data/strategyStore";
import { loadOrgNodes, getOrgDescendantChain, type OrgNode } from "@/data/orgStore";
import { useActiveUser } from "@/hooks/use-active-user";
import { can, ROLE_LABELS } from "@/data/userStore";
import { StrategyEntryForm } from "@/components/grc/StrategyEntryForm";
import { FormulationInsights } from "@/components/grc/FormulationInsights";
import { UserPicker } from "@/components/grc/UserPicker";

// ─────────────────────────── StratOS accent palette ────────────────────────────
const ACCENTS = [
  "hsl(var(--stratos-gold))",
  "hsl(var(--stratos-teal))",
  "hsl(var(--stratos-rose))",
  "hsl(var(--stratos-green))",
  "hsl(var(--stratos-purple))",
  "hsl(var(--stratos-amber))",
];

type Tab = "pillars" | "objectives" | "activities" | "insights" | "log";

const StrategyFormulation = () => {
  const activeUser = useActiveUser();
  const canEditPillars = can.editPillars(activeUser.role);
  const canEditPlan = can.editStrategyPlan(activeUser.role);

  const [cfg, setCfg] = useState<StrategyConfig>({ pillars: [], objectives: [] });
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [tab, setTab] = useState<Tab>("pillars");

  const [pillarDialog, setPillarDialog] = useState<StrategicPillar | null>(null);
  const [objectiveDialog, setObjectiveDialog] = useState<{ obj: StrategicObjective; isNew: boolean } | null>(null);
  const [initiativeDialog, setInitiativeDialog] = useState<{ objId: string; init: Initiative; isNew: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "pillar" | "objective" | "initiative"; id: string; parentId?: string } | null>(null);

  useEffect(() => {
    setCfg(loadStrategy());
    setOrgNodes(loadOrgNodes());
  }, []);

  const persist = (next: StrategyConfig) => {
    setCfg(next);
    saveStrategy(next);
  };

  // Scope: non-global users see only their unit + descendants.
  const isGlobalViewer = can.viewAllScopes(activeUser.role);
  const userScopeNodeIds = useMemo(() => {
    if (!activeUser.orgNodeId) return new Set<string>();
    return new Set(getOrgDescendantChain(orgNodes, activeUser.orgNodeId).map(n => n.id));
  }, [orgNodes, activeUser.orgNodeId]);

  const visibleCfg = useMemo<StrategyConfig>(() => {
    if (isGlobalViewer) return cfg;
    return {
      pillars: cfg.pillars,
      objectives: cfg.objectives.filter(o =>
        userScopeNodeIds.size > 0 && o.linkedOrgNodeIds.some(nid => userScopeNodeIds.has(nid)),
      ),
    };
  }, [cfg, isGlobalViewer, userScopeNodeIds]);

  const objectivesByPillar = useMemo(() => {
    const map = new Map<string, StrategicObjective[]>();
    visibleCfg.objectives.forEach(o => {
      const arr = map.get(o.pillarId) ?? [];
      arr.push(o);
      map.set(o.pillarId, arr);
    });
    return map;
  }, [visibleCfg.objectives]);

  // Stats
  const totalInitiatives = visibleCfg.objectives.reduce((s, o) => s + o.initiatives.length, 0);
  const totalActivities = visibleCfg.objectives.reduce((s, o) => s + o.initiatives.reduce((s2, i) => s2 + i.activities.length, 0), 0);
  const totalKpis = visibleCfg.objectives.reduce((s, o) => s + o.initiatives.reduce((s2, i) => s2 + i.kpis.length, 0), 0);

  // ---- Pillar actions ----
  const savePillar = (p: StrategicPillar) => {
    if (!p.name.trim()) { toast.error("Pillar name required"); return; }
    const exists = cfg.pillars.find(x => x.id === p.id);
    persist(exists
      ? { ...cfg, pillars: cfg.pillars.map(x => x.id === p.id ? p : x) }
      : { ...cfg, pillars: [...cfg.pillars, p] });
    setPillarDialog(null);
    toast.success(exists ? "Pillar updated" : "Pillar added");
  };
  const deletePillar = (id: string) => {
    persist({
      pillars: cfg.pillars.filter(p => p.id !== id),
      objectives: cfg.objectives.filter(o => o.pillarId !== id),
    });
    toast.success("Pillar removed");
  };

  // ---- Objective actions ----
  const saveObjective = (o: StrategicObjective, isNew: boolean) => {
    if (!o.title.trim()) { toast.error("Objective title required"); return; }
    persist(isNew
      ? { ...cfg, objectives: [...cfg.objectives, o] }
      : { ...cfg, objectives: cfg.objectives.map(x => x.id === o.id ? o : x) });
    setObjectiveDialog(null);
    toast.success(isNew ? "Objective added" : "Objective updated");
  };
  const deleteObjective = (id: string) => {
    persist({ ...cfg, objectives: cfg.objectives.filter(o => o.id !== id) });
    toast.success("Objective removed");
  };

  // ---- Initiative actions ----
  const saveInitiative = (objId: string, init: Initiative, isNew: boolean) => {
    if (!init.name.trim()) { toast.error("Initiative name required"); return; }
    persist({
      ...cfg,
      objectives: cfg.objectives.map(o => {
        if (o.id !== objId) return o;
        return { ...o, initiatives: isNew ? [...o.initiatives, init] : o.initiatives.map(i => i.id === init.id ? init : i) };
      }),
    });
    setInitiativeDialog(null);
    toast.success(isNew ? "Initiative added" : "Initiative updated");
  };
  const deleteInitiative = (objId: string, initId: string) => {
    persist({
      ...cfg,
      objectives: cfg.objectives.map(o =>
        o.id !== objId ? o : { ...o, initiatives: o.initiatives.filter(i => i.id !== initId) },
      ),
    });
    toast.success("Initiative removed");
  };

  return (
    <>
      <Helmet>
        <title>Organization Strategy Formulation · Rsolve GRC Platform</title>
        <meta name="description" content="Define strategic pillars, objectives, initiatives, activities, expected outcomes and KPIs." />
        <link rel="canonical" href="/governance/strategy-formulation" />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        <TopNav />

        <main className="flex-1 px-5 md:px-10 py-8 md:py-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/governance" className="hover:text-foreground transition-colors">Governance Management</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Organization Strategy Formulation</span>
          </nav>

          <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[28px] md:text-[32px] font-semibold tracking-tight text-foreground leading-none">
                Strategy Formulation
              </h1>
              <p className="text-[13.5px] text-muted-foreground mt-2 max-w-2xl">
                <strong>Plan setup.</strong> Build your strategy under the organisation's pillars: Objectives → Initiatives → Activities → Outcomes → KPIs.
                Self-assessment & approval happen in{" "}
                <Link to="/governance/strategy-assessment" className="text-primary underline">Strategy Performance Assessment</Link>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/governance/strategy-assessment">
                  <ClipboardCheck className="w-4 h-4 mr-1.5" /> Go to Assessment
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/governance">
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                </Link>
              </Button>
            </div>
          </header>

          {/* Scope banner */}
          <Card className="p-3 mb-5 bg-muted/30 border-border">
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              {isGlobalViewer
                ? <span><strong className="text-foreground">{ROLE_LABELS[activeUser.role]} view —</strong> seeing the entire strategy across all organisation units.</span>
                : activeUser.orgNodeId
                  ? <span><strong className="text-foreground">Scoped view —</strong> you only see strategy linked to <em>your unit or a unit below it</em>. Anything you log is auto-tagged to your unit.</span>
                  : <span className="text-warn"><strong>No org unit linked to your profile —</strong> ask an Administrator to assign you in User Management.</span>
              }
            </p>
          </Card>

          {/* Stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={<Compass className="w-4 h-4" />} label="Pillars"     value={visibleCfg.pillars.length} accent={ACCENTS[0]} />
            <StatCard icon={<Target  className="w-4 h-4" />} label="Objectives"  value={visibleCfg.objectives.length} accent={ACCENTS[1]} />
            <StatCard icon={<Rocket  className="w-4 h-4" />} label="Initiatives" value={totalInitiatives} accent={ACCENTS[2]} />
            <StatCard icon={<Gauge   className="w-4 h-4" />} label="KPIs / Activities" value={`${totalKpis} / ${totalActivities}`} accent={ACCENTS[3]} />
          </div>

          {/* Tabs */}
          <div className="border-b border-border flex items-center gap-1 mb-5 overflow-x-auto">
            <TabBtn current={tab} id="pillars"    label="Strategic Pillars"   icon={<Compass className="w-3.5 h-3.5" />} onClick={setTab} />
            <TabBtn current={tab} id="objectives" label="Objectives & Initiatives" icon={<Target className="w-3.5 h-3.5" />} onClick={setTab} />
            <TabBtn current={tab} id="activities" label="Activities & KPIs"   icon={<TableIcon className="w-3.5 h-3.5" />} onClick={setTab} />
            <TabBtn current={tab} id="insights"   label="Insights"            icon={<BarChart3 className="w-3.5 h-3.5" />} onClick={setTab} />
            <TabBtn current={tab} id="log"        label="Log Strategy Entry"  icon={<FileEdit className="w-3.5 h-3.5" />} onClick={setTab} />
          </div>

          {tab === "pillars" && (
            <PillarsView
              cfg={visibleCfg}
              objectivesByPillar={objectivesByPillar}
              canEditPillars={canEditPillars}
              onAdd={() => setPillarDialog(newPillar())}
              onEdit={setPillarDialog}
              onDelete={(id) => setConfirm({ kind: "pillar", id })}
              onJumpToObjectives={() => setTab("objectives")}
            />
          )}

          {tab === "objectives" && (
            <ObjectivesView
              cfg={visibleCfg}
              objectivesByPillar={objectivesByPillar}
              orgNodes={orgNodes}
              canEditPlan={canEditPlan}
              onAddObjective={(pillarId) => setObjectiveDialog({ obj: { ...newObjective(pillarId), linkedOrgNodeIds: activeUser.orgNodeId ? [activeUser.orgNodeId] : [] }, isNew: true })}
              onEditObjective={(obj) => setObjectiveDialog({ obj, isNew: false })}
              onDeleteObjective={(id) => setConfirm({ kind: "objective", id })}
              onAddInitiative={(objId) => setInitiativeDialog({ objId, init: { ...newInitiative(), owner: activeUser.name }, isNew: true })}
              onEditInitiative={(objId, init) => setInitiativeDialog({ objId, init, isNew: false })}
              onDeleteInitiative={(objId, initId) => setConfirm({ kind: "initiative", id: initId, parentId: objId })}
            />
          )}

          {tab === "activities" && (
            <ActivitiesView cfg={visibleCfg} />
          )}

          {tab === "insights" && (
            <FormulationInsights cfg={visibleCfg} orgNodes={orgNodes} />
          )}

          {tab === "log" && (
            <StrategyEntryForm onSubmitted={() => { setCfg(loadStrategy()); setTab("objectives"); }} />
          )}
        </main>
      </div>

      <PillarDialog pillar={pillarDialog} onClose={() => setPillarDialog(null)} onSave={savePillar} />
      <ObjectiveDialog state={objectiveDialog} orgNodes={orgNodes} onClose={() => setObjectiveDialog(null)} onSave={saveObjective} />
      <InitiativeDialog state={initiativeDialog} onClose={() => setInitiativeDialog(null)} onSave={saveInitiative} />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {confirm?.kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "pillar" && "All objectives and initiatives under this pillar will also be removed."}
              {confirm?.kind === "objective" && "All initiatives, activities, outcomes and KPIs under this objective will also be removed."}
              {confirm?.kind === "initiative" && "All activities, outcomes and KPIs under this initiative will also be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (!confirm) return;
                if (confirm.kind === "pillar") deletePillar(confirm.id);
                else if (confirm.kind === "objective") deleteObjective(confirm.id);
                else if (confirm.kind === "initiative" && confirm.parentId) deleteInitiative(confirm.parentId, confirm.id);
                setConfirm(null);
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StrategyFormulation;

// ═══════════════════════════ Sub-components ═══════════════════════════

const TabBtn = ({ current, id, label, icon, onClick }: { current: Tab; id: Tab; label: string; icon: React.ReactNode; onClick: (t: Tab) => void }) => (
  <button
    onClick={() => onClick(id)}
    className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
      current === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
    }`}
  >
    {icon}{label}
  </button>
);

interface StatCardProps { icon: React.ReactNode; label: string; value: number | string; accent?: string; }
const StatCard = ({ icon, label, value, accent }: StatCardProps) => (
  <Card className="p-4 relative overflow-hidden">
    {accent && <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md" style={{ background: accent }} />}
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 pl-1">
      {icon}<span>{label}</span>
    </div>
    <p className="text-3xl font-semibold text-foreground leading-none pl-1">{value}</p>
  </Card>
);

// ─────────────────────────── Pillars view (admin-only edit) ─────────────────────
interface PillarsViewProps {
  cfg: StrategyConfig;
  objectivesByPillar: Map<string, StrategicObjective[]>;
  canEditPillars: boolean;
  onAdd: () => void;
  onEdit: (p: StrategicPillar) => void;
  onDelete: (id: string) => void;
  onJumpToObjectives: () => void;
}
const PillarsView = ({ cfg, objectivesByPillar, canEditPillars, onAdd, onEdit, onDelete, onJumpToObjectives }: PillarsViewProps) => {
  if (cfg.pillars.length === 0) {
    return (
      <Card className="p-12 text-center border-2 border-dashed">
        <Compass className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No strategic pillars defined yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto mb-4">
          Pillars are created by the Administrator. Once defined, all users can link their objectives, initiatives and activities to them.
        </p>
        {canEditPillars && (
          <Button size="sm" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1.5" /> Add first pillar
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">Strategic Pillars</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {canEditPillars
              ? "You define the organisation's pillars. All users will link their work here."
              : "Read-only catalog defined by the Administrator. Link your objectives in the Objectives tab."}
          </p>
        </div>
        {canEditPillars && (
          <Button size="sm" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Pillar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cfg.pillars.map((pillar, idx) => {
          const objs = objectivesByPillar.get(pillar.id) ?? [];
          const totalInitiatives = objs.reduce((s, o) => s + o.initiatives.length, 0);
          const totalKpis = objs.reduce((s, o) => s + o.initiatives.reduce((s2, i) => s2 + i.kpis.length, 0), 0);
          const totalActs = objs.reduce((s, o) => s + o.initiatives.reduce((s2, i) => s2 + i.activities.length, 0), 0);
          const accent = ACCENTS[idx % ACCENTS.length];

          return (
            <div
              key={pillar.id}
              className="group relative bg-card border border-border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-card-hover hover:-translate-y-0.5"
              onClick={onJumpToObjectives}
            >
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accent }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
                    Pillar {String(idx + 1).padStart(2, "0")}
                  </span>
                  {canEditPillars && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(pillar)} aria-label="Edit pillar">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(pillar.id)} aria-label="Delete pillar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-foreground leading-tight mb-2 line-clamp-2">
                  {pillar.name || "Untitled pillar"}
                </h3>
                {pillar.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-4">{pillar.description}</p>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <PillarStat label="Objectives"  value={objs.length} />
                  <PillarStat label="Initiatives" value={totalInitiatives} />
                  <PillarStat label="KPIs"        value={totalKpis} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  <ListChecks className="w-3 h-3 inline mr-1" />{totalActs} activities tracked
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PillarStat = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-muted/40 rounded-md px-2 py-2">
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
    <p className="text-xl font-semibold text-foreground leading-none">{value}</p>
  </div>
);

// ───────────── Objectives & Initiatives view ─────────────
interface ObjectivesViewProps {
  cfg: StrategyConfig;
  objectivesByPillar: Map<string, StrategicObjective[]>;
  orgNodes: OrgNode[];
  canEditPlan: boolean;
  onAddObjective: (pillarId: string) => void;
  onEditObjective: (obj: StrategicObjective) => void;
  onDeleteObjective: (id: string) => void;
  onAddInitiative: (objId: string) => void;
  onEditInitiative: (objId: string, init: Initiative) => void;
  onDeleteInitiative: (objId: string, initId: string) => void;
}
const ObjectivesView = ({
  cfg, objectivesByPillar, orgNodes, canEditPlan,
  onAddObjective, onEditObjective, onDeleteObjective,
  onAddInitiative, onEditInitiative, onDeleteInitiative,
}: ObjectivesViewProps) => {
  const orgNodeMap = useMemo(() => new Map(orgNodes.map(n => [n.id, n])), [orgNodes]);

  if (cfg.pillars.length === 0) {
    return (
      <Card className="p-10 text-center border-2 border-dashed">
        <Compass className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">Pillars not yet defined</p>
        <p className="text-xs text-muted-foreground mt-1">An Administrator must create the strategic pillars first.</p>
      </Card>
    );
  }

  const visiblePillarIds = cfg.pillars.filter(p => (objectivesByPillar.get(p.id)?.length ?? 0) > 0).map(p => p.id);
  const emptyPillarIds = cfg.pillars.filter(p => (objectivesByPillar.get(p.id)?.length ?? 0) === 0).map(p => p.id);

  return (
    <div className="space-y-7">
      {cfg.pillars.map((pillar, idx) => {
        const objs = objectivesByPillar.get(pillar.id) ?? [];
        const accent = ACCENTS[idx % ACCENTS.length];
        return (
          <div key={pillar.id}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1 h-9 rounded-sm" style={{ background: accent }} />
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold text-foreground leading-none">{pillar.name}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{objs.length} objectives</p>
              </div>
              {canEditPlan && (
                <Button size="sm" variant="outline" onClick={() => onAddObjective(pillar.id)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Objective
                </Button>
              )}
            </div>

            {objs.length === 0 ? (
              <Card className="p-5 text-center border-dashed">
                <p className="text-xs text-muted-foreground">
                  No objectives under this pillar yet{canEditPlan ? " — add the first one above." : "."}
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {objs.map(obj => (
                  <ObjectiveCard
                    key={obj.id}
                    obj={obj}
                    orgNodeMap={orgNodeMap}
                    canEditPlan={canEditPlan}
                    onEdit={() => onEditObjective(obj)}
                    onDelete={() => onDeleteObjective(obj.id)}
                    onAddInitiative={() => onAddInitiative(obj.id)}
                    onEditInitiative={(init) => onEditInitiative(obj.id, init)}
                    onDeleteInitiative={(initId) => onDeleteInitiative(obj.id, initId)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ObjectiveCard = ({ obj, orgNodeMap, canEditPlan, onEdit, onDelete, onAddInitiative, onEditInitiative, onDeleteInitiative }: {
  obj: StrategicObjective;
  orgNodeMap: Map<string, OrgNode>;
  canEditPlan: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddInitiative: () => void;
  onEditInitiative: (init: Initiative) => void;
  onDeleteInitiative: (initId: string) => void;
}) => {
  const totalActs = obj.initiatives.reduce((s, i) => s + i.activities.length, 0);
  const totalKpis = obj.initiatives.reduce((s, i) => s + i.kpis.length, 0);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{obj.title}</p>
          {obj.description && <p className="text-xs text-muted-foreground mt-0.5">{obj.description}</p>}
          {obj.linkedOrgNodeIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {obj.linkedOrgNodeIds.slice(0, 5).map(nid => {
                const n = orgNodeMap.get(nid);
                if (!n) return null;
                return (
                  <Badge key={nid} variant="secondary" className="text-[10px] font-normal">{n.name}</Badge>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className="text-[10px]">{obj.initiatives.length} initiatives</Badge>
          {canEditPlan && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
            </>
          )}
        </div>
      </div>

      {obj.initiatives.length > 0 && (
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          Initiatives ({obj.initiatives.length}) · {totalActs} activities · {totalKpis} KPIs
        </p>
      )}
      <div className="space-y-1.5">
        {obj.initiatives.map(init => (
          <div key={init.id} className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-md text-xs">
            <Rocket className="w-3.5 h-3.5 text-[hsl(var(--stratos-purple))] shrink-0" />
            <span className="flex-1 min-w-0 truncate font-medium text-foreground">{init.name}</span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">{init.activities.length} acts · {init.kpis.length} KPIs</span>
            {init.owner && <span className="text-[10px] text-muted-foreground hidden md:inline">· {init.owner}</span>}
            {canEditPlan && (
              <>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEditInitiative(init)} aria-label="Edit"><Pencil className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDeleteInitiative(init.id)} aria-label="Delete"><Trash2 className="w-3 h-3" /></Button>
              </>
            )}
          </div>
        ))}
      </div>

      {canEditPlan && (
        <Button size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={onAddInitiative}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Initiative
        </Button>
      )}
    </Card>
  );
};

// ───────────── Activities & KPIs flat table ─────────────
const ActivitiesView = ({ cfg }: { cfg: StrategyConfig }) => {
  const rows = useMemo(() => {
    const list: { pillar: string; objective: string; initiative: string; activity: string; owner?: string; due?: string; kpiName: string; target: string; unit: string; }[] = [];
    cfg.pillars.forEach(p => {
      cfg.objectives.filter(o => o.pillarId === p.id).forEach(o => {
        o.initiatives.forEach(i => {
          if (i.activities.length === 0 && i.kpis.length === 0) return;
          // pair activities and KPIs in display rows
          const acts = i.activities.length > 0 ? i.activities : [{ id: "x", description: "—", owner: "", dueDate: "" } as Activity];
          acts.forEach(a => {
            if (i.kpis.length === 0) {
              list.push({
                pillar: p.name, objective: o.title, initiative: i.name,
                activity: a.description || "—", owner: a.owner, due: a.dueDate,
                kpiName: "—", target: "—", unit: "",
              });
            } else {
              i.kpis.forEach(k => {
                list.push({
                  pillar: p.name, objective: o.title, initiative: i.name,
                  activity: a.description || "—", owner: a.owner, due: a.dueDate,
                  kpiName: k.name || "(unnamed KPI)", target: k.target ?? "—", unit: k.unit ?? "",
                });
              });
            }
          });
        });
      });
    });
    return list;
  }, [cfg]);

  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center border-dashed">
        <ListChecks className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No activities yet</p>
        <p className="text-xs text-muted-foreground mt-1">Use the Log Strategy Entry tab to add the first one.</p>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Pillar</th>
              <th className="text-left px-3 py-2 font-semibold">Objective</th>
              <th className="text-left px-3 py-2 font-semibold">Initiative</th>
              <th className="text-left px-3 py-2 font-semibold">Activity</th>
              <th className="text-left px-3 py-2 font-semibold">Owner</th>
              <th className="text-left px-3 py-2 font-semibold">Due</th>
              <th className="text-left px-3 py-2 font-semibold">KPI</th>
              <th className="text-left px-3 py-2 font-semibold">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-muted/30 text-xs">
                <td className="px-3 py-2 text-muted-foreground">{r.pillar}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.objective}</td>
                <td className="px-3 py-2 font-medium text-foreground">{r.initiative}</td>
                <td className="px-3 py-2 text-foreground">{r.activity}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.owner || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.due || "—"}</td>
                <td className="px-3 py-2 text-foreground">{r.kpiName}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.target}{r.unit ? ` ${r.unit}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ───────────── Pillar / Objective / Initiative dialogs ─────────────
const PillarDialog = ({ pillar, onClose, onSave }: { pillar: StrategicPillar | null; onClose: () => void; onSave: (p: StrategicPillar) => void }) => {
  const [draft, setDraft] = useState<StrategicPillar | null>(pillar);
  useEffect(() => setDraft(pillar), [pillar]);
  if (!draft) return null;
  return (
    <Dialog open={!!pillar} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pillar?.name ? "Edit pillar" : "New strategic pillar"}</DialogTitle>
          <DialogDescription>Pillars are the high-level themes the entire strategy is built on.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Pillar name *</Label>
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Customer Experience" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea rows={3} value={draft.description ?? ""} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="What this pillar means for the organisation..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ObjectiveDialog = ({ state, orgNodes, onClose, onSave }: {
  state: { obj: StrategicObjective; isNew: boolean } | null;
  orgNodes: OrgNode[];
  onClose: () => void;
  onSave: (o: StrategicObjective, isNew: boolean) => void;
}) => {
  const [draft, setDraft] = useState<StrategicObjective | null>(state?.obj ?? null);
  useEffect(() => setDraft(state?.obj ?? null), [state]);
  if (!draft || !state) return null;

  const toggle = (nid: string) => {
    const has = draft.linkedOrgNodeIds.includes(nid);
    setDraft({ ...draft, linkedOrgNodeIds: has ? draft.linkedOrgNodeIds.filter(x => x !== nid) : [...draft.linkedOrgNodeIds, nid] });
  };

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.isNew ? "New objective" : "Edit objective"}</DialogTitle>
          <DialogDescription>Objectives sit under a pillar and group related initiatives.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Objective title *</Label>
            <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea rows={2} value={draft.description ?? ""} onChange={e => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Linked organisation units</Label>
            <p className="text-[10px] text-muted-foreground mb-1.5">Choose the units responsible. Approval routes upward from these units.</p>
            <div className="border border-border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
              {orgNodes.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No org units defined. Set up the org tree in Risk Governance first.</p>
              ) : orgNodes.map(n => (
                <label key={n.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 px-1.5 py-1 rounded">
                  <Checkbox checked={draft.linkedOrgNodeIds.includes(n.id)} onCheckedChange={() => toggle(n.id)} />
                  <span className="flex-1">{n.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft, state.isNew)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const InitiativeDialog = ({ state, onClose, onSave }: {
  state: { objId: string; init: Initiative; isNew: boolean } | null;
  onClose: () => void;
  onSave: (objId: string, init: Initiative, isNew: boolean) => void;
}) => {
  const [draft, setDraft] = useState<Initiative | null>(state?.init ?? null);
  useEffect(() => setDraft(state?.init ?? null), [state]);
  if (!draft || !state) return null;

  const addAct = () => setDraft({ ...draft, activities: [...draft.activities, newActivity()] });
  const updAct = (id: string, patch: Partial<Activity>) => setDraft({ ...draft, activities: draft.activities.map(a => a.id === id ? { ...a, ...patch } : a) });
  const delAct = (id: string) => setDraft({ ...draft, activities: draft.activities.filter(a => a.id !== id) });

  const addOut = () => setDraft({ ...draft, outcomes: [...draft.outcomes, newOutcome()] });
  const updOut = (id: string, patch: Partial<Outcome>) => setDraft({ ...draft, outcomes: draft.outcomes.map(o => o.id === id ? { ...o, ...patch } : o) });
  const delOut = (id: string) => setDraft({ ...draft, outcomes: draft.outcomes.filter(o => o.id !== id) });

  const addKpi = () => {
    const k = newKpi("quantitative");
    setDraft({ ...draft, kpis: [...draft.kpis, k], linkedKpiIds: [...draft.linkedKpiIds, k.id] });
  };
  const updKpi = (id: string, patch: Partial<Kpi>) => setDraft({ ...draft, kpis: draft.kpis.map(k => k.id === id ? { ...k, ...patch } : k) });
  const delKpi = (id: string) => setDraft({ ...draft, kpis: draft.kpis.filter(k => k.id !== id), linkedKpiIds: draft.linkedKpiIds.filter(x => x !== id) });

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{state.isNew ? "New initiative" : "Edit initiative"}</DialogTitle>
          <DialogDescription>Initiatives execute objectives. Add activities, outcomes and KPIs.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Initiative name *</Label>
              <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Owner</Label>
              <UserPicker value={draft.owner ?? ""} onChange={(name) => setDraft({ ...draft, owner: name })} placeholder="Select owner..." />
            </div>
            <div>
              <Label className="text-xs">Start date</Label>
              <Input type="date" value={draft.startDate ?? ""} onChange={e => setDraft({ ...draft, startDate: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Expected completion</Label>
              <Input type="date" value={draft.expectedCompletion ?? ""} onChange={e => setDraft({ ...draft, expectedCompletion: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea rows={2} value={draft.description ?? ""} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            </div>
          </div>

          {/* Activities */}
          <DialogSubsection title="Activities" icon={<ListChecks className="w-3.5 h-3.5" />} onAdd={addAct}>
            {draft.activities.map(a => (
              <div key={a.id} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-6 h-8 text-xs" placeholder="Activity description" value={a.description} onChange={e => updAct(a.id, { description: e.target.value })} />
                <div className="col-span-3">
                  <UserPicker size="sm" value={a.owner ?? ""} onChange={(name) => updAct(a.id, { owner: name })} placeholder="Owner..." />
                </div>
                <Input type="date" className="col-span-2 h-8 text-xs" value={a.dueDate ?? ""} onChange={e => updAct(a.id, { dueDate: e.target.value })} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => delAct(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </DialogSubsection>

          {/* Outcomes */}
          <DialogSubsection title="Expected outcomes" icon={<ClipboardCheck className="w-3.5 h-3.5" />} onAdd={addOut}>
            {draft.outcomes.map(o => (
              <div key={o.id} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-9 h-8 text-xs" placeholder="Expected outcome" value={o.description} onChange={e => updOut(o.id, { description: e.target.value })} />
                <Input type="date" className="col-span-2 h-8 text-xs" value={o.expectedDate ?? ""} onChange={e => updOut(o.id, { expectedDate: e.target.value })} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => delOut(o.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </DialogSubsection>

          {/* KPIs */}
          <DialogSubsection title="KPIs" icon={<Gauge className="w-3.5 h-3.5" />} onAdd={addKpi}>
            {draft.kpis.map(k => (
              <div key={k.id} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-4 h-8 text-xs" placeholder="KPI name" value={k.name} onChange={e => updKpi(k.id, { name: e.target.value })} />
                <Select value={k.type} onValueChange={(v) => updKpi(k.id, { type: v as "quantitative" | "qualitative" })}>
                  <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantitative">Quant</SelectItem>
                    <SelectItem value="qualitative">Qual</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="col-span-2 h-8 text-xs" placeholder="Target" value={k.target ?? ""} onChange={e => updKpi(k.id, { target: e.target.value })} />
                <Input className="col-span-2 h-8 text-xs" placeholder="Unit" value={k.unit ?? ""} onChange={e => updKpi(k.id, { unit: e.target.value })} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive col-span-2" onClick={() => delKpi(k.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </DialogSubsection>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(state.objId, draft, state.isNew)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DialogSubsection = ({ title, icon, onAdd, children }: { title: string; icon: React.ReactNode; onAdd: () => void; children: React.ReactNode }) => (
  <div className="border border-border rounded-md p-3 space-y-2 bg-muted/20">
    <div className="flex items-center justify-between">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1.5">{icon}{title}</p>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAdd}><Plus className="w-3 h-3 mr-1" />Add</Button>
    </div>
    {children}
  </div>
);
