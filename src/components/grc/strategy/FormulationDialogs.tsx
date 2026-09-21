import { useId, useState, type ReactNode } from "react";
import { ClipboardCheck, Gauge, ListChecks, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserPicker } from "@/components/grc/UserPicker";
import type { OrgNode } from "@/data/orgStore";
import {
  newActivity,
  newKpi,
  newOutcome,
  type Activity,
  type Initiative,
  type Kpi,
  type Outcome,
  type StrategicObjective,
  type StrategicPillar,
} from "@/data/strategyStore";

const Field = ({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: ReactNode; className?: string }) => (
  <div className={className ?? "space-y-1.5"}>
    <Label htmlFor={htmlFor} className="text-xs">
      {label}
    </Label>
    {children}
  </div>
);

const Footer = ({ onClose, onSave }: { onClose: () => void; onSave: () => void }) => (
  <DialogFooter>
    <Button variant="outline" onClick={onClose}>
      Cancel
    </Button>
    <Button variant="brand" onClick={onSave}>
      Save
    </Button>
  </DialogFooter>
);

// Each dialog is mounted only while open (parent renders it with a `key`), so
// its draft state starts fresh from the props without a sync effect.

export const PillarDialog = ({
  pillar,
  onClose,
  onSave,
}: {
  pillar: StrategicPillar;
  onClose: () => void;
  onSave: (pillar: StrategicPillar) => void;
}) => {
  const uid = useId();
  const [draft, setDraft] = useState(pillar);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pillar.name ? "Edit pillar" : "New strategic pillar"}</DialogTitle>
          <DialogDescription>Pillars are the high-level themes the entire strategy is built on.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Pillar name *" htmlFor={`${uid}-name`}>
            <Input
              id={`${uid}-name`}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Customer Experience"
            />
          </Field>
          <Field label="Description" htmlFor={`${uid}-desc`}>
            <Textarea
              id={`${uid}-desc`}
              rows={3}
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="What this pillar means for the organisation..."
            />
          </Field>
        </div>
        <Footer onClose={onClose} onSave={() => onSave(draft)} />
      </DialogContent>
    </Dialog>
  );
};

export const ObjectiveDialog = ({
  objective,
  isNew,
  orgNodes,
  onClose,
  onSave,
}: {
  objective: StrategicObjective;
  isNew: boolean;
  orgNodes: OrgNode[];
  onClose: () => void;
  onSave: (objective: StrategicObjective, isNew: boolean) => void;
}) => {
  const uid = useId();
  const [draft, setDraft] = useState(objective);

  const toggleUnit = (id: string) =>
    setDraft((d) => ({
      ...d,
      linkedOrgNodeIds: d.linkedOrgNodeIds.includes(id)
        ? d.linkedOrgNodeIds.filter((x) => x !== id)
        : [...d.linkedOrgNodeIds, id],
    }));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "New objective" : "Edit objective"}</DialogTitle>
          <DialogDescription>Objectives sit under a pillar and group related initiatives.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Objective title *" htmlFor={`${uid}-title`}>
            <Input
              id={`${uid}-title`}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>
          <Field label="Description" htmlFor={`${uid}-desc`}>
            <Textarea
              id={`${uid}-desc`}
              rows={2}
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </Field>
          <div className="space-y-1.5">
            <Label className="text-xs">Linked organisation units</Label>
            <p className="text-[11px] text-muted-foreground">
              Choose the units responsible. Approval routes upward from these units.
            </p>
            <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border p-1.5">
              {orgNodes.length === 0 ? (
                <p className="px-1.5 py-1 text-[11px] italic text-muted-foreground">
                  No org units defined. Set up the org tree in Risk Governance first.
                </p>
              ) : (
                orgNodes.map((node) => (
                  <Label
                    key={node.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs font-normal hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={draft.linkedOrgNodeIds.includes(node.id)}
                      onCheckedChange={() => toggleUnit(node.id)}
                    />
                    <span className="flex-1">{node.name}</span>
                  </Label>
                ))
              )}
            </div>
          </div>
        </div>
        <Footer onClose={onClose} onSave={() => onSave(draft, isNew)} />
      </DialogContent>
    </Dialog>
  );
};

const Subsection = ({
  title,
  icon,
  onAdd,
  children,
}: {
  title: string;
  icon: ReactNode;
  onAdd: () => void;
  children: ReactNode;
}) => (
  <Card className="shadow-none">
    <CardHeader className="flex-row items-center justify-between space-y-0 px-3 py-2">
      <CardTitle className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </CardTitle>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAdd} aria-label={`Add ${title.toLowerCase()}`}>
        <Plus /> Add
      </Button>
    </CardHeader>
    <CardContent className="space-y-3 px-3 pb-3 pt-0 sm:space-y-2">{children}</CardContent>
  </Card>
);

const RemoveButton = ({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) => (
  <Button
    size="icon"
    variant="ghost"
    className={`h-8 w-8 text-destructive hover:text-destructive ${className ?? ""}`}
    onClick={onClick}
    aria-label={label}
  >
    <Trash2 />
  </Button>
);

export const InitiativeDialog = ({
  objectiveId,
  initiative,
  isNew,
  onClose,
  onSave,
}: {
  objectiveId: string;
  initiative: Initiative;
  isNew: boolean;
  onClose: () => void;
  onSave: (objectiveId: string, initiative: Initiative, isNew: boolean) => void;
}) => {
  const uid = useId();
  const [draft, setDraft] = useState(initiative);

  const patchActivity = (id: string, patch: Partial<Activity>) =>
    setDraft((d) => ({ ...d, activities: d.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  const patchOutcome = (id: string, patch: Partial<Outcome>) =>
    setDraft((d) => ({ ...d, outcomes: d.outcomes.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const patchKpi = (id: string, patch: Partial<Kpi>) =>
    setDraft((d) => ({ ...d, kpis: d.kpis.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));

  const addKpi = () =>
    setDraft((d) => {
      const kpi = newKpi("quantitative");
      return { ...d, kpis: [...d.kpis, kpi], linkedKpiIds: [...d.linkedKpiIds, kpi.id] };
    });
  const removeKpi = (id: string) =>
    setDraft((d) => ({
      ...d,
      kpis: d.kpis.filter((k) => k.id !== id),
      linkedKpiIds: d.linkedKpiIds.filter((x) => x !== id),
    }));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "New initiative" : "Edit initiative"}</DialogTitle>
          <DialogDescription>Initiatives execute objectives. Add activities, outcomes and KPIs.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Initiative name *" htmlFor={`${uid}-name`}>
              <Input
                id={`${uid}-name`}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Owner">
              <UserPicker
                value={draft.owner ?? ""}
                onChange={(name) => setDraft({ ...draft, owner: name })}
                placeholder="Select owner..."
              />
            </Field>
            <Field label="Start date" htmlFor={`${uid}-start`}>
              <Input
                id={`${uid}-start`}
                type="date"
                value={draft.startDate ?? ""}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </Field>
            <Field label="Expected completion" htmlFor={`${uid}-end`}>
              <Input
                id={`${uid}-end`}
                type="date"
                value={draft.expectedCompletion ?? ""}
                onChange={(e) => setDraft({ ...draft, expectedCompletion: e.target.value })}
              />
            </Field>
            <Field label="Description" htmlFor={`${uid}-desc`} className="space-y-1.5 md:col-span-2">
              <Textarea
                id={`${uid}-desc`}
                rows={2}
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
          </div>

          <Subsection
            title="Activities"
            icon={<ListChecks className="h-3.5 w-3.5" />}
            onAdd={() => setDraft((d) => ({ ...d, activities: [...d.activities, newActivity()] }))}
          >
            {draft.activities.map((a) => (
              <div key={a.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-12">
                <Input
                  aria-label="Activity description"
                  className="h-8 text-xs sm:col-span-5"
                  placeholder="Activity description"
                  value={a.description}
                  onChange={(e) => patchActivity(a.id, { description: e.target.value })}
                />
                <div className="sm:col-span-3">
                  <UserPicker size="sm" value={a.owner ?? ""} onChange={(name) => patchActivity(a.id, { owner: name })} placeholder="Owner..." />
                </div>
                <Input
                  aria-label="Activity due date"
                  type="date"
                  className="h-8 text-xs sm:col-span-3"
                  value={a.dueDate ?? ""}
                  onChange={(e) => patchActivity(a.id, { dueDate: e.target.value })}
                />
                <RemoveButton
                  label="Remove activity"
                  className="justify-self-end sm:col-span-1"
                  onClick={() => setDraft((d) => ({ ...d, activities: d.activities.filter((x) => x.id !== a.id) }))}
                />
              </div>
            ))}
          </Subsection>

          <Subsection
            title="Expected outcomes"
            icon={<ClipboardCheck className="h-3.5 w-3.5" />}
            onAdd={() => setDraft((d) => ({ ...d, outcomes: [...d.outcomes, newOutcome()] }))}
          >
            {draft.outcomes.map((o) => (
              <div key={o.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-12">
                <Input
                  aria-label="Expected outcome"
                  className="h-8 text-xs sm:col-span-8"
                  placeholder="Expected outcome"
                  value={o.description}
                  onChange={(e) => patchOutcome(o.id, { description: e.target.value })}
                />
                <Input
                  aria-label="Outcome expected date"
                  type="date"
                  className="h-8 text-xs sm:col-span-3"
                  value={o.expectedDate ?? ""}
                  onChange={(e) => patchOutcome(o.id, { expectedDate: e.target.value })}
                />
                <RemoveButton
                  label="Remove outcome"
                  className="justify-self-end sm:col-span-1"
                  onClick={() => setDraft((d) => ({ ...d, outcomes: d.outcomes.filter((x) => x.id !== o.id) }))}
                />
              </div>
            ))}
          </Subsection>

          <Subsection title="KPIs" icon={<Gauge className="h-3.5 w-3.5" />} onAdd={addKpi}>
            {draft.kpis.map((k) => (
              <div key={k.id} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-12">
                <Input
                  aria-label="KPI name"
                  className="col-span-2 h-8 text-xs sm:col-span-4"
                  placeholder="KPI name"
                  value={k.name}
                  onChange={(e) => patchKpi(k.id, { name: e.target.value })}
                />
                <Select value={k.type} onValueChange={(v) => patchKpi(k.id, { type: v as Kpi["type"] })}>
                  <SelectTrigger className="h-8 text-xs sm:col-span-2" aria-label="KPI type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantitative">Quant</SelectItem>
                    <SelectItem value="qualitative">Qual</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  aria-label="KPI target"
                  className="h-8 text-xs sm:col-span-2"
                  placeholder="Target"
                  value={k.target ?? ""}
                  onChange={(e) => patchKpi(k.id, { target: e.target.value })}
                />
                <Input
                  aria-label="KPI unit"
                  className="h-8 text-xs sm:col-span-3"
                  placeholder="Unit"
                  value={k.unit ?? ""}
                  onChange={(e) => patchKpi(k.id, { unit: e.target.value })}
                />
                <RemoveButton label="Remove KPI" className="justify-self-end sm:col-span-1" onClick={() => removeKpi(k.id)} />
              </div>
            ))}
          </Subsection>
        </div>

        <Footer onClose={onClose} onSave={() => onSave(objectiveId, draft, isNew)} />
      </DialogContent>
    </Dialog>
  );
};
