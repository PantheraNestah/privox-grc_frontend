/**
 * Client-side export helpers for the Risk Governance org tree.
 *
 * The backend exposes no export endpoint, so the tree that the API already
 * returned (and that the user is authorised to see) is serialised in the
 * browser. CSV is flattened depth-first with a readable hierarchy path; JSON
 * preserves the nested parent/child structure.
 */

import {
  LINE_OF_DEFENSE_LABELS,
  OFFERING_KIND_LABELS,
  ORG_TYPE_LABELS,
  effectiveLod,
  type OrgNode,
} from "@/data/orgStore";

export interface OrgTreeExportRow {
  level: number;
  path: string;
  name: string;
  type: string;
  typeLabel: string;
  parent: string;
  lineOfDefense: string;
  offerings: string;
  description: string;
}

export interface OrgTreeExportNode extends Omit<OrgNode, "offerings" | "lineOfDefense"> {
  typeLabel: string;
  lineOfDefense: string;
  offerings: string;
  children: OrgTreeExportNode[];
}

interface OrderedNode {
  node: OrgNode;
  depth: number;
  path: string;
  parentName: string;
}

const CSV_COLUMNS: { key: keyof OrgTreeExportRow; label: string }[] = [
  { key: "level", label: "Level" },
  { key: "path", label: "Path" },
  { key: "name", label: "Name" },
  { key: "typeLabel", label: "Type" },
  { key: "type", label: "Type Code" },
  { key: "parent", label: "Parent" },
  { key: "lineOfDefense", label: "Line of Defense" },
  { key: "offerings", label: "Offerings" },
  { key: "description", label: "Description" },
];

/**
 * Group nodes by parent, treating a node whose parent is missing from the set
 * as a root so orphans are still exported instead of being silently dropped.
 */
function groupByParent(nodes: OrgNode[]): Map<string | null, OrgNode[]> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map<string | null, OrgNode[]>();
  for (const node of nodes) {
    const parentId = node.parentId && byId.has(node.parentId) ? node.parentId : null;
    const siblings = childrenOf.get(parentId) ?? [];
    siblings.push(node);
    childrenOf.set(parentId, siblings);
  }
  return childrenOf;
}

function orderedNodes(nodes: OrgNode[]): OrderedNode[] {
  const childrenOf = groupByParent(nodes);
  const ordered: OrderedNode[] = [];
  const visit = (parentId: string | null, depth: number, parentPath: string, parentName: string) => {
    for (const node of childrenOf.get(parentId) ?? []) {
      const path = parentPath ? `${parentPath} / ${node.name}` : node.name;
      ordered.push({ node, depth, path, parentName });
      visit(node.id, depth + 1, path, node.name);
    }
  };
  visit(null, 0, "", "");
  return ordered;
}

function offeringLabel(node: OrgNode): string {
  return (node.offerings ?? [])
    .map((o) => `${OFFERING_KIND_LABELS[o.kind] ?? o.kind}: ${o.label}`)
    .join("; ");
}

/** Flatten the forest depth-first into one row per org unit. */
export function flattenOrgTree(nodes: OrgNode[]): OrgTreeExportRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return orderedNodes(nodes).map(({ node, depth, path, parentName }) => {
    const lod = effectiveLod(node, byId);
    return {
      level: depth + 1,
      path,
      name: node.name,
      type: node.type,
      typeLabel: ORG_TYPE_LABELS[node.type] ?? node.type,
      parent: parentName,
      lineOfDefense: lod ? LINE_OF_DEFENSE_LABELS[lod] : "",
      offerings: offeringLabel(node),
      description: node.description ?? "",
    };
  });
}

/** RFC-4180-ish cell quoting: only quote when the value needs it. */
function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function orgNodesToCsv(nodes: OrgNode[]): string {
  const rows = flattenOrgTree(nodes);
  const header = CSV_COLUMNS.map((c) => csvCell(c.label)).join(",");
  const body = rows.map((row) => CSV_COLUMNS.map((c) => csvCell(row[c.key])).join(","));
  return [header, ...body].join("\r\n");
}

export function orgNodesToJson(
  nodes: OrgNode[],
  meta: Record<string, unknown> = {},
): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = groupByParent(nodes);
  const build = (parentId: string | null): OrgTreeExportNode[] =>
    (childrenOf.get(parentId) ?? []).map((node) => {
      const lod = effectiveLod(node, byId);
      return {
        ...node,
        typeLabel: ORG_TYPE_LABELS[node.type] ?? node.type,
        lineOfDefense: lod ? LINE_OF_DEFENSE_LABELS[lod] : "",
        offerings: offeringLabel(node),
        children: build(node.id),
      };
    });

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      ...meta,
      nodeCount: nodes.length,
      tree: build(null),
    },
    null,
    2,
  );
}

/** Trigger a browser download of `contents` as `filename`. */
export function downloadTextFile(
  filename: string,
  contents: string,
  mimeType: string,
): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
