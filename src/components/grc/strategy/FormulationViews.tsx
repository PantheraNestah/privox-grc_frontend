import { useMemo } from "react";
import { Compass, ListChecks, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/grc/common/states";
import type { OrgNode } from "@/data/orgStore";
import type { Initiative, StrategicObjective, StrategicPillar, StrategyConfig } from "@/data/strategyStore";
import { buildActivityRows, planTotals } from "./formulation-helpers";

const RowActions = ({
  onEdit,
  onDelete,
  label,
}: {
  onEdit: () => void;
  onDelete: () => void;
  label: string;
}) => (
  <div className="flex shrink-0 items-center gap-0.5">
    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} aria-label={`Edit ${label}`}>
      <Pencil />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8 text-destructive hover:text-destructive"
      onClick={onDelete}
      aria-label={`Delete ${label}`}
    >
      <Trash2 />
    </Button>
  </div>
);

// ─── Pillars ──────────────────────────────────────────────

interface PillarsViewProps {
  cfg: StrategyConfig;
  objectivesByPillar: Map<string, StrategicObjective[]>;
  canEditPillars: boolean;
  onAdd: () => void;
  onEdit: (pillar: StrategicPillar) => void;
  onDelete: (id: string) => void;
  onJumpToObjectives: () => void;
}

export const PillarsView = ({
  cfg,
  objectivesByPillar,
  canEditPillars,
  onAdd,
  onEdit,
  onDelete,
  onJumpToObjectives,
}: PillarsViewProps) => {
  if (cfg.pillars.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="No strategic pillars defined yet"
        description="Pillars are created by the Administrator. Once defined, all users can link their objectives, initiatives and activities to them."
        action={
          canEditPillars && (
            <Button variant="brand" size="sm" onClick={onAdd}>
              <Plus /> Add first pillar
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy-deep">Strategic pillars</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {canEditPillars
              ? "You define the organisation's pillars. All users link their work here."
              : "Read-only catalogue defined by the Administrator. Link your objectives in the Objectives tab."}
          </p>
        </div>
        {canEditPillars && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus /> Add pillar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cfg.pillars.map((pillar, idx) => {
          const objectives = objectivesByPillar.get(pillar.id) ?? [];
          const totals = planTotals(objectives);
          return (
            <Card key={pillar.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Pillar {String(idx + 1).padStart(2, "0")}
                </span>
                {canEditPillars && (
                  <div className="-mr-2 -mt-1">
                    <RowActions
                      label={`pillar ${pillar.name || idx + 1}`}
                      onEdit={() => onEdit(pillar)}
                      onDelete={() => onDelete(pillar.id)}
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div>
                  <CardTitle className="line-clamp-2 text-base leading-tight text-navy-deep">
                    {pillar.name || "Untitled pillar"}
                  </CardTitle>
                  {pillar.description && (
                    <CardDescription className="mt-1.5 line-clamp-3 text-xs">{pillar.description}</CardDescription>
                  )}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Objectives", objectives.length],
                    ["Initiatives", totals.initiatives],
                    ["KPIs", totals.kpis],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md bg-muted/50 px-2 py-2">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 text-xl font-semibold leading-none text-navy-deep">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
              <CardFooter className="justify-between pt-0 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5" /> {totals.activities} activities
                </span>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onJumpToObjectives}>
                  View objectives
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// ─── Objectives & initiatives ─────────────────────────────

interface ObjectivesViewProps {
  cfg: StrategyConfig;
  objectivesByPillar: Map<string, StrategicObjective[]>;
  orgNodes: OrgNode[];
  canEditPlan: boolean;
  onAddObjective: (pillarId: string) => void;
  onEditObjective: (objective: StrategicObjective) => void;
  onDeleteObjective: (id: string) => void;
  onAddInitiative: (objectiveId: string) => void;
  onEditInitiative: (objectiveId: string, initiative: Initiative) => void;
  onDeleteInitiative: (objectiveId: string, initiativeId: string) => void;
}

export const ObjectivesView = ({
  cfg,
  objectivesByPillar,
  orgNodes,
  canEditPlan,
  onAddObjective,
  onEditObjective,
  onDeleteObjective,
  onAddInitiative,
  onEditInitiative,
  onDeleteInitiative,
}: ObjectivesViewProps) => {
  const orgNodeMap = useMemo(() => new Map(orgNodes.map((n) => [n.id, n])), [orgNodes]);

  if (cfg.pillars.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="Pillars not yet defined"
        description="An Administrator must create the strategic pillars first."
      />
    );
  }

  return (
    <div className="space-y-8">
      {cfg.pillars.map((pillar) => {
        const objectives = objectivesByPillar.get(pillar.id) ?? [];
        return (
          <section key={pillar.id} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-navy-deep">{pillar.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {objectives.length} objective{objectives.length === 1 ? "" : "s"}
                </p>
              </div>
              {canEditPlan && (
                <Button size="sm" variant="outline" onClick={() => onAddObjective(pillar.id)}>
                  <Plus /> Add objective
                </Button>
              )}
            </div>

            {objectives.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
                No objectives under this pillar yet{canEditPlan ? " — add the first one above." : "."}
              </p>
            ) : (
              <div className="space-y-3">
                {objectives.map((objective) => (
                  <ObjectiveCard
                    key={objective.id}
                    objective={objective}
                    orgNodeMap={orgNodeMap}
                    canEditPlan={canEditPlan}
                    onEdit={() => onEditObjective(objective)}
                    onDelete={() => onDeleteObjective(objective.id)}
                    onAddInitiative={() => onAddInitiative(objective.id)}
                    onEditInitiative={(initiative) => onEditInitiative(objective.id, initiative)}
                    onDeleteInitiative={(initiativeId) => onDeleteInitiative(objective.id, initiativeId)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

interface ObjectiveCardProps {
  objective: StrategicObjective;
  orgNodeMap: Map<string, OrgNode>;
  canEditPlan: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddInitiative: () => void;
  onEditInitiative: (initiative: Initiative) => void;
  onDeleteInitiative: (initiativeId: string) => void;
}

const ObjectiveCard = ({
  objective,
  orgNodeMap,
  canEditPlan,
  onEdit,
  onDelete,
  onAddInitiative,
  onEditInitiative,
  onDeleteInitiative,
}: ObjectiveCardProps) => {
  const totals = planTotals([objective]);
  const linkedUnits = objective.linkedOrgNodeIds
    .slice(0, 5)
    .map((id) => orgNodeMap.get(id))
    .filter((node): node is OrgNode => !!node);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-sm text-navy-deep">{objective.title}</CardTitle>
          {objective.description && (
            <CardDescription className="text-xs">{objective.description}</CardDescription>
          )}
          {linkedUnits.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {linkedUnits.map((node) => (
                <Badge key={node.id} variant="secondary" className="text-[10px] font-normal">
                  {node.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline" className="text-[10px] font-normal">
            {objective.initiatives.length} initiatives
          </Badge>
          {canEditPlan && <RowActions label={`objective ${objective.title}`} onEdit={onEdit} onDelete={onDelete} />}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {objective.initiatives.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Initiatives · {totals.activities} activities · {totals.kpis} KPIs
            </p>
            <ul className="divide-y divide-border rounded-md border border-border">
              {objective.initiatives.map((initiative) => (
                <li key={initiative.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <Rocket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-medium text-navy-deep">{initiative.name}</span>
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">
                    {initiative.activities.length} acts · {initiative.kpis.length} KPIs
                  </span>
                  {initiative.owner && (
                    <span className="hidden text-[11px] text-muted-foreground md:inline">· {initiative.owner}</span>
                  )}
                  {canEditPlan && (
                    <RowActions
                      label={`initiative ${initiative.name}`}
                      onEdit={() => onEditInitiative(initiative)}
                      onDelete={() => onDeleteInitiative(initiative.id)}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {canEditPlan && (
          <Button size="sm" variant="outline" onClick={onAddInitiative}>
            <Plus /> Add initiative
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Activities & KPIs ────────────────────────────────────

export const ActivitiesView = ({ cfg }: { cfg: StrategyConfig }) => {
  const rows = useMemo(() => buildActivityRows(cfg), [cfg]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No activities yet"
        description="Use the Log entry tab to add the first one."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {["Pillar", "Objective", "Initiative", "Activity", "Owner", "Due", "KPI", "Target"].map((heading) => (
              <TableHead key={heading} className="h-10 text-[11px] uppercase tracking-wide">
                {heading}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i} className="text-xs">
              <TableCell className="py-2 text-muted-foreground">{row.pillar}</TableCell>
              <TableCell className="py-2 text-muted-foreground">{row.objective}</TableCell>
              <TableCell className="py-2 font-medium text-navy-deep">{row.initiative}</TableCell>
              <TableCell className="py-2">{row.activity}</TableCell>
              <TableCell className="py-2 text-muted-foreground">{row.owner || "—"}</TableCell>
              <TableCell className="py-2 text-muted-foreground">{row.due || "—"}</TableCell>
              <TableCell className="py-2">{row.kpiName}</TableCell>
              <TableCell className="py-2 text-muted-foreground">
                {row.target}
                {row.unit ? ` ${row.unit}` : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
