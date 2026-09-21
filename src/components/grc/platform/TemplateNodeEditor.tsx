import { ChevronDown, ChevronRight, ChevronUp, Copy, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { colorForType } from "@/components/grc/OrgTreeGraph";
import { NODE_TYPES, countNodes, type TreeNode } from "@/lib/template-tree";
import type { OrgNodeType } from "@/lib/governance-types";
import { cn } from "@/lib/utils";

const INDENT = 20;

export interface TemplateNodeEditorProps {
  node: TreeNode;
  depth: number;
  isRoot: boolean;
  isFirst: boolean;
  isLast: boolean;
  collapsedIds: ReadonlySet<string>;
  invalidIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onUpdate: (id: string, patch: Partial<TreeNode>) => void;
  onAddChild: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
}

export function TemplateNodeEditor(props: TemplateNodeEditorProps) {
  const {
    node,
    depth,
    isRoot,
    isFirst,
    isLast,
    collapsedIds,
    invalidIds,
    selectedId,
    onSelect,
    onToggleCollapse,
    onUpdate,
    onAddChild,
    onDuplicate,
    onMove,
    onRemove,
  } = props;

  const hasChildren = node.children.length > 0;
  const collapsed = hasChildren && collapsedIds.has(node.id);
  const invalid = invalidIds.has(node.id);
  const selected = selectedId === node.id;
  const hidden = collapsed ? countNodes(node) - 1 : 0;

  return (
    <div className="relative">
      {!isRoot && (
        <>
          {/* Vertical run: bridges the 8px gaps above/below so siblings read as one line. */}
          <span
            aria-hidden
            className="pointer-events-none absolute border-l-2 border-border"
            style={{
              left: (depth - 1) * INDENT + 9,
              top: isFirst ? -8 : 0,
              ...(isLast ? { height: isFirst ? 32 : 24 } : { bottom: -8 }),
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-6 border-t-2 border-border"
            style={{ left: (depth - 1) * INDENT + 9, width: 11 }}
          />
        </>
      )}

      <Card
        id={`template-node-${node.id}`}
        onFocusCapture={() => onSelect(node.id)}
        className={cn(
          "shadow-none transition-[box-shadow,border-color]",
          selected && "border-brand-accent/60 ring-2 ring-brand-accent/20",
          invalid && "border-destructive/60",
        )}
        style={{ marginLeft: depth * INDENT }}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            {hasChildren ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground"
                onClick={() => onToggleCollapse(node.id)}
                aria-label={collapsed ? "Expand children" : "Collapse children"}
                aria-expanded={!collapsed}
              >
                {collapsed ? <ChevronRight /> : <ChevronDown />}
              </Button>
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: `hsl(${colorForType(node.type)})` }}
                />
              </span>
            )}

            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_11rem]">
              <Input
                value={node.name}
                onChange={(e) => onUpdate(node.id, { name: e.target.value })}
                placeholder="Node name"
                aria-invalid={invalid || undefined}
                className={cn("h-8", invalid && "border-destructive focus-visible:ring-destructive/30")}
              />
              <Select
                value={node.type}
                onValueChange={(value) => onUpdate(node.id, { type: value as OrgNodeType })}
              >
                <SelectTrigger className="h-8" aria-label="Node type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NODE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={node.description}
                onChange={(e) => onUpdate(node.id, { description: e.target.value })}
                placeholder="Description (optional)"
                className="h-8 sm:col-span-2"
              />
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Add child node"
                aria-label="Add child node"
                onClick={() => onAddChild(node.id)}
              >
                <Plus />
              </Button>
              {!isRoot && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="More node actions"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onSelect={() => onDuplicate(node.id)}>
                      <Copy /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={isFirst} onSelect={() => onMove(node.id, -1)}>
                      <ChevronUp /> Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={isLast} onSelect={() => onMove(node.id, 1)}>
                      <ChevronDown /> Move down
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                      onSelect={() => onRemove(node.id)}
                    >
                      <Trash2 /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {(collapsed || invalid) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-10">
              {collapsed && (
                <Badge variant="secondary" className="text-[11px] font-normal">
                  {hidden} hidden node{hidden === 1 ? "" : "s"}
                </Badge>
              )}
              {invalid && <span className="text-xs text-destructive">A name is required.</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {!collapsed && hasChildren && (
        <div className="relative mt-2 space-y-2">
          {node.children.map((child, index) => (
            <TemplateNodeEditor
              key={child.id}
              {...props}
              node={child}
              depth={depth + 1}
              isRoot={false}
              isFirst={index === 0}
              isLast={index === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
