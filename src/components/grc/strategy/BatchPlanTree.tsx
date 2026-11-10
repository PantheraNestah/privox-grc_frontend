/**
 * The staged plan of a batch, rendered as a tree.
 *
 * These nodes have no `action` or `status`: the batch was validated when it was
 * submitted, so the tree must not invent a verdict. It shows content, the
 * resolved organization unit, any drift since submission, and — once applied —
 * what happened to each node.
 */

import { type KeyboardEvent } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Gauge,
  Landmark,
  ListChecks,
  Network,
  Rocket,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  PLAN_ACTION_LABELS,
  flattenPlan,
  planNodeLabel,
  planTypeLabel,
  resultForPlanNode,
  type FlatPlanNode,
} from "@/lib/strategy-batch-plan";
import type { BatchPlanNode, BatchResultEntry } from "@/lib/strategy-batches";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, LucideIcon> = {
  PILLAR: Landmark,
  OBJECTIVE: Target,
  INITIATIVE: Rocket,
  ACTIVITY: ListChecks,
  KPI: Gauge,
};

function orgUnitLabel(node: BatchPlanNode): string | null {
  const orgNode = node.orgNode;
  if (!orgNode) return null;
  if (orgNode.name) return orgNode.name;
  const segments = (orgNode.path ?? "").split("/").map((part) => part.trim()).filter(Boolean);
  return segments.at(-1) ?? null;
}

export interface BatchPlanTreeProps {
  nodes: BatchPlanNode[];
  selectedKey?: string | null;
  onSelect?: (row: FlatPlanNode) => void;
  result?: Record<string, BatchResultEntry> | null;
  /** Omit to show every node; pass a set to make the tree collapsible. */
  expandedKeys?: Set<string> | null;
  onToggle?: (key: string) => void;
  emptyLabel?: string;
  className?: string;
}

/**
 * A flat list of visible nodes. Ancestors are checked so a collapsed branch
 * hides its whole subtree rather than leaving orphaned children behind.
 */
function visibleRows(nodes: BatchPlanNode[], expandedKeys: Set<string> | null | undefined): FlatPlanNode[] {
  const rows = flattenPlan(nodes);
  if (!expandedKeys) return rows;
  return rows.filter((row) => row.ancestorKeys.every((key) => expandedKeys.has(key)));
}

export function BatchPlanTree({
  nodes,
  selectedKey,
  onSelect,
  result,
  expandedKeys,
  onToggle,
  emptyLabel = "This plan has no elements.",
  className,
}: BatchPlanTreeProps) {
  const rows = visibleRows(nodes, expandedKeys);

  if (rows.length === 0) {
    return <p className={cn("px-2 py-6 text-center text-sm text-muted-foreground", className)}>{emptyLabel}</p>;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-plan-row]"));
    const index = buttons.findIndex((button) => button === document.activeElement);
    if (index === -1) return;

    const row = rows[index];
    const hasChildren = Boolean(row.node.children?.length);
    const expanded = expandedKeys ? expandedKeys.has(row.key) : true;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const next = event.key === "ArrowDown" ? index + 1 : index - 1;
      if (buttons[next]) {
        event.preventDefault();
        buttons[next].focus();
      }
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      buttons[event.key === "Home" ? 0 : buttons.length - 1]?.focus();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (hasChildren && !expanded) {
        onToggle?.(row.key);
      } else if (hasChildren) {
        buttons[index + 1]?.focus();
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (hasChildren && expanded) {
        onToggle?.(row.key);
      } else {
        for (let i = index - 1; i >= 0; i -= 1) {
          if (rows[i].depth < row.depth) {
            buttons[i]?.focus();
            break;
          }
        }
      }
    }
  };

  return (
    <ul role="tree" aria-label="Plan elements" className={cn("space-y-0.5", className)} onKeyDown={handleKeyDown}>
      {rows.map((row) => {
        const { node } = row;
        const hasChildren = Boolean(node.children?.length);
        const expanded = expandedKeys ? expandedKeys.has(row.key) : true;
        const Icon = TYPE_ICONS[node.type] ?? ListChecks;
        const unit = orgUnitLabel(node);
        const applied = resultForPlanNode(node, result);
        const selected = selectedKey === row.key;

        return (
          <li
            key={row.key}
            role="treeitem"
            aria-level={row.depth + 1}
            aria-selected={selected}
            aria-expanded={hasChildren ? expanded : undefined}
          >
            <div
              className={cn(
                "flex flex-wrap items-start gap-1.5 rounded-md py-1 pr-2 transition",
                selected ? "bg-brand-accent/10" : "hover:bg-muted/50",
              )}
              style={{ paddingLeft: row.depth * 16 }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${planNodeLabel(node)}`}
                  className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onToggle?.(row.key)}
                >
                  <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
                </button>
              ) : (
                <span aria-hidden className="h-5 w-5 shrink-0" />
              )}

              <Icon className="mt-1 h-4 w-4 shrink-0 text-brand-accent" strokeWidth={1.8} />

              <PlanRowContent
                node={node}
                unit={unit}
                applied={applied}
                selectable={Boolean(onSelect)}
                selected={selected}
                onSelect={() => onSelect?.(row)}
              />
            </div>

            {node.pathChanged && (
              <p className="pb-1 text-[11px] text-warn" style={{ paddingLeft: row.depth * 16 + 46 }}>
                Now under: {node.currentPath ?? "the unit no longer exists"}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PlanRowContent({
  node,
  unit,
  applied,
  selectable,
  selected,
  onSelect,
}: {
  node: BatchPlanNode;
  unit: string | null;
  applied: BatchResultEntry | null;
  selectable: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const content = (
    <>
      <span className="font-medium">{planNodeLabel(node)}</span>
      {node.code && <span className="font-mono text-[11px] text-muted-foreground">{node.code}</span>}
      <Badge variant="outline" className="text-[10px]">
        {planTypeLabel(node.type)}
      </Badge>
      {unit && (
        <span
          className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
          title={node.orgNode?.path ?? undefined}
        >
          <Network className="h-3 w-3" /> {unit}
        </span>
      )}
      {node.orgNode?.resolvedFrom === "INHERITED" && (
        <span className="text-[11px] text-muted-foreground">
          inherited{node.orgNode.inheritedFrom ? ` from ${node.orgNode.inheritedFrom}` : ""}
        </span>
      )}
      {node.pathChanged && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warn">
          <AlertTriangle className="h-3 w-3" /> Org path changed
        </span>
      )}
      {applied && (
        <Badge variant={applied.action === "UNCHANGED" ? "secondary" : "outline"} className="text-[10px]">
          {PLAN_ACTION_LABELS[applied.action]}
        </Badge>
      )}
    </>
  );

  if (!selectable) {
    return <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm">{content}</span>;
  }

  return (
    <button
      type="button"
      data-plan-row
      aria-current={selected ? "true" : undefined}
      className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onSelect}
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">{content}</span>
    </button>
  );
}
