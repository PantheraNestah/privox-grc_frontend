import type { OrgNodeType } from "./governance-types";
import type { OrgTreeViewNode } from "@/components/grc/OrgTreeGraph";

export const NODE_TYPES: OrgNodeType[] = [
  "GROUP",
  "COMPANY",
  "DEPARTMENT",
  "DIVISION",
  "SECTION",
  "PROCESS",
  "SUB_PROCESS",
];

export interface TreeNode {
  id: string;
  name: string;
  type: OrgNodeType;
  description: string;
  children: TreeNode[];
}

export interface RawOrgNode {
  name: string;
  type: string;
  description?: string | null;
  children?: RawOrgNode[];
}

let nodeIdCounter = 0;
function newNodeId() {
  nodeIdCounter += 1;
  return `node-${Date.now()}-${nodeIdCounter}`;
}

export function makeNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: newNodeId(),
    name: "",
    type: "DEPARTMENT",
    description: "",
    children: [],
    ...overrides,
  };
}

export function makeExampleTree(): TreeNode {
  return makeNode({
    name: "Group",
    type: "GROUP",
    description: "Root of the standard tree",
    children: [
      makeNode({ name: "Finance", type: "DEPARTMENT" }),
      makeNode({
        name: "Operations",
        type: "DIVISION",
        children: [makeNode({ name: "Claims Processing", type: "SECTION" })],
      }),
    ],
  });
}

export function toRawNode(node: TreeNode): RawOrgNode {
  return {
    name: node.name.trim(),
    type: node.type,
    description: node.description.trim() || undefined,
    children: node.children.length ? node.children.map(toRawNode) : undefined,
  };
}

export function fromRawNode(raw: unknown): TreeNode {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const type = NODE_TYPES.includes(record.type as OrgNodeType)
    ? (record.type as OrgNodeType)
    : "DEPARTMENT";
  const children = Array.isArray(record.children) ? record.children.map(fromRawNode) : [];
  return makeNode({
    name: typeof record.name === "string" ? record.name : "",
    type,
    description: typeof record.description === "string" ? record.description : "",
    children,
  });
}

export function updateNode(tree: TreeNode, id: string, patch: Partial<TreeNode>): TreeNode {
  if (tree.id === id) return { ...tree, ...patch };
  return { ...tree, children: tree.children.map((c) => updateNode(c, id, patch)) };
}

export function addChild(tree: TreeNode, parentId: string, child: TreeNode = makeNode()): TreeNode {
  if (tree.id === parentId) return { ...tree, children: [...tree.children, child] };
  return { ...tree, children: tree.children.map((c) => addChild(c, parentId, child)) };
}

export function removeNode(tree: TreeNode, id: string): TreeNode {
  return {
    ...tree,
    children: tree.children.filter((c) => c.id !== id).map((c) => removeNode(c, id)),
  };
}

function cloneWithNewIds(node: TreeNode): TreeNode {
  return { ...node, id: newNodeId(), children: node.children.map(cloneWithNewIds) };
}

/** Inserts a deep copy (fresh ids) right after the original, as a sibling. */
export function duplicateNode(tree: TreeNode, id: string): TreeNode {
  const index = tree.children.findIndex((c) => c.id === id);
  if (index >= 0) {
    const original = tree.children[index];
    const copy = cloneWithNewIds({ ...original, name: original.name ? `${original.name} (copy)` : "" });
    const children = [...tree.children];
    children.splice(index + 1, 0, copy);
    return { ...tree, children };
  }
  return { ...tree, children: tree.children.map((c) => duplicateNode(c, id)) };
}

/** Swaps a node with its previous (-1) or next (+1) sibling. */
export function moveNode(tree: TreeNode, id: string, direction: -1 | 1): TreeNode {
  const index = tree.children.findIndex((c) => c.id === id);
  if (index >= 0) {
    const target = index + direction;
    if (target < 0 || target >= tree.children.length) return tree;
    const children = [...tree.children];
    [children[index], children[target]] = [children[target], children[index]];
    return { ...tree, children };
  }
  return { ...tree, children: tree.children.map((c) => moveNode(c, id, direction)) };
}

export function countNodes(node: TreeNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

export function treeDepth(node: TreeNode): number {
  return 1 + node.children.reduce((max, child) => Math.max(max, treeDepth(child)), 0);
}

/** Ids of every node that has children (used for expand/collapse all). */
export function parentIds(node: TreeNode): string[] {
  return node.children.length ? [node.id, ...node.children.flatMap(parentIds)] : [];
}

/** Ids from the root down to (but excluding) the node with `id`; null if absent. */
export function ancestorIds(tree: TreeNode, id: string): string[] | null {
  if (tree.id === id) return [];
  for (const child of tree.children) {
    const path = ancestorIds(child, id);
    if (path) return [tree.id, ...path];
  }
  return null;
}

export function emptyNameIds(node: TreeNode): Set<string> {
  const ids = new Set<string>();
  const visit = (n: TreeNode) => {
    if (!n.name.trim()) ids.add(n.id);
    n.children.forEach(visit);
  };
  visit(node);
  return ids;
}

export function validateTree(node: TreeNode, path = "root"): string | null {
  if (!node.name.trim()) return `${path} needs a name`;
  for (let i = 0; i < node.children.length; i += 1) {
    const error = validateTree(node.children[i], `${path} › child ${i + 1}`);
    if (error) return error;
  }
  return null;
}

/** Display tree for the shared React Flow visualiser. */
export function toViewNode(node: TreeNode): OrgTreeViewNode {
  return {
    id: node.id,
    name: node.name.trim() || "Untitled",
    typeLabel: node.type,
    description: node.description.trim() || null,
    children: node.children.map(toViewNode),
  };
}
