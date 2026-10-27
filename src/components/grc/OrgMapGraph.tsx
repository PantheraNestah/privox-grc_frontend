// Org Map — renders the organisation hierarchy (grouped into Three Lines of
// Defense swim-lanes) as a pannable/zoomable React Flow canvas instead of a
// hand-laid-out flexbox tree. Real SVG edges connect parent → child cards,
// so connectors can never visually desync from the cards the way the old
// CSS-border hack could once trees got wide enough to wrap.
//
// Three presentations share one layout engine:
//   hierarchy — the client-approved org chart: one top-down canvas, navy rules,
//               a filled group root and Line-of-Defense colouring (default).
//   tree      — left→right overview, still grouped into LoD bands.
//   focus     — tree restricted to the units the user picks.
import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  MarkerType,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Check, ChevronsUpDown, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
import {
  HIERARCHY_EDGE,
  HIERARCHY_LEGEND,
  HIERARCHY_TONES,
  hierarchyCardSize,
  hierarchyRole,
  type HierarchyRole,
} from "@/lib/org-hierarchy-style";
import {
  buildHierarchySvg,
  downloadSvg,
  type HierarchySvgBox,
  type HierarchySvgGroup,
} from "@/lib/hierarchySvg";

const CARD_WIDTH = 250;
const CARD_HEIGHT = 108;
const NODE_SEP = 26;
const RANK_SEP = 64;
const LANE_GAP = 40;
const CLASSIC_LANE_GAP_X = 56;
const LANE_LABEL_HEIGHT = 40;
const LANE_PADDING = 24;
const LANE_MARGIN_BOTTOM = 28;
/** Horizontal gap between the roots of the single hierarchy canvas. */
const HIERARCHY_ROOT_GAP = 64;

type ViewMode = "hierarchy" | "tree" | "focus";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "hierarchy", label: "Hierarchy" },
  { id: "tree", label: "Tree" },
  { id: "focus", label: "Focus" },
];

type OrgCardData = {
  node: OrgNode;
  users: AppUser[];
  mode: ViewMode;
  ghost?: boolean;
  /** Depth inside its own subtree; drives the client's stepped card sizes. */
  depth: number;
  role?: HierarchyRole;
};

const OrgCardNode = ({ data }: NodeProps & { data: OrgCardData }) => {
  const { node, users, mode, ghost, depth, role } = data;
  const hierarchy = mode === "hierarchy";
  const offerings = node.offerings ?? [];
  const offerLabels = offerings.map(o => o.label || OFFERING_KIND_LABELS[o.kind]);

  if (hierarchy) {
    const size = hierarchyCardSize(depth);
    const tone = HIERARCHY_TONES[role ?? "business"];
    const isRoot = role === "root";
    const tooltip = [ORG_TYPE_LABELS[node.type], ...offerLabels, ...users.map(u => u.title || u.name)]
      .filter(Boolean)
      .join(" · ");

    return (
      <div
        title={tooltip}
        className={cn(
          "flex h-full flex-col items-center justify-center overflow-hidden rounded-md border-[1.5px] px-3 text-center shadow-[0_1px_2px_rgba(15,39,64,0.10)] transition-shadow",
          !ghost && "hover:shadow-md",
          ghost && "border-dashed opacity-40 shadow-none",
        )}
        style={{
          width: size.width,
          height: size.height,
          borderColor: ghost ? "hsl(var(--border))" : `hsl(${tone.accent} / 0.8)`,
          background: ghost ? "transparent" : `hsl(${tone.fill})`,
        }}
      >
        <Handle type="target" position={Position.Top} className="opacity-0 pointer-events-none" />
        <div className="flex w-full flex-col items-center justify-center gap-0.5">
          <span
            className={cn(
              "w-full break-words font-semibold leading-tight",
              isRoot ? "text-[16px]" : depth === 1 ? "text-[12.5px]" : "text-[11.5px]",
            )}
            style={{ color: tone.text }}
          >
            {node.name}
          </span>
          {node.description && (
            <span
              className={cn(
                "line-clamp-2 w-full font-medium leading-snug",
                isRoot ? "text-[10.5px]" : "text-[9.5px]",
              )}
              style={{ color: tone.muted }}
            >
              {node.description}
            </span>
          )}
          {offerLabels.length > 0 && (
            <span
              className="mt-0.5 line-clamp-1 w-full text-[9px] font-medium"
              style={{ color: tone.muted }}
            >
              {offerLabels.join(" · ")}
            </span>
          )}
        </div>
        <Handle type="source" position={Position.Bottom} className="opacity-0 pointer-events-none" />
      </div>
    );
  }

  const color = ORG_TYPE_COLORS[node.type];

  return (
    <Card
      className={cn(
        "px-2.5 py-2 shadow-sm",
        ghost && "border-dashed opacity-40 shadow-none",
      )}
      style={{
        borderColor: ghost ? "hsl(var(--border))" : `hsl(${color} / 0.45)`,
        width: CARD_WIDTH,
      }}
    >
      <Handle type="target" position={Position.Left} className="opacity-0 pointer-events-none" />
      <div
        className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
        style={{ color: `hsl(${color})` }}
      >
        {ORG_TYPE_LABELS[node.type]}
      </div>
      <div className="break-words text-xs font-semibold leading-tight text-foreground">
        {node.name}
      </div>

      {offerings.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {offerings.map(o => (
            <Badge
              key={o.id}
              variant="outline"
              className="px-1.5 py-0 text-[9px] font-medium"
              style={{
                borderColor: `hsl(${OFFERING_KIND_COLORS[o.kind]} / 0.5)`,
                color: `hsl(${OFFERING_KIND_COLORS[o.kind]})`,
                background: `hsl(${OFFERING_KIND_COLORS[o.kind]} / 0.06)`,
              }}
              title={OFFERING_KIND_LABELS[o.kind]}
            >
              {o.label || OFFERING_KIND_LABELS[o.kind]}
            </Badge>
          ))}
        </div>
      )}

      {users.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {users.map(u => (
            <Badge
              key={u.id}
              className="px-1.5 py-0 text-[9px] font-semibold"
              title={`${u.title || u.role} — ${u.email}`}
            >
              {u.title || u.name}
            </Badge>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="opacity-0 pointer-events-none" />
    </Card>
  );
};

type LaneGroupData = {
  label: string | null;
  color: string;
  dashed: boolean;
  mode: ViewMode;
};

const LaneGroupNode = ({ data }: NodeProps & { data: LaneGroupData }) => (
  <div
    className="h-full w-full rounded-lg border-2"
    style={{
      borderColor: `hsl(${data.color} / ${data.dashed ? 0.55 : 0.6})`,
      borderStyle: data.dashed ? "dashed" : "solid",
      background: `hsl(${data.color} / ${data.dashed ? 0.04 : 0.08})`,
    }}
  >
    {data.label && (
      <Badge
        variant="outline"
        className="m-2 border-transparent text-xs font-semibold uppercase tracking-wider"
        style={{ background: `hsl(${data.color} / 0.18)`, color: `hsl(${data.color})` }}
      >
        {data.label}
      </Badge>
    )}
  </div>
);

const nodeTypes: NodeTypes = {
  orgCard: OrgCardNode,
  laneGroup: LaneGroupNode,
};

const GHOST_EDGE_STYLE = { stroke: "hsl(var(--muted-foreground) / 0.45)", strokeDasharray: "5 4" };

/** Client hierarchy palette for connectors between unclassified units. */
const HIERARCHY_EDGE_STYLE = { stroke: `hsl(${HIERARCHY_EDGE})`, strokeWidth: 1.8 };

/** Edge into an explicitly classified unit: thicker, tinted, with an arrow. */
function lodEdge(source: string, target: string, lod: 1 | 2 | 3): Edge {
  const role: HierarchyRole = lod === 2 ? "lod2" : lod === 3 ? "lod3" : "business";
  const stroke = `hsl(${HIERARCHY_TONES[role].accent})`;
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: "smoothstep",
    style: { stroke, strokeWidth: 2.25 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: stroke },
  };
}

/** Lays out one subtree (a display-root and everything beneath it, via
 *  `childrenOf`) with dagre left→right, for the Tree and Focus views. Returns
 *  its nodes/edges positioned relative to the subtree's own (0,0) origin, plus
 *  its bounding-box size so the caller can pack multiple subtrees together.
 *  When `ghostParent` is given, a faded copy of it is laid out above the root,
 *  joined by a faint dashed line — marking where a focused branch hangs off the
 *  rest of the organisation. */
function layoutSubtree(
  root: OrgNode,
  childrenOf: Map<string | null, OrgNode[]>,
  usersByNode: Map<string, AppUser[]>,
  mode: ViewMode,
  ghostParent?: OrgNode,
): { nodes: Node[]; edges: Edge[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: NODE_SEP, ranksep: RANK_SEP });

  const subtreeNodes: OrgNode[] = [];
  const seen = new Set<string>();
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur.id)) continue;
    seen.add(cur.id);
    subtreeNodes.push(cur);
    (childrenOf.get(cur.id) ?? []).forEach(k => stack.push(k));
  }

  const ghostId = ghostParent ? `ghost-${root.id}` : null;
  subtreeNodes.forEach(n => g.setNode(n.id, { width: CARD_WIDTH, height: CARD_HEIGHT }));
  if (ghostId) g.setNode(ghostId, { width: CARD_WIDTH, height: CARD_HEIGHT });

  const edges: Edge[] = [];
  if (ghostId) {
    g.setEdge(ghostId, root.id);
    edges.push({
      id: `${ghostId}->${root.id}`,
      source: ghostId,
      target: root.id,
      type: "smoothstep",
      style: GHOST_EDGE_STYLE,
    });
  }
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

  const placed: { id: string; node: OrgNode; ghost: boolean }[] = subtreeNodes.map(n => ({
    id: n.id,
    node: n,
    ghost: false,
  }));
  if (ghostId && ghostParent) placed.push({ id: ghostId, node: ghostParent, ghost: true });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  placed.forEach(({ id }) => {
    const p = g.node(id);
    minX = Math.min(minX, p.x - CARD_WIDTH / 2);
    minY = Math.min(minY, p.y - CARD_HEIGHT / 2);
    maxX = Math.max(maxX, p.x + CARD_WIDTH / 2);
    maxY = Math.max(maxY, p.y + CARD_HEIGHT / 2);
  });

  const nodes: Node[] = placed.map(({ id, node, ghost }) => {
    const p = g.node(id);
    return {
      id,
      type: "orgCard",
      position: { x: p.x - CARD_WIDTH / 2 - minX, y: p.y - CARD_HEIGHT / 2 - minY },
      data: {
        node,
        users: ghost ? [] : usersByNode.get(node.id) ?? [],
        mode,
        ghost,
        depth: 0,
      } satisfies OrgCardData,
      draggable: false,
      connectable: false,
      selectable: !ghost,
    };
  });

  return { nodes, edges, width: maxX - minX, height: maxY - minY };
}

/** Horizontal gap between siblings in the hierarchy forest. */
const HIERARCHY_SIBLING_GAP = 44;
/** Vertical gap between levels (parent card bottom → child card top). */
const HIERARCHY_LEVEL_GAP = 52;

/** Lays out the whole hierarchy view as one tidy chart: the client's design
 *  keeps sibling order, centres every parent over its children and paints a
 *  single top-down canvas (no swim-lanes, classification lives on the cards).
 *  A hand-rolled layout is used instead of dagre because dagre reorders
 *  siblings to minimise crossings, which scrambles the chart's reading order. */
function layoutHierarchyForest(
  roots: OrgNode[],
  childrenOf: Map<string | null, OrgNode[]>,
  usersByNode: Map<string, AppUser[]>,
  byId: Map<string, OrgNode>,
): { nodes: Node[]; edges: Edge[] } {
  const order: { node: OrgNode; depth: number }[] = [];
  const depthOf = new Map<string, number>();
  const visit = (node: OrgNode, depth: number) => {
    if (depthOf.has(node.id)) return;
    depthOf.set(node.id, depth);
    order.push({ node, depth });
    (childrenOf.get(node.id) ?? []).forEach(k => visit(k, depth + 1));
  };
  roots.forEach(root => visit(root, 0));

  // Widest level height wins so cards of different sizes still line up.
  const levelHeight = new Map<number, number>();
  const levelY = new Map<number, number>();
  order.forEach(({ depth }) => {
    const { height } = hierarchyCardSize(depth);
    levelHeight.set(depth, Math.max(levelHeight.get(depth) ?? 0, height));
  });
  let yCursor = 0;
  [...levelHeight.keys()].sort((a, b) => a - b).forEach(depth => {
    levelY.set(depth, yCursor);
    yCursor += (levelHeight.get(depth) ?? 0) + HIERARCHY_LEVEL_GAP;
  });

  // 1) Measure: every subtree is as wide as its children taken together.
  const subtreeWidth = new Map<string, number>();
  const measure = (node: OrgNode): number => {
    const cached = subtreeWidth.get(node.id);
    if (cached !== undefined) return cached;
    const { width } = hierarchyCardSize(depthOf.get(node.id) ?? 0);
    const kids = childrenOf.get(node.id) ?? [];
    const kidsWidth = kids.reduce((sum, kid) => sum + measure(kid), 0)
      + HIERARCHY_SIBLING_GAP * Math.max(0, kids.length - 1);
    const own = Math.max(width, kidsWidth);
    subtreeWidth.set(node.id, own);
    return own;
  };
  roots.forEach(measure);

  // 2) Place: centre the parent over the block of children, preserving order.
  const positions = new Map<string, { x: number; y: number }>();
  const place = (node: OrgNode, left: number) => {
    const width = subtreeWidth.get(node.id) ?? hierarchyCardSize(0).width;
    const depth = depthOf.get(node.id) ?? 0;
    const y = levelY.get(depth) ?? 0;
    positions.set(node.id, { x: left + width / 2, y });
    const kids = childrenOf.get(node.id) ?? [];
    const kidsWidth = kids.reduce((sum, kid) => sum + (subtreeWidth.get(kid.id) ?? 0), 0)
      + HIERARCHY_SIBLING_GAP * Math.max(0, kids.length - 1);
    let childLeft = left + (width - kidsWidth) / 2;
    kids.forEach(kid => {
      place(kid, childLeft);
      childLeft += (subtreeWidth.get(kid.id) ?? 0) + HIERARCHY_SIBLING_GAP;
    });
  };

  let rootLeft = 0;
  roots.forEach(root => {
    place(root, rootLeft);
    rootLeft += (subtreeWidth.get(root.id) ?? 0) + HIERARCHY_ROOT_GAP;
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  order.forEach(({ node, depth }) => {
    const p = positions.get(node.id)!;
    const { width, height } = hierarchyCardSize(depth);
    minX = Math.min(minX, p.x - width / 2);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + width / 2);
    maxY = Math.max(maxY, p.y + height);
  });

  const nodes: Node[] = order.map(({ node, depth }) => {
    const p = positions.get(node.id)!;
    const { width, height } = hierarchyCardSize(depth);
    return {
      id: node.id,
      type: "orgCard",
      position: { x: p.x - width / 2 - minX, y: p.y - minY },
      data: {
        node,
        users: usersByNode.get(node.id) ?? [],
        mode: "hierarchy",
        depth,
        role: hierarchyRole(node, byId),
      } satisfies OrgCardData,
      draggable: false,
      connectable: false,
      selectable: true,
    };
  });

  const edges: Edge[] = [];
  order.forEach(({ node }) => {
    const parentLod = effectiveLod(node, byId);
    (childrenOf.get(node.id) ?? []).forEach(child => {
      // The client's chart only accents the step *into* a control function:
      // a plain navy rule to the first classified unit, then a thick coloured
      // arrow for its Internal Control child. Colour is used when the parent
      // already sits on the same line of defence.
      edges.push(
        child.lineOfDefense && parentLod === child.lineOfDefense
          ? lodEdge(node.id, child.id, child.lineOfDefense)
          : {
              id: `${node.id}->${child.id}`,
              source: node.id,
              target: child.id,
              type: "smoothstep",
              style: HIERARCHY_EDGE_STYLE,
            },
      );
    });
  });

  return { nodes, edges };
}

interface OrgMapGraphProps {
  nodes: OrgNode[];
  childrenOf: Map<string | null, OrgNode[]>;
  users: AppUser[];
  onNodeSelect?: (id: string) => void;
}

export const OrgMapGraph = ({ nodes, childrenOf, users, onNodeSelect }: OrgMapGraphProps) => {
  const [mode, setMode] = useState<ViewMode>("hierarchy");
  const [focusIds, setFocusIds] = useState<Set<string>>(new Set());

  const toggleFocus = useCallback((id: string) => {
    setFocusIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Indented, depth-ordered list of every unit, for the focus picker.
  const pickerRows = useMemo(() => {
    const rows: { node: OrgNode; depth: number }[] = [];
    const walk = (n: OrgNode, depth: number) => {
      rows.push({ node: n, depth });
      (childrenOf.get(n.id) ?? []).forEach(k => walk(k, depth + 1));
    };
    (childrenOf.get(null) ?? []).forEach(r => walk(r, 0));
    return rows;
  }, [childrenOf]);

  const { flowNodes, flowEdges } = useMemo(() => {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const usersByNode = new Map<string, AppUser[]>();
    users.forEach(u => {
      if (!u.orgNodeId) return;
      const arr = usersByNode.get(u.orgNodeId) ?? [];
      arr.push(u);
      usersByNode.set(u.orgNodeId, arr);
    });

    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];
    const roots = childrenOf.get(null) ?? [];

    // Client hierarchy: one flat canvas, no Line-of-Defense swim-lanes — the
    // colour of each card carries the classification instead. Roots sit side
    // by side so a group with several top-level entities still reads as one chart.
    if (mode === "hierarchy") {
      const { nodes: hierarchyNodes, edges: hierarchyEdges } = layoutHierarchyForest(
        roots,
        childrenOf,
        usersByNode,
        byId,
      );
      return { flowNodes: hierarchyNodes, flowEdges: hierarchyEdges };
    }

    const lanes: Record<1 | 2 | 3, OrgNode[]> = { 1: [], 2: [], 3: [] };
    const unclassified: OrgNode[] = [];
    const ghostFor = new Map<string, OrgNode>();

    const focused = mode === "focus" && focusIds.size > 0;
    if (focused) {
      // Show each picked unit with everything beneath it. A pick nested under
      // another pick is already part of that branch, so only top-most picks
      // become display-roots; each hangs off a faded copy of its parent.
      const hasPickedAncestor = (n: OrgNode) => {
        let cur = n.parentId ? byId.get(n.parentId) : undefined;
        while (cur) {
          if (focusIds.has(cur.id)) return true;
          cur = cur.parentId ? byId.get(cur.parentId) : undefined;
        }
        return false;
      };
      pickerRows.forEach(({ node }) => {
        if (!focusIds.has(node.id) || hasPickedAncestor(node)) return;
        const parent = node.parentId ? byId.get(node.parentId) : undefined;
        if (parent) ghostFor.set(node.id, parent);
        const lod = effectiveLod(node, byId);
        if (lod) lanes[lod].push(node);
        else unclassified.push(node);
      });
    } else {
      // A root goes wholly into one lane unless its direct children carry more
      // than one distinct effective LoD, in which case each direct child
      // becomes its own display-root, placed in its own lane (the parent root
      // itself isn't re-shown). Because splitting only ever happens at this
      // one level, a subtree's edges never need to cross lanes.
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
    }

    const bands: { label: string | null; color: string; dashed: boolean; roots: OrgNode[] }[] = [];
    if (unclassified.length > 0) {
      bands.push({ label: "Unclassified — assign a Line of Defense", color: "220 15% 45%", dashed: true, roots: unclassified });
    }
    ([1, 2, 3] as const).forEach(l => {
      if (lanes[l].length > 0) {
        bands.push({ label: LINE_OF_DEFENSE_SHORT[l], color: LINE_OF_DEFENSE_COLORS[l], dashed: false, roots: lanes[l] });
      }
    });

    let yCursor = 0;

    bands.forEach(band => {
      // Tree/focus stack subtrees down the lane.
      let cursor = 0;
      let bandWidth = 0;
      let bandHeight = 0;
      const subtrees = band.roots.map(root =>
        layoutSubtree(root, childrenOf, usersByNode, mode, ghostFor.get(root.id)),
      );

      subtrees.forEach(sub => {
        const offsetY = yCursor + LANE_LABEL_HEIGHT + LANE_PADDING + cursor;
        sub.nodes.forEach(n => {
          allNodes.push({ ...n, position: { x: n.position.x, y: n.position.y + offsetY } });
        });
        allEdges.push(...sub.edges);
        cursor += sub.height + LANE_GAP;
        bandWidth = Math.max(bandWidth, sub.width);
        bandHeight = cursor - LANE_GAP;
      });

      allNodes.push({
        id: `band-${band.label ?? "unclassified"}`,
        type: "laneGroup",
        position: { x: -LANE_PADDING, y: yCursor },
        data: { label: band.label, color: band.color, dashed: band.dashed, mode } satisfies LaneGroupData,
        style: {
          width: Math.max(bandWidth, 0) + LANE_PADDING * 2,
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
  }, [nodes, childrenOf, users, mode, focusIds, pickerRows]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "orgCard" && !node.id.startsWith("ghost-")) onNodeSelect?.(node.id);
    },
    [onNodeSelect],
  );

  /** Re-render the laid-out React Flow graph as a standalone SVG file. */
  const exportSvg = useCallback(() => {
    const hierarchy = mode === "hierarchy";
    const boxes: HierarchySvgBox[] = [];
    const groups: HierarchySvgGroup[] = [];

    for (const n of flowNodes) {
      if (n.type === "laneGroup") {
        const d = n.data as LaneGroupData;
        groups.push({
          x: n.position.x,
          y: n.position.y,
          width: Number(n.style?.width ?? 0),
          height: Number(n.style?.height ?? 0),
          label: d.label,
          color: d.color,
          dashed: d.dashed,
        });
      } else if (n.type === "orgCard") {
        const d = n.data as OrgCardData;
        if (d.ghost) continue;
        const size = hierarchy ? hierarchyCardSize(d.depth) : { width: CARD_WIDTH, height: CARD_HEIGHT };
        const tone = hierarchy ? HIERARCHY_TONES[d.role ?? "business"] : undefined;
        boxes.push({
          id: n.id,
          x: n.position.x,
          y: n.position.y,
          width: size.width,
          height: size.height,
          accent: tone?.accent ?? ORG_TYPE_COLORS[d.node.type],
          fill: tone?.fill,
          textColor: tone?.text,
          subtitleColor: tone?.muted,
          titleSize: hierarchy ? (d.role === "root" ? 16 : d.depth === 1 ? 12.5 : 11.5) : undefined,
          typeLabel: hierarchy ? undefined : ORG_TYPE_LABELS[d.node.type],
          title: d.node.name,
          description: d.node.description ?? null,
          chips: hierarchy
            ? []
            : [
                ...(d.node.offerings ?? []).map((o) => o.label || OFFERING_KIND_LABELS[o.kind]),
                ...d.users.map((u) => u.title || u.name),
              ],
        });
      }
    }

    if (boxes.length === 0) return;
    const boxIds = new Set(boxes.map((b) => b.id));
    const svg = buildHierarchySvg(
      boxes,
      flowEdges
        .filter((e) => boxIds.has(e.source) && boxIds.has(e.target))
        .map((e) => ({
          source: e.source,
          target: e.target,
          color: hierarchy ? String(e.style?.stroke ?? "") : undefined,
          arrow: hierarchy && !!e.markerEnd,
        })),
      groups,
      { direction: hierarchy ? "TB" : "LR" },
    );
    downloadSvg(`organisation-map-${new Date().toISOString().slice(0, 10)}.svg`, svg);
    toast.success("Organisation map exported as SVG");
  }, [flowNodes, flowEdges, mode]);

  return (
    <div
      data-testid="organisation-map-canvas"
      className="relative h-[420px] overflow-hidden rounded-lg border border-border sm:h-[520px] lg:h-[600px]"
    >
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Map view" className="inline-flex rounded-md border border-border bg-card/90 p-0.5 backdrop-blur">
          {VIEW_MODES.map(m => (
            <Button
              key={m.id}
              type="button"
              size="sm"
              variant={mode === m.id ? "secondary" : "ghost"}
              aria-pressed={mode === m.id}
              className="h-7 px-2.5 text-xs"
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </Button>
          ))}
        </div>
        {mode === "focus" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 bg-card/90 text-xs backdrop-blur">
                {focusIds.size === 0 ? "Select units" : `${focusIds.size} selected`}
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs text-muted-foreground">Show only these units and what is beneath them</span>
                {focusIds.size > 0 && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setFocusIds(new Set())}>
                    Clear
                  </Button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {pickerRows.map(({ node, depth }) => {
                  const checked = focusIds.has(node.id);
                  return (
                    <label
                      key={node.id}
                      className="flex cursor-pointer items-center gap-2 py-1.5 pr-3 text-xs hover:bg-muted"
                      style={{ paddingLeft: 12 + depth * 14 }}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleFocus(node.id)} />
                      <span className="min-w-0 flex-1 truncate">{node.name}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {ORG_TYPE_LABELS[node.type]}
                      </span>
                      {checked && <Check className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="absolute right-3 top-3 z-10">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 bg-card/90 backdrop-blur"
          onClick={exportSvg}
          disabled={flowNodes.length === 0}
        >
          <Download className="h-3.5 w-3.5" /> Export SVG
        </Button>
      </div>
      {mode === "hierarchy" && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 space-y-1.5 rounded-md border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
          {HIERARCHY_LEGEND.map(item => (
            <div key={item.role} className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-[3px] border"
                style={{
                  background: `hsl(${HIERARCHY_TONES[item.role].fill})`,
                  borderColor: `hsl(${HIERARCHY_TONES[item.role].accent} / 0.8)`,
                }}
              />
              <span className="text-[10.5px] font-medium leading-none text-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      )}
      <ReactFlow
        key={`${mode}-${[...focusIds].sort().join(",")}`}
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
        {mode !== "hierarchy" && (
          <MiniMap pannable zoomable className="!bg-card hidden md:block" maskColor="hsl(var(--muted) / 0.6)" />
        )}
      </ReactFlow>
    </div>
  );
};
