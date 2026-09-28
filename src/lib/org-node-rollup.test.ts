import { computeOrgNodeStrategyCounts, computeOrgNodeStrategyRollup } from "./org-node-rollup";
import type { StrategyTreeNode } from "./strategy-formulation-types";

const node = (over: Partial<StrategyTreeNode> & Pick<StrategyTreeNode, "id" | "type">): StrategyTreeNode => ({
  organizationId: "org-1",
  orgNodeId: null,
  parentElementId: null,
  versionId: `v-${over.id}`,
  version: 1,
  current: true,
  status: "PUBLISHED",
  approvalStatus: null,
  title: over.id,
  description: null,
  outcomeSummary: null,
  targetValue: null,
  unit: null,
  periodStart: null,
  periodEnd: null,
  children: [],
  ...over,
});

// pillar > objective (Finance) > initiative, with the initiative scoped to Claims.
const tree: StrategyTreeNode[] = [
  node({
    id: "p1",
    type: "PILLAR",
    children: [
      node({
        id: "o1",
        type: "OBJECTIVE",
        orgNodeId: "dept-finance",
        children: [
          node({ id: "i1", type: "INITIATIVE", orgNodeId: "dept-claims", parentElementId: "o1", approvalStatus: "APPROVED" }),
          node({ id: "i2", type: "INITIATIVE", orgNodeId: null, parentElementId: "o1", approvalStatus: "PENDING" }),
        ],
      }),
    ],
  }),
  node({
    id: "o2",
    type: "OBJECTIVE",
    orgNodeId: "dept-legal",
    children: [node({ id: "i3", type: "INITIATIVE", orgNodeId: "dept-legal", parentElementId: "o2", approvalStatus: "REJECTED" })],
  }),
];

describe("computeOrgNodeStrategyRollup", () => {
  it("returns zeroes for an empty scope", () => {
    expect(computeOrgNodeStrategyRollup(tree, new Set())).toEqual({
      objectiveCount: 0,
      initiativeCount: 0,
      approved: 0,
      awaitingApproval: 0,
      revisionRequested: 0,
      rejected: 0,
      draft: 0,
    });
  });

  it("counts the node's own elements and those of its descendants", () => {
    const rollup = computeOrgNodeStrategyRollup(tree, new Set(["dept-finance", "dept-claims"]));

    expect(rollup.objectiveCount).toBe(1);
    expect(rollup.initiativeCount).toBe(2);
    expect(rollup.approved).toBe(1);
    expect(rollup.awaitingApproval).toBe(1);
  });

  it("counts an initiative with no unit of its own when its objective is in scope", () => {
    // i2 has orgNodeId null, so only the parent linkage can bring it in; its
    // sibling i1 belongs to a different unit and must stay out.
    const scoped = computeOrgNodeStrategyRollup(
      [node({ id: "o1", type: "OBJECTIVE", orgNodeId: "dept-x", children: [
        node({ id: "i2", type: "INITIATIVE", orgNodeId: null, parentElementId: "o1", approvalStatus: "PENDING" }),
      ] })],
      new Set(["dept-x"]),
    );
    expect(scoped.initiativeCount).toBe(1);
    expect(scoped.awaitingApproval).toBe(1);

    // The same objective's initiative scoped to another unit still counts,
    // because the objective it hangs off is in scope.
    const viaParent = computeOrgNodeStrategyRollup(
      [node({ id: "o1", type: "OBJECTIVE", orgNodeId: "dept-x", children: [
        node({ id: "i1", type: "INITIATIVE", orgNodeId: "dept-y", parentElementId: "o1", approvalStatus: "APPROVED" }),
      ] })],
      new Set(["dept-x"]),
    );
    expect(viaParent.initiativeCount).toBe(1);
    expect(viaParent.approved).toBe(1);
  });

  it("excludes elements belonging to sibling units", () => {
    const rollup = computeOrgNodeStrategyRollup(tree, new Set(["dept-legal"]));

    expect(rollup.objectiveCount).toBe(1);
    expect(rollup.initiativeCount).toBe(1);
    expect(rollup.rejected).toBe(1);
  });

  it("buckets an undecided or draft initiative as draft", () => {
    const rollup = computeOrgNodeStrategyRollup(
      [node({ id: "i4", type: "INITIATIVE", orgNodeId: "dept-x", status: "DRAFT" })],
      new Set(["dept-x"]),
    );

    expect(rollup.draft).toBe(1);
    expect(rollup.approved).toBe(0);
  });

  it("maps revision-requested initiatives to their own bucket", () => {
    const rollup = computeOrgNodeStrategyRollup(
      [node({ id: "i5", type: "INITIATIVE", orgNodeId: "dept-x", approvalStatus: "REVISION_REQUESTED" })],
      new Set(["dept-x"]),
    );

    expect(rollup.revisionRequested).toBe(1);
  });

  it("never counts org-wide pillars as unit objectives", () => {
    const rollup = computeOrgNodeStrategyRollup(tree, new Set(["dept-finance", "dept-claims"]));

    expect(rollup.objectiveCount).toBe(1);
  });
});

describe("computeOrgNodeStrategyCounts", () => {
  it("resolves each node against its own descendant set", () => {
    const counts = computeOrgNodeStrategyCounts(
      tree,
      new Map([
        ["dept-finance", new Set(["dept-finance", "dept-claims"])],
        ["dept-claims", new Set(["dept-claims"])],
        ["dept-legal", new Set(["dept-legal"])],
      ]),
    );

    expect(counts.get("dept-finance")).toEqual({ objectives: 1, initiatives: 2 });
    expect(counts.get("dept-claims")).toEqual({ objectives: 0, initiatives: 1 });
    expect(counts.get("dept-legal")).toEqual({ objectives: 1, initiatives: 1 });
  });

  it("returns zeroes rather than dropping a node with no strategy data", () => {
    const counts = computeOrgNodeStrategyCounts([], new Map([["dept-x", new Set(["dept-x"])]]));

    expect(counts.get("dept-x")).toEqual({ objectives: 0, initiatives: 0 });
  });
});
