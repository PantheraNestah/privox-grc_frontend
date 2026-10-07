// Org Map — renders the organisation hierarchy (grouped into Three Lines of
// Defense swim-lanes) as a pannable/zoomable React Flow canvas instead of a
// hand-laid-out flexbox tree. Real SVG edges connect parent → child cards,
// so connectors can never visually desync from the cards the way the old
// CSS-border hack could once trees got wide enough to wrap.
import { useMemo, useCallback, useState } from "react";
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
  buildHierarchySvg,
  downloadSvg,
  type HierarchySvgBox,
  type HierarchySvgGroup,
} from "@/lib/hierarchySvg";

const CARD_WIDTH = 250;
const CARD_HEIGHT = 108;
const CLASSIC_CARD_WIDTH = 210;
const NODE_SEP = 26;
const CLASSIC_NODE_SEP = 36;
const RANK_SEP = 64;
const LANE_GAP = 40;
const CLASSIC_LANE_GAP_X = 56;
const LANE_LABEL_HEIGHT = 40;
const LANE_PADDING = 24;
const LANE_MARGIN_BOTTOM = 28;

/** classic = original top-down map; tree = left→right like the platform
 *  template preview; focus = tree layout limited to the units you pick. */
type ViewMode = "classic" | "tree" | "focus";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "tree", label: "Tree" },
  { id: "focus", label: "Focus" },
];

type OrgCardData = {
  node: OrgNode;
  users: AppUser[];
  mode: ViewMode;
  ghost?: boolean;
};

const OrgCardNode = ({ data }: NodeProps & { data: OrgCardData }) => {
  const { node, users, mode, ghost } = data;
  const color = ORG_TYPE_COLORS[node.type];
  const offerings = node.offerings ?? [];
  const classic = mode === "classic";

  return (
    <Card
      className={cn(
        "px-2.5 py-2 shadow-sm",
        classic && "px-3 text-center",
        ghost && "border-dashed opacity-40 shadow-none",
      )}
      style={{
        borderColor: ghost ? "hsl(var(--border))" : `hsl(${color} / 0.45)`,
        width: classic ? CLASSIC_CARD_WIDTH : CARD_WIDTH,
      }}
    >
      <Handle
        type="target"
        position={classic ? Position.Top : Position.Left}
        className="opacity-0 pointer-events-none"
      />
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
        <div className={cn("mt-1.5 flex flex-wrap gap-1", classic && "justify-center")}>
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
        <div className={cn("mt-1.5 flex flex-wrap gap-1", classic && "justify-center")}>
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
      <Handle
        type="source"
        position={classic ? Position.Bottom : Position.Right}
        className="opacity-0 pointer-events-none"
      />
    </Card>
  );
};

type LaneGroupData = {
  label: string | null;
  color: string;
  dashed: boolean;
  mode: ViewMode;
};

const LaneGroupNode = ({ data }: NodeProps & { data: LaneGroupData }) => {
  const classic = data.mode === "classic";
  return (
    <div
      className={cn("h-full w-full rounded-lg", classic ? "border" : "border-2", data.dashed && "border-dashed")}
      style={{
        borderColor: `hsl(${data.color} / ${classic ? (data.dashed ? 0.5 : 0.4) : data.dashed ? 0.55 : 0.6})`,
        background: `hsl(${data.color} / ${classic ? (data.dashed ? 0.03 : 0.05) : data.dashed ? 0.04 : 0.08})`,
      }}
    >
      {data.label && (
        <Badge
          variant="outline"
          className={cn(
            "m-2 border-transparent font-semibold uppercase tracking-wider",
            classic ? "text-[10px]" : "text-xs",
          )}
          style={{ background: `hsl(${data.color} / ${classic ? 0.15 : 0.18})`, color: `hsl(${data.color})` }}
        >
          {data.label}
        </Badge>
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  orgCard: OrgCardNode,
  laneGroup: LaneGroupNode,
};

const GHOST_EDGE_STYLE = { stroke: "hsl(var(--muted-foreground) / 0.45)", strokeDasharray: "5 4" };

/** Lays out one subtree (a display-root and everything beneath it, via
 *  `childrenOf`) with dagre and returns its nodes/edges positioned relative to
 *  the subtree's own (0,0) origin, plus its overall bounding-box size so the
 *  caller can pack multiple subtrees together. `classic` lays out top-to-bottom,
 *  everything else left-to-right. When `ghostParent` is given, a faded copy of
 *  it is laid out above the root, joined by a faint dashed line — marking
 *  where a focused branch hangs off the rest of the organisation. */
function layoutSubtree(
  root: OrgNode,
  childrenOf: Map<string | null, OrgNode[]>,
  usersByNode: Map<string, AppUser[]>,
  mode: ViewMode,
  ghostParent?: OrgNode,
): { nodes: Node[]; edges: Edge[]; width: number; height: number } {
  const classic = mode === "classic";
  const cardWidth = classic ? CLASSIC_CARD_WIDTH : CARD_WIDTH;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: classic ? "TB" : "LR", nodesep: classic ? CLASSIC_NODE_SEP : NODE_SEP, ranksep: RANK_SEP });

  const subtreeNodes: OrgNode[] = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    subtreeNodes.push(cur);
    (childrenOf.get(cur.id) ?? []).forEach(k => stack.push(k));
  }

  const ghostId = ghostParent ? `ghost-${root.id}` : null;
  subtreeNodes.forEach(n => g.setNode(n.id, { width: cardWidth, height: CARD_HEIGHT }));
  if (ghostId) g.setNode(ghostId, { width: cardWidth, height: CARD_HEIGHT });
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

  const placed: { id: string; node: OrgNode; ghost: boolean }[] = subtreeNodes.map(n => ({ id: n.id, node: n, ghost: false }));
  if (ghostId && ghostParent) placed.push({ id: ghostId, node: ghostParent, ghost: true });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  placed.forEach(({ id }) => {
    const p = g.node(id);
    minX = Math.min(minX, p.x - cardWidth / 2);
    minY = Math.min(minY, p.y - CARD_HEIGHT / 2);
    maxX = Math.max(maxX, p.x + cardWidth / 2);
    maxY = Math.max(maxY, p.y + CARD_HEIGHT / 2);
  });

  const nodes: Node[] = placed.map(({ id, node, ghost }) => {
    const p = g.node(id);
    return {
      id,
      type: "orgCard",
      position: { x: p.x - cardWidth / 2 - minX, y: p.y - CARD_HEIGHT / 2 - minY },
      data: { node, users: ghost ? [] : usersByNode.get(node.id) ?? [], mode, ghost } satisfies OrgCardData,
      draggable: false,
      connectable: false,
      selectable: !ghost,
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
  const [mode, setMode] = useState<ViewMode>("classic");
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

    const classic = mode === "classic";
    const roots = childrenOf.get(null) ?? [];
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

    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];
    let yCursor = 0;

    bands.forEach(band => {
      // Classic packs subtrees side by side; tree/focus stack them down the lane.
      let cursor = 0;
      let bandWidth = 0;
      let bandHeight = 0;
      const subtrees = band.roots.map(root => layoutSubtree(root, childrenOf, usersByNode, mode, ghostFor.get(root.id)));

      subtrees.forEach(sub => {
        const offsetX = classic ? cursor : 0;
        const offsetY = yCursor + LANE_LABEL_HEIGHT + LANE_PADDING + (classic ? 0 : cursor);
        sub.nodes.forEach(n => {
          allNodes.push({ ...n, position: { x: n.position.x + offsetX, y: n.position.y + offsetY } });
        });
        allEdges.push(...sub.edges);
        cursor += (classic ? sub.width + CLASSIC_LANE_GAP_X : sub.height + LANE_GAP);
        bandWidth = classic ? cursor - CLASSIC_LANE_GAP_X : Math.max(bandWidth, sub.width);
        bandHeight = classic ? Math.max(bandHeight, sub.height) : cursor - LANE_GAP;
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
    const boxes: HierarchySvgBox[] = [];
    const groups: HierarchySvgGroup[] = [];
    const cardWidth = mode === "classic" ? CLASSIC_CARD_WIDTH : CARD_WIDTH;

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
        boxes.push({
          id: n.id,
          x: n.position.x,
          y: n.position.y,
          width: cardWidth,
          height: CARD_HEIGHT,
          accent: ORG_TYPE_COLORS[d.node.type],
          typeLabel: ORG_TYPE_LABELS[d.node.type],
          title: d.node.name,
          description: d.node.description ?? null,
          chips: [
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
        .map((e) => ({ source: e.source, target: e.target })),
      groups,
      { direction: mode === "classic" ? "TB" : "LR" },
    );
    downloadSvg(`organisation-map-${new Date().toISOString().slice(0, 10)}.svg`, svg);
    toast.success("Organisation map exported as SVG");
  }, [flowNodes, flowEdges, mode]);

  return (
    <div className="relative h-[420px] overflow-hidden rounded-lg border border-border sm:h-[520px] lg:h-[600px]">
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
        <MiniMap pannable zoomable className="!bg-card hidden md:block" maskColor="hsl(var(--muted) / 0.6)" />
      </ReactFlow>
    </div>
  );
};
