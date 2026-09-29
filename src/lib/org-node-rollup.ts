/**
 * Rolls the strategy-formulation tree up to an org node.
 *
 * The org tree and the strategy tree are two independent hierarchies linked by
 * a single foreign key: every strategy element carries the `orgNodeId` of the
 * unit it is scoped to (pillars are org-wide and have none). Neither API can
 * roll up on its own — `/summary` and `/insights` are org-wide with no query
 * parameters, and `/elements?orgNodeId=` matches one node exactly — so the
 * subtree intersection is computed here from the tree the client already loads.
 */

import { flattenStrategyTree } from "@/lib/strategy-formulation-view";
import type { StrategyTreeNode } from "@/lib/strategy-formulation-types";

export interface OrgNodeStrategyRollup {
  objectiveCount: number;
  initiativeCount: number;
  /** Initiatives by maker-checker state, for the progress breakdown. */
  approved: number;
  awaitingApproval: number;
  revisionRequested: number;
  rejected: number;
  draft: number;
}

export const emptyOrgNodeStrategyRollup: OrgNodeStrategyRollup = {
  objectiveCount: 0,
  initiativeCount: 0,
  approved: 0,
  awaitingApproval: 0,
  revisionRequested: 0,
  rejected: 0,
  draft: 0,
};

/**
 * An objective counts when it is scoped to the node or anything beneath it. An
 * initiative counts on the same test, or when its parent objective is in scope:
 * initiatives are often created without their own unit, and dropping those would
 * hide the work that actually belongs to the unit.
 */
function scopedElements(
  flat: ReturnType<typeof flattenStrategyTree>,
  scopeNodeIds: Set<string>,
) {
  const inScope = new Set<string>();
  const objectiveIds = new Set<string>();
  flat.forEach(({ node }) => {
    if (node.type !== "OBJECTIVE" && node.type !== "INITIATIVE") return;
    const scoped = !!node.orgNodeId && scopeNodeIds.has(node.orgNodeId);
    if (scoped) inScope.add(node.id);
    if (node.type === "OBJECTIVE" && scoped) objectiveIds.add(node.id);
  });
  flat.forEach(({ node }) => {
    if (node.type === "INITIATIVE" && node.parentElementId && objectiveIds.has(node.parentElementId)) {
      inScope.add(node.id);
    }
  });
  return { inScope, flat };
}

export function computeOrgNodeStrategyRollup(
  tree: StrategyTreeNode[],
  descendantIds: Set<string>,
): OrgNodeStrategyRollup {
  if (descendantIds.size === 0) return emptyOrgNodeStrategyRollup;
  const flat = flattenStrategyTree(tree);
  const { inScope } = scopedElements(flat, descendantIds);

  const rollup: OrgNodeStrategyRollup = { ...emptyOrgNodeStrategyRollup };
  flat.forEach(({ node }) => {
    if (!inScope.has(node.id)) return;
    if (node.type === "OBJECTIVE") {
      rollup.objectiveCount += 1;
      return;
    }
    if (node.type !== "INITIATIVE") return;
    rollup.initiativeCount += 1;
    switch (node.approvalStatus) {
      case "APPROVED":
        rollup.approved += 1;
        break;
      case "PENDING":
        rollup.awaitingApproval += 1;
        break;
      case "REVISION_REQUESTED":
        rollup.revisionRequested += 1;
        break;
      case "REJECTED":
        rollup.rejected += 1;
        break;
      default:
        // No decision recorded yet, or the element is still a draft.
        rollup.draft += 1;
    }
  });
  return rollup;
}

/**
 * Per-node roll-up for the org tree's own row counts. Each node is resolved
 * against its own descendant set, so a department reports itself plus its
 * subtree rather than the whole organisation.
 */
export function computeOrgNodeStrategyCounts(
  tree: StrategyTreeNode[],
  descendantsByNode: Map<string, Set<string>>,
): Map<string, { objectives: number; initiatives: number }> {
  const flat = flattenStrategyTree(tree);
  const byId = new Map(flat.map((f) => [f.node.id, f.node]));
  const counts = new Map<string, { objectives: number; initiatives: number }>();
  descendantsByNode.forEach((descendants, nodeId) => {
    const { inScope } = scopedElements(flat, descendants);
    let objectives = 0;
    let initiatives = 0;
    inScope.forEach((id) => {
      const type = byId.get(id)?.type;
      if (type === "OBJECTIVE") objectives += 1;
      if (type === "INITIATIVE") initiatives += 1;
    });
    counts.set(nodeId, { objectives, initiatives });
  });
  return counts;
}
