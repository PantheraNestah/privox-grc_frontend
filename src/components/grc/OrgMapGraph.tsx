// Org Map — renders the organisation hierarchy (grouped into Three Lines of
// Defense swim-lanes) as a pannable/zoomable React Flow canvas instead of a
// hand-laid-out flexbox tree. Real SVG edges connect parent → child cards,
// so connectors can never visually desync from the cards the way the old
// CSS-border hack could once trees got wide enough to wrap.
import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import {
  ORG_TYPE_LABELS,
  ORG_TYPE_COLORS,
  OFFERING_KIND_LABELS,
  OFFERING_KIND_COLORS,
  LINE_OF_DEFENSE_SHORT,
  LINE_OF_DEFENSE_COLORS,
  effectiveLod,
  type OrgNode,
} from "@/data/orgStore";
import type { AppUser } from "@/data/userStore";

const CARD_WIDTH = 210;
const CARD_HEIGHT = 108;
const NODE_SEP = 36;
const RANK_SEP = 64;
const LANE_GAP_X = 56;
const LANE_LABEL_HEIGHT = 34;
const LANE_PADDING = 24;
const LANE_MARGIN_BOTTOM = 28;

type OrgCardData = {
  node: OrgNode;
  users: AppUser[];
};

const OrgCardNode = ({ data }: NodeProps & { data: OrgCardData }) => {
  const { node, users } = data;
  const color = ORG_TYPE_COLORS[node.type];
  const offerings = node.offerings ?? [];

  return (
    <div
      className="rounded-lg border bg-card px-3 py-2 shadow-sm text-center"
      style={{ borderColor: `hsl(${color} / 0.45)`, width: CARD_WIDTH }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0 pointer-events-none" />
      <div
        className="text-[9px] font-semibold uppercase tracking-wider mb-1"
        style={{ color: `hsl(${color})` }}
      >
        {ORG_TYPE_LABELS[node.type]}
      </div>
      <div className="text-xs font-semibold text-foreground leading-tight break-words">
        {node.name}
      </div>

      {offerings.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1 justify-center">
          {offerings.map(o => (
            <span
              key={o.id}
              className="text-[9px] font-medium px-1.5 py-0.5 rounded border"
              style={{
                borderColor: `hsl(${OFFERING_KIND_COLORS[o.kind]} / 0.5)`,
                color: `hsl(${OFFERING_KIND_COLORS[o.kind]})`,
                background: `hsl(${OFFERING_KIND_COLORS[o.kind]} / 0.06)`,
              }}
              title={OFFERING_KIND_LABELS[o.kind]}
            >
              {o.label || OFFERING_KIND_LABELS[o.kind]}
            </span>
          ))}
        </div>
      )}

      {users.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1 justify-center">
          {users.map(u => (
            <span
              key={u.id}
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-foreground text-background"
              title={`${u.title || u.role} — ${u.email}`}
            >
              {u.title || u.name}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="opacity-0 pointer-events-none" />
    </div>
  );
};

type LaneGroupData = {
  label: string | null;
  color: string;
  dashed: boolean;
};

const LaneGroupNode = ({ data }: NodeProps & { data: LaneGroupData }) => (
  <div
    className={`w-full h-full rounded-lg ${data.dashed ? "border border-dashed" : "border"}`}
    style={{
      borderColor: `hsl(${data.color} / ${data.dashed ? 0.5 : 0.4})`,
      background: `hsl(${data.color} / ${data.dashed ? 0.03 : 0.05})`,
    }}
  >
    {data.label && (
      <div
        className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded inline-block m-2"
        style={{ background: `hsl(${data.color} / 0.15)`, color: `hsl(${data.color})` }}
      >
        {data.label}
      </div>
    )}
  </div>
);

const nodeTypes: NodeTypes = {
  orgCard: OrgCardNode,
  laneGroup: LaneGroupNode,
};

/** Lays out one subtree (a display-root and everything beneath it, via
 *  `childrenOf`) with dagre, top-to-bottom, and returns its nodes/edges
 *  positioned relative to the subtree's own (0,0) origin, plus its overall
 *  bounding-box size so the caller can pack multiple subtrees side by side. */
function layoutSubtree(
  root: OrgNode,
  childrenOf: Map<string | null, OrgNode[]>,
  usersByNode: Map<string, AppUser[]>,
): { nodes: Node[]; edges: Edge[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: NODE_SEP, ranksep: RANK_SEP });

  const subtreeNodes: OrgNode[] = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    subtreeNodes.push(cur);
    (childrenOf.get(cur.id) ?? []).forEach(k => stack.push(k));
  }

  subtreeNodes.forEach(n => g.setNode(n.id, { width: CARD_WIDTH, height: CARD_HEIGHT }));
  const edges: Edge[] = [];
  subtreeNodes.forEach(n => {
    (childrenOf.get(n.id) ?? []).forEach(child => {
      g.setEdge(n.id, child.id);
      edges.push({
        id: `${n.id}->${child.id}`,
        source: n.id,
        target: child.id,
        type: "smoothstep",
        style: { stroke: "hsl(var(--border))" },
      });
    });
  });

  dagre.layout(g);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  subtreeNodes.forEach(n => {
    const p = g.node(n.id);
    minX = Math.min(minX, p.x - CARD_WIDTH / 2);
    minY = Math.min(minY, p.y - CARD_HEIGHT / 2);
    maxX = Math.max(maxX, p.x + CARD_WIDTH / 2);
    maxY = Math.max(maxY, p.y + CARD_HEIGHT / 2);
  });

  const nodes: Node[] = subtreeNodes.map(n => {
    const p = g.node(n.id);
    return {
      id: n.id,
      type: "orgCard",
      position: { x: p.x - CARD_WIDTH / 2 - minX, y: p.y - CARD_HEIGHT / 2 - minY },
      data: { node: n, users: usersByNode.get(n.id) ?? [] } satisfies OrgCardData,
      draggable: false,
      connectable: false,
    };
  });

  return { nodes, edges, width: maxX - minX, height: maxY - minY };
}

interface OrgMapGraphProps {
  nodes: OrgNode[];
  childrenOf: Map<string | null, OrgNode[]>;
  users: AppUser[];
  onNodeSelect?: (id: string) => void;
}

export const OrgMapGraph = ({ nodes, childrenOf, users, onNodeSelect }: OrgMapGraphProps) => {
  const { flowNodes, flowEdges } = useMemo(() => {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const usersByNode = new Map<string, AppUser[]>();
    users.forEach(u => {
      if (!u.orgNodeId) return;
      const arr = usersByNode.get(u.orgNodeId) ?? [];
      arr.push(u);
      usersByNode.set(u.orgNodeId, arr);
    });

    const roots = childrenOf.get(null) ?? [];

    // Same lane-assignment rule as before: a root goes wholly into one lane
    // unless its direct children carry more than one distinct effective LoD,
    // in which case each direct child becomes its own display-root, placed
    // in its own lane (the parent root itself isn't re-shown — matching the
    // prior behaviour). Because splitting only ever happens at this one
    // level, a subtree's edges never need to cross lanes.
    const lanes: Record<1 | 2 | 3, OrgNode[]> = { 1: [], 2: [], 3: [] };
    const unclassified: OrgNode[] = [];

    roots.forEach(root => {
      const rootLod = effectiveLod(root, byId);
      const directKids = childrenOf.get(root.id) ?? [];
      const kidLods = new Set(directKids.map(k => effectiveLod(k, byId)).filter(Boolean) as (1 | 2 | 3)[]);

      if (rootLod && kidLods.size <= 1) {
        lanes[rootLod].push(root);
      } else if (kidLods.size > 0) {
        directKids.forEach(k => {
          const lod = effectiveLod(k, byId);
          if (lod) lanes[lod].push(k);
          else unclassified.push(k);
        });
      } else {
        unclassified.push(root);
      }
    });

    const bands: { label: string | null; color: string; dashed: boolean; roots: OrgNode[] }[] = [];
    if (unclassified.length > 0) {
      bands.push({ label: "Unclassified — assign a Line of Defense", color: "220 15% 45%", dashed: true, roots: unclassified });
    }
    ([1, 2, 3] as const).forEach(l => {
      if (lanes[l].length > 0) {
        bands.push({ label: LINE_OF_DEFENSE_SHORT[l], color: LINE_OF_DEFENSE_COLORS[l], dashed: false, roots: lanes[l] });
      }
    });

    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];
    let yCursor = 0;
    let overallWidth = 0;

    bands.forEach(band => {
      let xCursor = 0;
      let bandHeight = 0;
      const subtrees = band.roots.map(root => layoutSubtree(root, childrenOf, usersByNode));

      subtrees.forEach(sub => {
        const offsetX = xCursor;
        const offsetY = yCursor + LANE_LABEL_HEIGHT + LANE_PADDING;
        sub.nodes.forEach(n => {
          allNodes.push({ ...n, position: { x: n.position.x + offsetX, y: n.position.y + offsetY } });
        });
        allEdges.push(...sub.edges);
        xCursor += sub.width + LANE_GAP_X;
        bandHeight = Math.max(bandHeight, sub.height);
      });

      const bandWidth = Math.max(xCursor - LANE_GAP_X, 0);
      overallWidth = Math.max(overallWidth, bandWidth);

      allNodes.push({
        id: `band-${band.label ?? "unclassified"}`,
        type: "laneGroup",
        position: { x: -LANE_PADDING, y: yCursor },
        data: { label: band.label, color: band.color, dashed: band.dashed } satisfies LaneGroupData,
        style: {
          width: bandWidth + LANE_PADDING * 2,
          height: bandHeight + LANE_LABEL_HEIGHT + LANE_PADDING * 2,
        },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: -1,
      });

      yCursor += bandHeight + LANE_LABEL_HEIGHT + LANE_PADDING * 2 + LANE_MARGIN_BOTTOM;
    });

    return { flowNodes: allNodes, flowEdges: allEdges };
  }, [nodes, childrenOf, users]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "orgCard") onNodeSelect?.(node.id);
    },
    [onNodeSelect],
  );

  return (
    <div className="h-[600px] rounded-lg border border-border overflow-hidden">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-card" maskColor="hsl(var(--muted) / 0.6)" />
      </ReactFlow>
    </div>
  );
};
