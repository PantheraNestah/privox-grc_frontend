// StratOS-style "Log Strategy Entry" — tabbed form (Basic Info / KPIs & Outcomes / Timeline).
// Replaces the multi-step wizard. Used by ALL roles to add an objective+initiative+activity+KPI
// under any pillar. The new objective is auto-linked to the user's orgNodeId so descendant
// scoping continues to work without extra picking.

import { useId, useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/grc/common/states";
import { toast } from "sonner";
import { Compass, Target, Rocket, Gauge, Calendar as CalendarIcon, ListChecks, CheckCircle2, Send, RotateCcw } from "lucide-react";
import {
  loadStrategy, saveStrategy,
  newObjective, newInitiative, newActivity, newOutcome, newKpi,
  type Initiative, type KpiType,
} from "@/data/strategyStore";
import { loadOrgNodes } from "@/data/orgStore";
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
  const uid = useId();
  // Synchronous localStorage reads: load once instead of syncing through an effect.
  const [orgNodes] = useState(() => loadOrgNodes());
  const [{ pillars, objectives }] = useState(() => loadStrategy());
  const [tab, setTab] = useState<Tab>("basic");
  const [state, setState] = useState<FormState>(() => emptyState(activeUser.orgNodeId));

  const id = (name: string) => `${uid}-${name}`;

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

  if (pillars.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="No strategic pillars defined yet"
        description="Only Administrators can create the organisation's strategic pillars. Once a pillar exists you'll be able to log your objectives, initiatives, activities and KPIs against it."
      />
    );
  }

  return (
    <Card>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="basic" className="flex-1 sm:flex-none">Basic info</TabsTrigger>
            <TabsTrigger value="kpi" className="flex-1 sm:flex-none">KPIs &amp; outcomes</TabsTrigger>
            <TabsTrigger value="timeline" className="flex-1 sm:flex-none">Timeline</TabsTrigger>
          </TabsList>
          <Badge variant="outline" className="w-fit text-[10px] font-normal">
            Logging as <strong className="ml-1 font-medium">{activeUser.name}</strong>
          </Badge>
        </CardHeader>

        <CardContent>
          {tab === "basic" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Strategic pillar *" htmlFor={id("pillar")} icon={<Compass className="h-3.5 w-3.5" />}>
                <Select
                  value={state.pillarId}
                  onValueChange={(v) => setState((s) => ({ ...s, pillarId: v, objectiveId: "__new__", newObjectiveTitle: "" }))}
                >
                  <SelectTrigger id={id("pillar")}><SelectValue placeholder="Select pillar..." /></SelectTrigger>
                  <SelectContent>
                    {pillars.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Strategic objective *" htmlFor={id("objective")} icon={<Target className="h-3.5 w-3.5" />}>
                <Select value={state.objectiveId} onValueChange={(v) => set("objectiveId", v)} disabled={!state.pillarId}>
                  <SelectTrigger id={id("objective")}><SelectValue placeholder="Select objective..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">+ Add new objective</SelectItem>
                    {objectivesForPillar.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {state.objectiveId === "__new__" && (
                <Field label="New objective title *" htmlFor={id("new-objective")} className="md:col-span-2">
                  <Input
                    id={id("new-objective")}
                    value={state.newObjectiveTitle}
                    onChange={(e) => set("newObjectiveTitle", e.target.value)}
                    placeholder="e.g. Improve customer experience"
                  />
                </Field>
              )}

              <Field label="Strategic initiative *" htmlFor={id("initiative")} icon={<Rocket className="h-3.5 w-3.5" />}>
                <Input
                  id={id("initiative")}
                  value={state.initiativeName}
                  onChange={(e) => set("initiativeName", e.target.value)}
                  placeholder="e.g. Digital onboarding programme"
                />
              </Field>

              <Field label="Responsible unit" htmlFor={id("unit")}>
                <Select
                  value={state.responsibleUnitId || "__none__"}
                  onValueChange={(v) => set("responsibleUnitId", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger id={id("unit")}><SelectValue placeholder="Pick org unit..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Not specified —</SelectItem>
                    {orgNodes.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Initiative description" htmlFor={id("initiative-desc")} className="md:col-span-2">
                <Textarea
                  id={id("initiative-desc")}
                  rows={2}
                  value={state.initiativeDescription}
                  onChange={(e) => set("initiativeDescription", e.target.value)}
                  placeholder="What is this initiative about?"
                />
              </Field>

              <Field label="Strategic activity *" htmlFor={id("activity")} icon={<ListChecks className="h-3.5 w-3.5" />} className="md:col-span-2">
                <Input
                  id={id("activity")}
                  value={state.activityDescription}
                  onChange={(e) => set("activityDescription", e.target.value)}
                  placeholder="Describe the specific activity..."
                />
              </Field>

              <Field label="Expected outcome" htmlFor={id("outcome")} icon={<CheckCircle2 className="h-3.5 w-3.5" />} className="md:col-span-2">
                <Textarea
                  id={id("outcome")}
                  rows={2}
                  value={state.expectedOutcome}
                  onChange={(e) => set("expectedOutcome", e.target.value)}
                  placeholder="Describe the expected outcome of this activity..."
                />
              </Field>
            </div>
          )}

          {tab === "kpi" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="KPI name *" htmlFor={id("kpi-name")} icon={<Gauge className="h-3.5 w-3.5" />}>
                <Input id={id("kpi-name")} value={state.kpiName} onChange={(e) => set("kpiName", e.target.value)} placeholder="e.g. Customer satisfaction score" />
              </Field>
              <Field label="KPI type" htmlFor={id("kpi-type")}>
                <Select value={state.kpiType} onValueChange={(v) => set("kpiType", v as KpiType)}>
                  <SelectTrigger id={id("kpi-type")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantitative">Quantitative</SelectItem>
                    <SelectItem value="qualitative">Qualitative</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="KPI unit" htmlFor={id("kpi-unit")}>
                <Input id={id("kpi-unit")} value={state.kpiUnit} onChange={(e) => set("kpiUnit", e.target.value)} placeholder="e.g. %, KES, count" />
              </Field>
              <Field label="Measurement frequency" htmlFor={id("kpi-frequency")}>
                <Select value={state.kpiFrequency} onValueChange={(v) => set("kpiFrequency", v as FormState["kpiFrequency"])}>
                  <SelectTrigger id={id("kpi-frequency")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Semi-Annual">Semi-Annual</SelectItem>
                    <SelectItem value="Annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Baseline value" htmlFor={id("kpi-baseline")}>
                <Input id={id("kpi-baseline")} value={state.kpiBaseline} onChange={(e) => set("kpiBaseline", e.target.value)} placeholder="0" />
              </Field>
              <Field label="Target value *" htmlFor={id("kpi-target")}>
                <Input id={id("kpi-target")} value={state.kpiTarget} onChange={(e) => set("kpiTarget", e.target.value)} placeholder="100" />
              </Field>
              <Field label="Current value" htmlFor={id("kpi-current")}>
                <Input id={id("kpi-current")} value={state.kpiCurrent} onChange={(e) => set("kpiCurrent", e.target.value)} placeholder="0" />
              </Field>
            </div>
          )}

          {tab === "timeline" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Start date *" htmlFor={id("start")} icon={<CalendarIcon className="h-3.5 w-3.5" />}>
                <Input id={id("start")} type="date" value={state.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </Field>
              <Field label="End date *" htmlFor={id("end")}>
                <Input id={id("end")} type="date" value={state.endDate} onChange={(e) => set("endDate", e.target.value)} />
              </Field>
              <Field label="Priority" htmlFor={id("priority")}>
                <Select value={state.priority} onValueChange={(v) => set("priority", v as FormState["priority"])}>
                  <SelectTrigger id={id("priority")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Budget" htmlFor={id("budget")}>
                <Input id={id("budget")} value={state.budget} onChange={(e) => set("budget", e.target.value)} placeholder="0" />
              </Field>
              <Field label="Remarks / notes" htmlFor={id("remarks")} className="md:col-span-2">
                <Textarea id={id("remarks")} rows={3} value={state.remarks} onChange={(e) => set("remarks", e.target.value)} placeholder="Any additional context..." />
              </Field>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" onClick={reset} type="button">
            <RotateCcw /> Clear
          </Button>
          {tab !== "timeline" ? (
            <Button size="sm" onClick={() => setTab(tab === "basic" ? "kpi" : "timeline")} type="button">
              Next →
            </Button>
          ) : (
            <Button variant="brand" size="sm" onClick={submit} type="button">
              <Send /> Submit entry
            </Button>
          )}
        </CardFooter>
      </Tabs>
    </Card>
  );
};

const Field = ({
  label,
  htmlFor,
  icon,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <div className={`space-y-1.5 ${className ?? ""}`}>
    <Label htmlFor={htmlFor} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      {label}
    </Label>
    {children}
  </div>
);
