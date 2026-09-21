import { newActivity, newInitiative, newKpi, newObjective, newPillar, type StrategyConfig } from "@/data/strategyStore";
import { buildActivityRows, filterByScope, groupByPillar, planTotals } from "./formulation-helpers";

function sample(): StrategyConfig {
  const pillar = { ...newPillar(), id: "p1", name: "Customer" };
  const inScope = { ...newObjective("p1"), id: "o1", title: "Grow", linkedOrgNodeIds: ["n1"] };
  const other = { ...newObjective("p1"), id: "o2", title: "Cut cost", linkedOrgNodeIds: ["n9"] };

  const activity = { ...newActivity(), description: "Launch app", owner: "Ada", dueDate: "2026-12-01" };
  const kpiA = { ...newKpi(), name: "NPS", target: "50", unit: "pts" };
  const kpiB = { ...newKpi(), name: "", target: undefined };
  inScope.initiatives = [{ ...newInitiative(), name: "Digital", activities: [activity], kpis: [kpiA, kpiB] }];
  other.initiatives = [{ ...newInitiative(), name: "Empty", activities: [], kpis: [] }];

  return { pillars: [pillar], objectives: [inScope, other] };
}

describe("formulation-helpers", () => {
  it("shows everything to global viewers and only unit-linked objectives to others", () => {
    const cfg = sample();
    expect(filterByScope(cfg, true, new Set())).toBe(cfg);
    expect(filterByScope(cfg, false, new Set(["n1"])).objectives.map((o) => o.id)).toEqual(["o1"]);
    expect(filterByScope(cfg, false, new Set()).objectives).toEqual([]);
  });

  it("groups objectives by pillar and totals the plan", () => {
    const cfg = sample();
    expect(groupByPillar(cfg.objectives).get("p1")).toHaveLength(2);
    expect(planTotals(cfg.objectives)).toEqual({ initiatives: 2, activities: 1, kpis: 2 });
  });

  it("builds one activity row per KPI and skips initiatives with neither", () => {
    const rows = buildActivityRows(sample());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ pillar: "Customer", initiative: "Digital", activity: "Launch app", kpiName: "NPS", target: "50", unit: "pts" });
    expect(rows[1]).toMatchObject({ kpiName: "(unnamed KPI)", target: "—" });
  });
});
