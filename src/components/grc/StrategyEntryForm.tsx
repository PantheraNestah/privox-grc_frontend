// StratOS-style "Log Strategy Entry" — tabbed form (Basic Info / KPIs & Outcomes / Timeline).
// Replaces the multi-step wizard. Used by ALL roles to add an objective+initiative+activity+KPI
// under any pillar. The new objective is auto-linked to the user's orgNodeId so descendant
// scoping continues to work without extra picking.

import { useEffect, useMemo, useState } from "react";
import {
  Card,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Compass, Target, Rocket, Gauge, Calendar as CalendarIcon, ListChecks, CheckCircle2, Send, RotateCcw,
} from "lucide-react";
import {
  loadStrategy, saveStrategy,
  newObjective, newInitiative, newActivity, newOutcome, newKpi,
  type StrategicPillar, type StrategicObjective, type Initiative, type KpiType,
} from "@/data/strategyStore";
import { loadOrgNodes, type OrgNode } from "@/data/orgStore";
import { useActiveUser } from "@/hooks/use-active-user";

type Tab = "basic" | "kpi" | "timeline";

interface FormState {
  pillarId: string;
  objectiveId: string;        // existing objective OR "__new__"
  newObjectiveTitle: string;
  initiativeName: string;
  initiativeDescription: string;
  responsibleUnitId: string;  // org node id
  activityDescription: string;
  expectedOutcome: string;
  // KPI tab
  kpiName: string;
  kpiType: KpiType;
  kpiUnit: string;
  kpiBaseline: string;
  kpiTarget: string;
  kpiCurrent: string;
  kpiFrequency: "Monthly" | "Quarterly" | "Semi-Annual" | "Annual";
  // Timeline tab
  startDate: string;
  endDate: string;
  priority: "High" | "Medium" | "Low";
  budget: string;
  remarks: string;
}

const emptyState = (orgNodeId?: string): FormState => ({
  pillarId: "",
  objectiveId: "__new__",
  newObjectiveTitle: "",
  initiativeName: "",
  initiativeDescription: "",
  responsibleUnitId: orgNodeId ?? "",
  activityDescription: "",
  expectedOutcome: "",
  kpiName: "",
  kpiType: "quantitative",
  kpiUnit: "",
  kpiBaseline: "",
  kpiTarget: "",
  kpiCurrent: "",
  kpiFrequency: "Quarterly",
  startDate: "",
  endDate: "",
  priority: "Medium",
  budget: "",
  remarks: "",
});

interface Props {
  /** Called after a successful submit so the parent can refresh / switch tab. */
  onSubmitted?: () => void;
}

export const StrategyEntryForm = ({ onSubmitted }: Props) => {
  const activeUser = useActiveUser();
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [pillars, setPillars] = useState<StrategicPillar[]>([]);
  const [objectives, setObjectives] = useState<StrategicObjective[]>([]);
  const [tab, setTab] = useState<Tab>("basic");
  const [state, setState] = useState<FormState>(() => emptyState(activeUser.orgNodeId));

  useEffect(() => {
    setOrgNodes(loadOrgNodes());
    const cfg = loadStrategy();
    setPillars(cfg.pillars);
    setObjectives(cfg.objectives);
  }, []);

  useEffect(() => {
    setState(s => ({ ...s, responsibleUnitId: s.responsibleUnitId || activeUser.orgNodeId || "" }));
  }, [activeUser.orgNodeId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState(s => ({ ...s, [key]: value }));

  const objectivesForPillar = useMemo(
    () => objectives.filter(o => o.pillarId === state.pillarId),
    [objectives, state.pillarId],
  );

  const reset = () => {
    setState(emptyState(activeUser.orgNodeId));
    setTab("basic");
  };

  const submit = () => {
    // ---- Validation ----
    if (!state.pillarId) { toast.error("Pick a strategic pillar"); setTab("basic"); return; }
    if (state.objectiveId === "__new__" && !state.newObjectiveTitle.trim()) {
      toast.error("Enter the new objective title"); setTab("basic"); return;
    }
    if (!state.initiativeName.trim()) { toast.error("Initiative name is required"); setTab("basic"); return; }
    if (!state.activityDescription.trim()) { toast.error("Activity description is required"); setTab("basic"); return; }
    if (!state.kpiName.trim()) { toast.error("KPI name is required"); setTab("kpi"); return; }
    if (!state.kpiTarget.trim()) { toast.error("KPI target is required"); setTab("kpi"); return; }
    if (!state.startDate || !state.endDate) { toast.error("Start and end dates are required"); setTab("timeline"); return; }

    // ---- Build domain objects ----
    const cfg = loadStrategy();

    let objectiveId = state.objectiveId;
    let nextObjectives = cfg.objectives;
    if (state.objectiveId === "__new__") {
      const obj = newObjective(state.pillarId);
      obj.title = state.newObjectiveTitle.trim();
      // Link to user's org unit so descendant scoping picks it up
      obj.linkedOrgNodeIds = state.responsibleUnitId ? [state.responsibleUnitId] : [];
      nextObjectives = [...cfg.objectives, obj];
      objectiveId = obj.id;
    } else {
      // Ensure the existing objective is linked to the user's unit if not already
      nextObjectives = cfg.objectives.map(o => {
        if (o.id !== objectiveId) return o;
        if (state.responsibleUnitId && !o.linkedOrgNodeIds.includes(state.responsibleUnitId)) {
          return { ...o, linkedOrgNodeIds: [...o.linkedOrgNodeIds, state.responsibleUnitId] };
        }
        return o;
      });
    }

    const init: Initiative = newInitiative();
    init.name = state.initiativeName.trim();
    init.description = state.initiativeDescription.trim();
    init.owner = activeUser.name;
    init.startDate = state.startDate;
    init.expectedCompletion = state.endDate;
    init.submittedByUserId = activeUser.id;

    const act = newActivity();
    act.description = state.activityDescription.trim();
    act.owner = activeUser.name;
    act.dueDate = state.endDate;
    init.activities = [act];

    if (state.expectedOutcome.trim()) {
      const out = newOutcome();
      out.description = state.expectedOutcome.trim();
      out.expectedDate = state.endDate;
      init.outcomes = [out];
    }

    const kpi = newKpi(state.kpiType);
    kpi.name = state.kpiName.trim();
    kpi.unit = state.kpiUnit.trim();
    kpi.target = state.kpiTarget.trim();
    kpi.actual = state.kpiCurrent.trim() || undefined;
    init.kpis = [kpi];
    init.linkedKpiIds = [kpi.id];

    nextObjectives = nextObjectives.map(o =>
      o.id === objectiveId ? { ...o, initiatives: [...o.initiatives, init] } : o,
    );

    saveStrategy({ ...cfg, objectives: nextObjectives });
    toast.success("Strategy entry logged");
    reset();
    onSubmitted?.();
  };

  const TabButton = ({ id, label }: { id: Tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        tab === id
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
      type="button"
    >
      {label}
    </button>
  );

  if (pillars.length === 0) {
    return (
      <Card className="p-10 text-center border-2 border-dashed">
        <Compass className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-semibold text-foreground">No strategic pillars defined yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Only Administrators can create the organisation's strategic pillars.
          Once a pillar exists you'll be able to log your objectives, initiatives, activities and KPIs against it.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 pt-4 border-b border-border flex items-center gap-1">
        <TabButton id="basic" label="Basic Info" />
        <TabButton id="kpi" label="KPIs & Outcomes" />
        <TabButton id="timeline" label="Timeline" />
        <div className="ml-auto pb-1">
          <Badge variant="outline" className="text-[10px]">
            Logging as <strong className="ml-1">{activeUser.name}</strong>
          </Badge>
        </div>
      </div>

      <div className="p-5">
        {tab === "basic" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Strategic Pillar *" icon={<Compass className="w-3.5 h-3.5" />}>
              <Select value={state.pillarId} onValueChange={(v) => { set("pillarId", v); set("objectiveId", "__new__"); set("newObjectiveTitle", ""); }}>
                <SelectTrigger><SelectValue placeholder="Select pillar..." /></SelectTrigger>
                <SelectContent>
                  {pillars.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Strategic Objective *" icon={<Target className="w-3.5 h-3.5" />}>
              <Select value={state.objectiveId} onValueChange={(v) => set("objectiveId", v)} disabled={!state.pillarId}>
                <SelectTrigger><SelectValue placeholder="Select objective..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">+ Add new objective</SelectItem>
                  {objectivesForPillar.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {state.objectiveId === "__new__" && (
              <div className="md:col-span-2">
                <Field label="New objective title *">
                  <Input value={state.newObjectiveTitle} onChange={(e) => set("newObjectiveTitle", e.target.value)} placeholder="e.g. Improve customer experience" />
                </Field>
              </div>
            )}

            <Field label="Strategic Initiative *" icon={<Rocket className="w-3.5 h-3.5" />}>
              <Input value={state.initiativeName} onChange={(e) => set("initiativeName", e.target.value)} placeholder="e.g. Digital onboarding programme" />
            </Field>

            <Field label="Responsible Unit">
              <Select value={state.responsibleUnitId || "__none__"} onValueChange={(v) => set("responsibleUnitId", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Pick org unit..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Not specified —</SelectItem>
                  {orgNodes.map(n => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Initiative description">
                <Textarea rows={2} value={state.initiativeDescription} onChange={(e) => set("initiativeDescription", e.target.value)} placeholder="What is this initiative about?" />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Strategic Activity *" icon={<ListChecks className="w-3.5 h-3.5" />}>
                <Input value={state.activityDescription} onChange={(e) => set("activityDescription", e.target.value)} placeholder="Describe the specific activity..." />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Expected Outcome" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                <Textarea rows={2} value={state.expectedOutcome} onChange={(e) => set("expectedOutcome", e.target.value)} placeholder="Describe the expected outcome of this activity..." />
              </Field>
            </div>
          </div>
        )}

        {tab === "kpi" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="KPI Name *" icon={<Gauge className="w-3.5 h-3.5" />}>
              <Input value={state.kpiName} onChange={(e) => set("kpiName", e.target.value)} placeholder="e.g. Customer satisfaction score" />
            </Field>
            <Field label="KPI Type">
              <Select value={state.kpiType} onValueChange={(v) => set("kpiType", v as KpiType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quantitative">Quantitative</SelectItem>
                  <SelectItem value="qualitative">Qualitative</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="KPI Unit">
              <Input value={state.kpiUnit} onChange={(e) => set("kpiUnit", e.target.value)} placeholder="e.g. %, KES, count" />
            </Field>
            <Field label="Measurement Frequency">
              <Select value={state.kpiFrequency} onValueChange={(v) => set("kpiFrequency", v as FormState["kpiFrequency"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Quarterly">Quarterly</SelectItem>
                  <SelectItem value="Semi-Annual">Semi-Annual</SelectItem>
                  <SelectItem value="Annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Baseline Value">
              <Input value={state.kpiBaseline} onChange={(e) => set("kpiBaseline", e.target.value)} placeholder="0" />
            </Field>
            <Field label="Target Value *">
              <Input value={state.kpiTarget} onChange={(e) => set("kpiTarget", e.target.value)} placeholder="100" />
            </Field>
            <Field label="Current Value">
              <Input value={state.kpiCurrent} onChange={(e) => set("kpiCurrent", e.target.value)} placeholder="0" />
            </Field>
          </div>
        )}

        {tab === "timeline" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Start Date *" icon={<CalendarIcon className="w-3.5 h-3.5" />}>
              <Input type="date" value={state.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </Field>
            <Field label="End Date *">
              <Input type="date" value={state.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </Field>
            <Field label="Priority">
              <Select value={state.priority} onValueChange={(v) => set("priority", v as FormState["priority"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Budget">
              <Input value={state.budget} onChange={(e) => set("budget", e.target.value)} placeholder="0" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Remarks / Notes">
                <Textarea rows={3} value={state.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Any additional context..." />
              </Field>
            </div>
          </div>
        )}

        <div className="border-t border-border mt-6 pt-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={reset} type="button">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Clear
          </Button>
          {tab !== "timeline" ? (
            <Button size="sm" onClick={() => setTab(tab === "basic" ? "kpi" : "timeline")} type="button">
              Next →
            </Button>
          ) : (
            <Button size="sm" onClick={submit} type="button">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Entry
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

const Field = ({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
      {icon}{label}
    </Label>
    {children}
  </div>
);
