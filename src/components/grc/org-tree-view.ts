/**
 * View-model for the org-tree visualizer: the plain-data node shape the canvas
 * renders, plus the pure builders and palette helpers that produce it.
 *
 * These live apart from `OrgTreeGraph` (the React Flow component) so both can
 * be imported without dragging the chart's dependencies in, and so the module
 * exporting the component exports only a component — see
 * react-refresh/only-export-components.
 */

export interface OrgTreeViewNode {
  id: string;
  name: string;
  /** Short uppercase label, e.g. COMPANY / DEPARTMENT. Drives the accent color. */
  typeLabel?: string;
  description?: string | null;
  location?: string | null;
  headcount?: number | null;
  costCenterCode?: string | null;
  children: OrgTreeViewNode[];
}

const TYPE_PALETTE = [
  "210 61% 49%",
  "352 70% 61%",
  "158 53% 49%",
  "34 89% 61%",
  "265 88% 66%",
  "192 60% 53%",
  "231 51% 50%",
  "229 81% 60%",
];

export function colorForType(typeLabel: string | undefined): string {
  if (!typeLabel) return "220 15% 45%";
  let hash = 0;
  for (let i = 0; i < typeLabel.length; i += 1) {
    hash = (hash * 31 + typeLabel.charCodeAt(i)) % 997;
  }
  return TYPE_PALETTE[hash % TYPE_PALETTE.length];
}

/** Total number of descendants beneath a node. */
export function descendantCount(node: OrgTreeViewNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + descendantCount(child);
  }
  return count;
}

/** The flat `List<OrgNodeResponse>` fields the tree can display. */
export interface FlatRow {
  id: string;
  parentId: string | null;
  name: string;
  type?: string | null;
  description?: string | null;
  location?: string | null;
  headcount?: number | null;
  costCenterCode?: string | null;
}

/** Builds the display tree from a flat `List<OrgNodeResponse>` (parent → children). */
export function flatOrgNodesToView(rows: FlatRow[]): OrgTreeViewNode[] {
  const childrenOf = new Map<string | null, FlatRow[]>();
  rows.forEach((row) => {
    const key = row.parentId ?? null;
    const bucket = childrenOf.get(key) ?? [];
    bucket.push(row);
    childrenOf.set(key, bucket);
  });
  return (childrenOf.get(null) ?? []).map(function build(row): OrgTreeViewNode {
    return {
      id: row.id,
      name: row.name,
      typeLabel: row.type ?? undefined,
      description: row.description,
      location: row.location,
      headcount: row.headcount,
      costCenterCode: row.costCenterCode,
      children: (childrenOf.get(row.id) ?? []).map(build),
    };
  });
}

/** Builds the display tree from the recursive template preview node. */
export function templatePreviewToView(root: {
  id: string;
  name: string;
  type?: string | null;
  description?: string | null;
  location?: string | null;
  headcount?: number | null;
  costCenterCode?: string | null;
  children?: unknown[];
}): OrgTreeViewNode {
  const children = (root.children ?? []).map((child) =>
    templatePreviewToView(child as Parameters<typeof templatePreviewToView>[0]),
  );
  return {
    id: root.id,
    name: root.name,
    typeLabel: root.type ?? undefined,
    description: root.description,
    location: root.location,
    headcount: root.headcount,
    costCenterCode: root.costCenterCode,
    children,
  };
}
