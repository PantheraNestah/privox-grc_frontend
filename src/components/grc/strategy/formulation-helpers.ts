import type { Activity, StrategicObjective, StrategyConfig } from "@/data/strategyStore";

/** Non-global viewers only see objectives linked to their unit (or one below it). */
export function filterByScope(
  cfg: StrategyConfig,
  isGlobalViewer: boolean,
  scopeNodeIds: ReadonlySet<string>,
): StrategyConfig {
  if (isGlobalViewer) return cfg;
  return {
    pillars: cfg.pillars,
    objectives: cfg.objectives.filter(
      (o) => scopeNodeIds.size > 0 && o.linkedOrgNodeIds.some((id) => scopeNodeIds.has(id)),
    ),
  };
}

export function groupByPillar(objectives: StrategicObjective[]): Map<string, StrategicObjective[]> {
  const map = new Map<string, StrategicObjective[]>();
  for (const objective of objectives) {
    map.set(objective.pillarId, [...(map.get(objective.pillarId) ?? []), objective]);
  }
  return map;
}

export interface PlanTotals {
  initiatives: number;
  activities: number;
  kpis: number;
}

export function planTotals(objectives: StrategicObjective[]): PlanTotals {
  const totals: PlanTotals = { initiatives: 0, activities: 0, kpis: 0 };
  for (const objective of objectives) {
    for (const initiative of objective.initiatives) {
      totals.initiatives += 1;
      totals.activities += initiative.activities.length;
      totals.kpis += initiative.kpis.length;
    }
  }
  return totals;
}

export interface ActivityRow {
  pillar: string;
  objective: string;
  initiative: string;
  activity: string;
  owner?: string;
  due?: string;
  kpiName: string;
  target: string;
  unit: string;
}

/** One row per activity × KPI pairing across every initiative that has either. */
export function buildActivityRows(cfg: StrategyConfig): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const pillar of cfg.pillars) {
    for (const objective of cfg.objectives.filter((o) => o.pillarId === pillar.id)) {
      for (const initiative of objective.initiatives) {
        if (initiative.activities.length === 0 && initiative.kpis.length === 0) continue;
        const activities: Activity[] =
          initiative.activities.length > 0
            ? initiative.activities
            : [{ id: "none", description: "—", owner: "", dueDate: "" } as Activity];

        for (const activity of activities) {
          const base = {
            pillar: pillar.name,
            objective: objective.title,
            initiative: initiative.name,
            activity: activity.description || "—",
            owner: activity.owner,
            due: activity.dueDate,
          };
          if (initiative.kpis.length === 0) {
            rows.push({ ...base, kpiName: "—", target: "—", unit: "" });
          } else {
            for (const kpi of initiative.kpis) {
              rows.push({ ...base, kpiName: kpi.name || "(unnamed KPI)", target: kpi.target ?? "—", unit: kpi.unit ?? "" });
            }
          }
        }
      }
    }
  }
  return rows;
}
