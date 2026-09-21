// OrgTreeGraph — shared, richer organization-tree visualizer.
//
// Horizontal (left→right) org-chart layout on a React Flow canvas using dagre,
// with collapsible sublevels, per-node chips (headcount, location, cost centre),
// pan/zoom/minimap and click-to-select. Used by:
//   - the platform-admin template preview ("hierarchy" mode)
//   - the tenant OrganizationDetails "Organization map" card
//   - anything else that can present a tree of {id, name, ...} nodes
import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Handle,
  MiniMap,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { ChevronDown, ChevronRight, MapPin, Users, Wallet } from "lucide-react";

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

const CARD_WIDTH = 250;
const CARD_HEIGHT = 96;
const NODE_SEP = 26;
const RANK_SEP = 64;

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

interface OrgTreeNodeData {
  name: string;
  typeLabel?: string;
  color: string;
  description?: string | null;
  location?: string | null;
  headcount?: number | null;
  costCenterCode?: string | null;
  hasChildren: boolean;
  collapsed: boolean;
  hiddenCount: number;
}

const OrgTreeNode = ({ data }: NodeProps & { data: OrgTreeNodeData }) => (
  <div
    className="rounded-lg border bg-card shadow-sm"
    style={{
      borderColor: `hsl(${data.color} / 0.45)`,
      width: CARD_WIDTH,
      minHeight: CARD_HEIGHT - 24,
    }}
  >
    <Handle type="target" position={Position.Left} className="opacity-0 pointer-events-none" />
    <div className="flex items-center gap-1.5 px-2.5 pt-1.5">
      {data.hasChildren ? (
        <span className="inline-flex items-center p-0.5 rounded cursor-pointer hover:bg-muted transition-colors">
          {data.collapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </span>
      ) : (
        <span className="inline-block w-3.5" />
      )}
      {data.typeLabel && (
        <span
          className="text-[9px] font-semibold uppercase tracking-wider"
          style={{ color: `hsl(${data.color})` }}
        >
          {data.typeLabel}
        </span>
      )}
    </div>
    <div className="px-2.5 pb-2">
      <p className="text-xs font-semibold text-foreground leading-tight break-words">{data.name}</p>
      {data.description && (
        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{data.description}</p>
      )}
      {(data.headcount != null || data.location || data.costCenterCode) && (
        <div className="flex flex-wrap items-center gap-1 mt-1">
          {data.headcount != null && data.headcount > 0 && (
            <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded border border-border bg-muted text-foreground">
              <Users className="w-2.5 h-2.5" /> {data.headcount}
            </span>
          )}
          {data.location && (
            <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded border border-border bg-muted text-foreground max-w-[90px]">
              <MapPin className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{data.location}</span>
            </span>
          )}
          {data.costCenterCode && (
            <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded border border-border bg-muted text-foreground">
              <Wallet className="w-2.5 h-2.5" /> {data.costCenterCode}
            </span>
          )}
        </div>
      )}
      {data.collapsed && data.hasChildren && data.hiddenCount > 0 && (
        <p className="text-[10px] text-blue-600 font-medium mt-1">+{data.hiddenCount} below — expand</p>
      )}
    </div>
    <Handle type="source" position={Position.Right} className="opacity-0 pointer-events-none" />
  </div>
);

const nodeTypes: NodeTypes = { orgTreeNode: OrgTreeNode };

interface OrgTreeGraphProps {
  /** Top-level nodes (display roots). */
  roots: OrgTreeViewNode[];
  className?: string;
  onNodeClick?: (id: string) => void;
}

export const OrgTreeGraph = ({ roots, className, onNodeClick }: OrgTreeGraphProps) => {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { cards, edges } = useMemo(() => {
    const visible: OrgTreeViewNode[] = [];
    const pairs: { from: string; to: string }[] = [];

    const visit = (node: OrgTreeViewNode) => {
      visible.push(node);
      const isCollapsed = collapsedIds.has(node.id);
      node.children.forEach((child) => {
        pairs.push({ from: node.id, to: child.id });
        if (!isCollapsed) visit(child);
      });
    };
    roots.forEach(visit);

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: NODE_SEP, ranksep: RANK_SEP });
    visible.forEach((n) => g.setNode(n.id, { width: CARD_WIDTH, height: CARD_HEIGHT }));
    pairs.forEach(({ from, to }) => g.setEdge(from, to));
    dagre.layout(g);

    const cards: Node[] = visible.map((n) => {
      const p = g.node(n.id);
      return {
        id: n.id,
        type: "orgTreeNode",
        position: { x: p.x - CARD_WIDTH / 2, y: p.y - CARD_HEIGHT / 2 },
        data: {
          name: n.name,
          typeLabel: n.typeLabel,
          color: colorForType(n.typeLabel),
          description: n.description,
          location: n.location,
          headcount: n.headcount,
          costCenterCode: n.costCenterCode,
          hasChildren: n.children.length > 0,
          collapsed: collapsedIds.has(n.id),
          hiddenCount: collapsedIds.has(n.id) ? descendantCount(n) : 0,
        } satisfies OrgTreeNodeData,
        draggable: false,
        connectable: false,
      };
    });

    const edgeList: Edge[] = pairs.map(({ from, to }) => ({
      id: `${from}->${to}`,
      source: from,
      target: to,
      type: "smoothstep",
      style: { stroke: "hsl(var(--border))" },
    }));

    return { cards, edges: edgeList };
  }, [roots, collapsedIds]);

  return (
    <div className={className}>
      <ReactFlow
        nodes={cards}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick?.(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.12}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} className="!bg-card" />
        <MiniMap pannable zoomable className="!bg-card" maskColor="hsl(var(--muted) / 0.6)" />
      </ReactFlow>
    </div>
  );
};

// ── Adapters: flat API list and template preview → shared view model ──

type FlatRow = {
  id: string;
  parentId: string | null;
  name: string;
  type?: string | null;
  description?: string | null;
  location?: string | null;
  headcount?: number | null;
  costCenterCode?: string | null;
};

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
