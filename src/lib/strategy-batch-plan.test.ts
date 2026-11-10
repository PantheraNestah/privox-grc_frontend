import {
  allPlanKeys,
  collectPlanDrift,
  countPlanByType,
  countPlanOrgUnits,
  filterPlanTree,
  flattenPlan,
  matchesPlanSearch,
  planHasDrift,
  planNodeLabel,
  resultForPlanNode,
} from "./strategy-batch-plan";
import { liveAppliedBatchDetail, liveBatchDetail } from "./strategy-batches.fixture";
import type { BatchPlanNode } from "./strategy-batches";

const plan = liveBatchDetail.plan;
const rows = flattenPlan(plan);
const [, objective, initiative, kpi] = rows.map((row) => row.node);

describe("flattenPlan", () => {
  it("walks the plan in display order with depth and stable keys", () => {
    const rows = flattenPlan(plan);

    expect(rows.map((row) => row.node.code)).toEqual(["GNB27-P1", "GNB27-O1", "GNB27-I1", "GNB27-I1-K1"]);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2, 3]);
    expect(rows.map((row) => row.key)).toEqual(["0", "0/0", "0/0/0", "0/0/0/0"]);
    expect(rows[3].ancestorKeys).toEqual(["0", "0/0", "0/0/0"]);
    expect(rows[3].ancestorCodes).toEqual(["GNB27-P1", "GNB27-O1", "GNB27-I1"]);
  });

  it("survives a missing or empty plan", () => {
    expect(flattenPlan(null)).toEqual([]);
    expect(flattenPlan([])).toEqual([]);
  });

  it("labels a node by title, then code, then a neutral fallback", () => {
    expect(planNodeLabel({ type: "PILLAR", title: "Trust" } as BatchPlanNode)).toBe("Trust");
    expect(planNodeLabel({ type: "PILLAR", code: "P1" } as BatchPlanNode)).toBe("P1");
    expect(planNodeLabel({ type: "PILLAR" } as BatchPlanNode)).toBe("Untitled element");
  });
});

describe("plan counts", () => {
  it("counts each type in strategy order, leaving out types the plan does not use", () => {
    expect(countPlanByType(plan)).toEqual([
      { type: "PILLAR", label: "Pillar", count: 1 },
      { type: "OBJECTIVE", label: "Objective", count: 1 },
      { type: "INITIATIVE", label: "Initiative", count: 1 },
      { type: "KPI", label: "KPI", count: 1 },
    ]);
  });

  it("counts distinct organization units, not nodes", () => {
    // The initiative and its KPI inherit the department, so there are two units.
    expect(countPlanOrgUnits(plan)).toBe(2);
    expect(countPlanOrgUnits([])).toBe(0);
  });
});

describe("organization drift", () => {
  it("finds the nodes whose unit moved after submission", () => {
    const drift = collectPlanDrift(plan);

    expect(drift).toHaveLength(1);
    expect(drift[0].node.code).toBe("GNB27-I1");
    expect(drift[0].node.currentPath).toMatch(/reorganised/);
    expect(planHasDrift(plan)).toBe(true);
    expect(planHasDrift([])).toBe(false);
  });
});

describe("applied results", () => {
  it("matches the result by code first", () => {
    expect(resultForPlanNode(rows[0].node, liveAppliedBatchDetail.result)?.action).toBe("CREATE");
    expect(resultForPlanNode(objective, liveAppliedBatchDetail.result)?.action).toBe("UNCHANGED");
  });

  it("falls back to the element id when a node has no code", () => {
    const node: BatchPlanNode = {
      type: "ACTIVITY",
      elementId: "04a2c290-2998-4c3c-bdd8-b6085a945ea7",
    };
    expect(resultForPlanNode(node, liveAppliedBatchDetail.result)?.action).toBe("CREATE");
  });

  it("returns null before the batch is applied", () => {
    expect(resultForPlanNode(rows[0].node, {})).toBeNull();
    expect(resultForPlanNode(rows[0].node, null)).toBeNull();
  });
});

describe("filtering the plan", () => {
  it("keeps the ancestors of a match so the tree still makes sense", () => {
    const filtered = filterPlanTree(plan, (node) => node.code === "GNB27-I1-K1");

    expect(filtered).toHaveLength(1);
    expect(filtered[0].code).toBe("GNB27-P1");
    expect(filtered[0].children?.[0].code).toBe("GNB27-O1");
    expect(filtered[0].children?.[0].children?.[0].code).toBe("GNB27-I1");
    expect(filtered[0].children?.[0].children?.[0].children?.[0].code).toBe("GNB27-I1-K1");
  });

  it("searches titles, codes, org units and descriptions, ignoring case", () => {
    expect(matchesPlanSearch(rows[0].node, "RESILIENT")).toBe(true);
    expect(matchesPlanSearch(initiative, "corporate credit")).toBe(true);
    expect(matchesPlanSearch(kpi, "days")).toBe(true);
    expect(matchesPlanSearch(rows[0].node, "no such thing")).toBe(false);
    expect(matchesPlanSearch(rows[0].node, "  ")).toBe(true);
  });

  it("lists every key for expand all", () => {
    expect([...allPlanKeys(plan)]).toEqual(["0", "0/0", "0/0/0", "0/0/0/0"]);
  });
});
