import type { StrategyTreeNode } from "@/lib/strategy-formulation-types";
import {
  countStrategyTypes,
  elementCompletion,
  flattenStrategyTree,
  strategyReadiness,
} from "@/lib/strategy-formulation-view";

function node(overrides: Partial<StrategyTreeNode>): StrategyTreeNode {
  return {
    id: "element-1",
    organizationId: "org-1",
    orgNodeId: null,
    parentElementId: null,
    type: "PILLAR",
    versionId: "version-1",
    version: 1,
    current: true,
    title: "Pillar",
    description: "Description",
    outcomeSummary: null,
    targetValue: null,
    unit: null,
    periodStart: null,
    periodEnd: null,
    status: "PUBLISHED",
    children: [],
    ...overrides,
  };
}

describe("strategy formulation view model", () => {
  it("flattens the tree with depth and ancestry", () => {
    const rows = flattenStrategyTree([
      node({
        children: [
          node({
            id: "objective-1",
            type: "OBJECTIVE",
            title: "Objective",
            children: [node({ id: "activity-1", type: "ACTIVITY", title: "Activity" })],
          }),
        ],
      }),
    ]);

    expect(rows.map((row) => [row.node.id, row.depth, row.path])).toEqual([
      ["element-1", 0, ["Pillar"]],
      ["objective-1", 1, ["Pillar", "Objective"]],
      ["activity-1", 2, ["Pillar", "Objective", "Activity"]],
    ]);
  });

  it("counts stable elements and reports missing nullable fields", () => {
    const tree = [
      node({
        children: [
          node({
            id: "kpi-1",
            type: "KPI",
            orgNodeId: "node-1",
            targetValue: null,
            unit: null,
            periodStart: "2026-01-01",
            periodEnd: "2026-12-31",
          }),
        ],
      }),
    ];

    expect(countStrategyTypes(tree)).toEqual({
      PILLAR: 1,
      OBJECTIVE: 0,
      INITIATIVE: 0,
      ACTIVITY: 0,
      KPI: 1,
    });
    expect(elementCompletion(tree[0].children[0])).toEqual({
      score: 60,
      complete: 3,
      total: 5,
      missing: ["target", "unit"],
    });
  });

  it("returns zero readiness for an empty strategy", () => {
    expect(strategyReadiness([])).toBe(0);
  });
});
