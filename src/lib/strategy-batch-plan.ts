/**
 * Reading a staged batch plan.
 *
 * A batch detail returns a nested `plan`, not the report's `tree`: the nodes
 * carry content and the resolved organization unit but no verdict (see issue
 * #46). These helpers flatten, count and filter that plan without React so the
 * tree and the table cannot disagree about what the plan contains.
 */

import type { BatchAction, BatchMode, BatchPlanNode, BatchResultEntry, BatchStatus } from "./strategy-batches";
import { STRATEGY_TYPE_LABELS, STRATEGY_TYPE_ORDER } from "./strategy-formulation-view";

/** A plan node with its position, for rendering and keyboard traversal. */
export interface FlatPlanNode {
  node: BatchPlanNode;
  /** Stable within one plan: the path of child indexes, e.g. "0/2/1". */
  key: string;
  depth: number;
  /** Keys of the ancestors, outermost first. */
  ancestorKeys: string[];
  /** Codes of the ancestors, outermost first; useful for "under X". */
  ancestorCodes: string[];
  /** The immediate parent, when there is one. */
  parent: BatchPlanNode | null;
}

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  SUBMITTED: "Awaiting decision",
  APPROVED: "Applied",
  REJECTED: "Rejected",
  REVISION_REQUESTED: "Revision requested",
};

export function batchModeLabel(mode: BatchMode): string {
  return mode === "UPSERT" ? "Create or update" : "Create only";
}

export const PLAN_ACTION_LABELS: Record<BatchAction, string> = {
  CREATE: "Create",
  NEW_VERSION: "New version",
  UNCHANGED: "Unchanged",
};

/** What to call a plan node when it has no title. */
export function planNodeLabel(node: BatchPlanNode): string {
  return node.title?.trim() || node.code?.trim() || "Untitled element";
}

/** The type as it reads in a sentence, with a fallback for an unknown code. */
export function planTypeLabel(type: string): string {
  return STRATEGY_TYPE_LABELS[type as keyof typeof STRATEGY_TYPE_LABELS] ?? type;
}

/**
 * Depth-first flattening in display order.
 *
 * The key is index-based rather than code-based because a plan node may have a
 * null code (a spreadsheet row with only a title), and because two nodes could
 * in principle repeat a code while the batch is still a draft.
 */
export function flattenPlan(
  nodes: BatchPlanNode[] | null | undefined,
  options: {
    keyPrefix?: string;
    depth?: number;
    ancestorKeys?: string[];
    ancestorCodes?: string[];
    parent?: BatchPlanNode | null;
  } = {},
): FlatPlanNode[] {
  const { keyPrefix = "", depth = 0, ancestorKeys = [], ancestorCodes = [], parent = null } = options;
  const result: FlatPlanNode[] = [];

  (nodes ?? []).forEach((node, index) => {
    const key = keyPrefix ? `${keyPrefix}/${index}` : String(index);
    result.push({ node, key, depth, ancestorKeys, ancestorCodes, parent });
    if (node.children?.length) {
      result.push(
        ...flattenPlan(node.children, {
          keyPrefix: key,
          depth: depth + 1,
          ancestorKeys: [...ancestorKeys, key],
          ancestorCodes: node.code ? [...ancestorCodes, node.code] : ancestorCodes,
          parent: node,
        }),
      );
    }
  });

  return result;
}

/** One entry per element type present, in strategy order. */
export function countPlanByType(
  nodes: BatchPlanNode[] | null | undefined,
): Array<{ type: string; label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const { node } of flattenPlan(nodes)) {
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  }

  const knownTypes: string[] = [...STRATEGY_TYPE_ORDER];
  const extraTypes = [...counts.keys()].filter((type) => !knownTypes.includes(type));
  const ordered = [...knownTypes, ...extraTypes];

  return ordered
    .filter((type) => counts.has(type))
    .map((type) => ({ type, label: planTypeLabel(type), count: counts.get(type)! }));
}

/** Distinct organization units the plan touches. */
export function countPlanOrgUnits(nodes: BatchPlanNode[] | null | undefined): number {
  const units = new Set<string>();
  for (const { node } of flattenPlan(nodes)) {
    const orgNode = node.orgNode;
    if (!orgNode) continue;
    const key = orgNode.id ?? orgNode.path ?? orgNode.name;
    if (key) units.add(key);
  }
  return units.size;
}

/** A node whose organization unit moved or disappeared since submission. */
export interface PlanDrift {
  key: string;
  node: BatchPlanNode;
}

export function collectPlanDrift(nodes: BatchPlanNode[] | null | undefined): PlanDrift[] {
  return flattenPlan(nodes)
    .filter(({ node }) => node.pathChanged === true)
    .map(({ key, node }) => ({ key, node }));
}

export function planHasDrift(nodes: BatchPlanNode[] | null | undefined): boolean {
  return collectPlanDrift(nodes).length > 0;
}

/**
 * Applies the `result` map to one node.
 *
 * `result` is keyed by code, but a node may have no code, so fall back to its
 * element id. Once applied, the node itself also carries `elementId`.
 */
export function resultForPlanNode(
  node: BatchPlanNode,
  result: Record<string, BatchResultEntry> | null | undefined,
): BatchResultEntry | null {
  if (!result) return null;
  if (node.code && result[node.code]) return result[node.code];
  if (node.elementId) {
    return Object.values(result).find((entry) => entry.elementId === node.elementId) ?? null;
  }
  return null;
}

/** Keeps a node when it, or one of its descendants, passes the predicate. */
export function filterPlanTree(
  nodes: BatchPlanNode[] | null | undefined,
  predicate: (node: BatchPlanNode) => boolean,
): BatchPlanNode[] {
  const kept: BatchPlanNode[] = [];

  for (const node of nodes ?? []) {
    const children = filterPlanTree(node.children, predicate);
    if (predicate(node) || children.length > 0) {
      kept.push({ ...node, children });
    }
  }

  return kept;
}

/** Search text across the fields a reviewer would recognise an element by. */
export function matchesPlanSearch(node: BatchPlanNode, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [node.title, node.code, node.type, node.orgNode?.name, node.orgNode?.path, node.description]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

/** Every key in the plan, for "expand all". */
export function allPlanKeys(nodes: BatchPlanNode[] | null | undefined): Set<string> {
  return new Set(flattenPlan(nodes).map(({ key }) => key));
}
