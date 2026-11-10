/**
 * A submitted bulk plan, read before it is decided.
 *
 * Issue #46: approvers used to see only a name and an Approve button. This view
 * shows the structure, every element's content, the organization units the plan
 * resolved to, any drift since submission, and — once applied — what each node
 * became.
 */

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Info,
  ListTree,
  Search,
  Table2,
  XCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BatchPlanTree } from "@/components/grc/strategy/BatchPlanTree";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  BATCH_STATUS_LABELS,
  PLAN_ACTION_LABELS,
  allPlanKeys,
  batchModeLabel,
  collectPlanDrift,
  countPlanByType,
  countPlanOrgUnits,
  filterPlanTree,
  flattenPlan,
  matchesPlanSearch,
  planNodeLabel,
  planTypeLabel,
  resultForPlanNode,
  type FlatPlanNode,
} from "@/lib/strategy-batch-plan";
import type {
  BatchDecision,
  BatchDetail,
  BatchPlanNode,
  BatchResultEntry,
  BatchStatus,
} from "@/lib/strategy-batches";
import { cn } from "@/lib/utils";

const DIRECTION_LABELS: Record<string, string> = {
  HIGHER_IS_BETTER: "Higher is better",
  LOWER_IS_BETTER: "Lower is better",
};

const RESOLUTION_LABELS: Record<string, string> = {
  ID: "Matched by id",
  PATH: "Matched by path",
  NAME: "Matched by name",
  INHERITED: "Inherited from its parent",
};

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  return (
    <Badge variant={status === "APPROVED" ? "secondary" : status === "REJECTED" ? "destructive" : "outline"}>
      {BATCH_STATUS_LABELS[status]}
    </Badge>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatPeriod(node: BatchPlanNode): string {
  if (node.periodStart && node.periodEnd) return `${node.periodStart} → ${node.periodEnd}`;
  return node.periodStart ?? node.periodEnd ?? "—";
}

function rowId(row: FlatPlanNode): string {
  return row.node.code ?? row.key;
}

function SummaryStat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-muted/25 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-lg font-semibold", tone)}>{value}</dd>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 text-sm sm:grid-cols-[9rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function NodeDetail({
  row,
  result,
}: {
  row: FlatPlanNode;
  result: Record<string, BatchResultEntry> | null | undefined;
}) {
  const node = row.node;
  const applied = resultForPlanNode(node, result);
  const hasKpiFields = [node.targetValue, node.unit, node.baselineValue, node.direction].some(
    (value) => value !== null && value !== undefined && value !== "",
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-navy-deep">{planNodeLabel(node)}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {node.code && <span className="font-mono">{node.code}</span>}
          <Badge variant="outline" className="text-[10px]">
            {planTypeLabel(node.type)}
          </Badge>
          {row.depth > 0 && <span>Level {row.depth + 1}</span>}
        </div>
      </div>

      {applied && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm">
          <Badge variant={applied.action === "UNCHANGED" ? "secondary" : "outline"} className="text-[10px]">
            {PLAN_ACTION_LABELS[applied.action]}
          </Badge>
          {applied.elementId && (
            <Link
              className="text-brand-accent underline-offset-4 hover:underline"
              to={`/governance/strategy-formulation?tab=elements&element=${applied.elementId}`}
            >
              Open the published element
            </Link>
          )}
        </div>
      )}

      <dl className="space-y-3">
        <DetailField label="Description">
          <span className="whitespace-pre-wrap">{node.description || "—"}</span>
        </DetailField>
        <DetailField label="Outcome">
          <span className="whitespace-pre-wrap">{node.outcomeSummary || "—"}</span>
        </DetailField>

        {hasKpiFields && (
          <>
            <DetailField label="Target">
              {node.targetValue === null || node.targetValue === undefined ? "—" : `${node.targetValue}${node.unit ? ` ${node.unit}` : ""}`}
            </DetailField>
            <DetailField label="Baseline">
              {node.baselineValue === null || node.baselineValue === undefined ? "—" : node.baselineValue}
            </DetailField>
            <DetailField label="Direction">
              {node.direction ? DIRECTION_LABELS[node.direction] ?? node.direction : "—"}
            </DetailField>
          </>
        )}

        <DetailField label="Period">{formatPeriod(node)}</DetailField>

        <DetailField label="Organization unit">
          {node.orgNode ? (
            <div className="space-y-1">
              <p className="font-medium">{node.orgNode.name ?? "Unnamed unit"}</p>
              {node.orgNode.path && <p className="text-xs text-muted-foreground">{node.orgNode.path}</p>}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {node.orgNode.resolvedFrom ? RESOLUTION_LABELS[node.orgNode.resolvedFrom] ?? node.orgNode.resolvedFrom : "Resolved"}
                </Badge>
                {node.orgNode.resolvedFrom === "INHERITED" && node.orgNode.inheritedFrom && (
                  <span>Inherited from {node.orgNode.inheritedFrom}</span>
                )}
                {node.orgNode.reference && <span className="font-mono">{node.orgNode.reference}</span>}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">No unit (top-level pillar)</span>
          )}
        </DetailField>

        {node.pathChanged && (
          <DetailField label="Org drift">
            <div className="rounded-md border border-warn/40 bg-warn/5 p-2 text-sm text-warn">
              <p className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> This unit changed after submission
              </p>
              <p className="mt-1 text-foreground/80">Now under: {node.currentPath ?? "the unit no longer exists"}</p>
            </div>
          </DetailField>
        )}

        {node.existingParent && (
          <DetailField label="Existing parent">
            <span className="font-mono">{node.existingParent}</span>
          </DetailField>
        )}
      </dl>
    </div>
  );
}

type SortKey = "code" | "title" | "type" | "parent" | "org" | "target" | "period";

function sortValue(row: FlatPlanNode, key: SortKey): string | number {
  switch (key) {
    case "code":
      return row.node.code ?? "";
    case "title":
      return planNodeLabel(row.node);
    case "type":
      return row.node.type;
    case "parent":
      return row.parent?.code ?? "";
    case "org":
      return row.node.orgNode?.name ?? "";
    case "target":
      return row.node.targetValue ?? Number.NEGATIVE_INFINITY;
    case "period":
      return row.node.periodStart ?? "";
  }
}

function SortHead({
  label,
  column,
  sort,
  onToggle,
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey; direction: "asc" | "desc" };
  onToggle: (key: SortKey) => void;
}) {
  return (
    <TableHead aria-sort={sort.key === column ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => onToggle(column)}
      >
        {label}
        {sort.key === column && (sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );
}

function PlanTable({ rows, onView }: { rows: FlatPlanNode[]; onView: (row: FlatPlanNode) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "code", direction: "asc" });

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      const order = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
      return sort.direction === "asc" ? order : -order;
    });
    return copy;
  }, [rows, sort]);

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" },
    );

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHead label="Code" column="code" sort={sort} onToggle={toggle} />
            <SortHead label="Title" column="title" sort={sort} onToggle={toggle} />
            <SortHead label="Type" column="type" sort={sort} onToggle={toggle} />
            <SortHead label="Parent" column="parent" sort={sort} onToggle={toggle} />
            <SortHead label="Org unit" column="org" sort={sort} onToggle={toggle} />
            <SortHead label="Target" column="target" sort={sort} onToggle={toggle} />
            <SortHead label="Period" column="period" sort={sort} onToggle={toggle} />
            <TableHead className="text-right">Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-mono text-xs">{row.node.code ?? "—"}</TableCell>
              <TableCell className="min-w-48">{planNodeLabel(row.node)}</TableCell>
              <TableCell className="text-xs">{planTypeLabel(row.node.type)}</TableCell>
              <TableCell className="font-mono text-xs">{row.parent?.code ?? "—"}</TableCell>
              <TableCell className="text-xs">{row.node.orgNode?.name ?? "—"}</TableCell>
              <TableCell className="text-xs">
                {row.node.targetValue === null || row.node.targetValue === undefined
                  ? "—"
                  : `${row.node.targetValue}${row.node.unit ? ` ${row.node.unit}` : ""}`}
              </TableCell>
              <TableCell className="text-xs">{formatPeriod(row.node)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => onView(row)}>
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export interface BatchReviewViewProps {
  batch: BatchDetail;
  organizationName: string;
  canApprove: boolean;
  currentUserId?: string | null;
  comments: string;
  onCommentsChange: (value: string) => void;
  onDecide: (decision: BatchDecision) => void;
  decisionPending: boolean;
  decisionError: string | null;
}

export function BatchReviewView({
  batch,
  organizationName,
  canApprove,
  currentUserId,
  comments,
  onCommentsChange,
  onDecide,
  decisionPending,
  decisionError,
}: BatchReviewViewProps) {
  const isMobile = useIsMobile();
  const counts = useMemo(() => countPlanByType(batch.plan), [batch.plan]);
  const orgUnitCount = useMemo(() => countPlanOrgUnits(batch.plan), [batch.plan]);
  const drift = useMemo(() => collectPlanDrift(batch.plan), [batch.plan]);
  const warnings = batch.warnings ?? [];

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [activeView, setActiveView] = useState<"structure" | "table">("structure");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    () => new Set(flattenPlan(batch.plan).filter((row) => row.depth < 2).map((row) => row.key)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const first = flattenPlan(batch.plan)[0];
    return first ? rowId(first) : null;
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const filtering = search.trim().length > 0 || typeFilter !== "ALL";
  const filteredPlan = useMemo(
    () =>
      filterPlanTree(
        batch.plan,
        (node) => (typeFilter === "ALL" || node.type === typeFilter) && matchesPlanSearch(node, search),
      ),
    [batch.plan, search, typeFilter],
  );
  const rows = useMemo(() => flattenPlan(filteredPlan), [filteredPlan]);
  const selectedRow = rows.find((row) => rowId(row) === selectedId) ?? rows[0] ?? null;

  const canDecide = canApprove && batch.status === "SUBMITTED";
  const totalElements = counts.reduce((sum, count) => sum + count.count, 0);
  const summaryLine = counts.map((count) => `${count.count} ${count.label}${count.count === 1 ? "" : "s"}`).join(", ");

  const selectRow = (row: FlatPlanNode) => {
    setSelectedId(rowId(row));
    if (isMobile) setSheetOpen(true);
  };

  const toggle = (key: string) =>
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const decide = (decision: BatchDecision) => {
    if (decision !== "APPROVE" && !comments.trim()) {
      setValidationError("Add a comment so the submitter knows what to change.");
      return;
    }
    setValidationError(null);
    onDecide(decision);
  };

  const detail = selectedRow ? <NodeDetail row={selectedRow} result={batch.result} /> : null;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryStat label="Elements" value={totalElements} />
        <SummaryStat label="Organization units" value={orgUnitCount} />
        <SummaryStat label="Warnings" value={warnings.length} tone={warnings.length ? "text-warn" : undefined} />
        <SummaryStat label="Org drift" value={drift.length} tone={drift.length ? "text-warn" : undefined} />
      </dl>

      {counts.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {counts.map((count) => (
            <span key={count.type} className="rounded-full border px-2.5 py-1">
              <span className="font-semibold text-foreground">{count.count}</span> {count.label}
              {count.count === 1 ? "" : "s"}
            </span>
          ))}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Mode</dt>
          <dd>{batchModeLabel(batch.mode)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Source</dt>
          <dd className="break-words">{batch.sourceFilename ?? batch.sourceKind ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Submitted</dt>
          <dd>
            {formatDate(batch.createdAt)}
            {batch.createdBy
              ? currentUserId && batch.createdBy === currentUserId
                ? " by you"
                : ` by ${batch.createdBy.slice(0, 8)}…`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Hierarchy</dt>
          <dd>{batch.strictTypeHierarchyUsed ? "Strict types enforced" : "Flexible types"}</dd>
        </div>
      </dl>

      {batch.status === "APPROVED" && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <div>
            <p className="font-medium text-success">Applied {formatDate(batch.appliedAt)}</p>
            <p className="text-muted-foreground">
              The plan is published. Each element below shows what the batch did to it.
            </p>
          </div>
        </div>
      )}

      {batch.status === "REJECTED" && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Rejected {formatDate(batch.decidedAt)}</p>
            <p className="text-muted-foreground">The plan was not applied. Read the reviewer's comment, then submit a corrected batch.</p>
          </div>
        </div>
      )}

      {batch.status === "REVISION_REQUESTED" && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/5 p-3 text-sm">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <div>
            <p className="font-medium text-warn">Revision requested {formatDate(batch.decidedAt)}</p>
            <p className="text-muted-foreground">The reviewer asked for changes. Read the comment, then submit a corrected batch.</p>
          </div>
        </div>
      )}

      {drift.length > 0 && batch.status === "SUBMITTED" && (
        <div role="status" className="rounded-lg border border-warn/40 bg-warn/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-warn">
            <AlertTriangle className="h-4 w-4 shrink-0" /> The organization changed after this plan was submitted
          </p>
          <p className="mt-1 text-foreground/80">
            {drift.length === 1 ? "One element's unit was" : `${drift.length} elements' units were`} renamed, moved or
            ended since submission
            {drift.length <= 3 ? `: ${drift.map(({ node }) => planNodeLabel(node)).join(", ")}.` : "."} Approving may be
            refused with a conflict; re-check the plan first.
          </p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Warnings from the check
          </p>
          <ul className="mt-2 space-y-1">
            {warnings.map((warning, index) => (
              <li key={`${warning.rule}-${index}`} className="text-warn">
                <span className="font-mono text-xs">{warning.rule}</span> {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {batch.approvalComments && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last reviewer comment</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{batch.approvalComments}</p>
        </div>
      )}

      {batch.status === "SUBMITTED" && !canApprove && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> You can read this batch. Deciding it needs the Strategy Approver
          role.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search elements"
            className="h-9 pl-8"
            placeholder="Search by title, code or org unit"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          aria-label="Filter by element type"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="ALL">All types</option>
          {counts.map((count) => (
            <option key={count.type} value={count.type}>
              {count.label}s
            </option>
          ))}
        </select>
        {activeView === "structure" && (
          <>
            <Button variant="outline" size="sm" onClick={() => setExpandedKeys(allPlanKeys(batch.plan))}>
              Expand all
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExpandedKeys(new Set())}>
              Collapse all
            </Button>
          </>
        )}
      </div>

      <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "structure" | "table")}>
        <TabsList aria-label="Batch views">
          <TabsTrigger value="structure" className="gap-1.5">
            <ListTree className="h-3.5 w-3.5" /> Structure
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-1.5">
            <Table2 className="h-3.5 w-3.5" /> Table
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="mt-3">
          {rows.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <Search className="h-5 w-5" />
                <p className="font-medium text-foreground">No elements match</p>
                <p>Clear the search or choose a different element type.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <Card className="min-w-0">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-sm">Plan structure</CardTitle>
                  <span className="text-xs text-muted-foreground">{rows.length} shown</span>
                </CardHeader>
                <CardContent className="max-h-[30rem] overflow-auto p-2">
                  <BatchPlanTree
                    nodes={filteredPlan}
                    selectedKey={selectedRow?.key ?? null}
                    onSelect={selectRow}
                    result={batch.result}
                    expandedKeys={filtering ? null : expandedKeys}
                    onToggle={filtering ? undefined : toggle}
                  />
                </CardContent>
              </Card>

              <Card className="hidden min-w-0 lg:block">
                <CardHeader>
                  <CardTitle className="text-sm">Element detail</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[30rem] overflow-auto">
                  {detail ?? <p className="text-sm text-muted-foreground">Select an element.</p>}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="table" className="mt-3">
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No elements match.
            </p>
          ) : (
            <PlanTable
              rows={rows}
              onView={(row) => {
                selectRow(row);
                setActiveView("structure");
              }}
            />
          )}
        </TabsContent>
      </Tabs>

      {isMobile && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{selectedRow ? planNodeLabel(selectedRow.node) : "Element detail"}</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{detail}</div>
          </SheetContent>
        </Sheet>
      )}

      {canDecide && (
        <div className="sticky bottom-0 z-10 space-y-3 rounded-t-xl border bg-background/95 p-4 backdrop-blur">
          <div className="space-y-1.5">
            <Label htmlFor="batch-review-comments">Comments</Label>
            <Textarea
              id="batch-review-comments"
              rows={2}
              maxLength={2000}
              placeholder="Required when you reject or ask for a revision"
              value={comments}
              onChange={(event) => onCommentsChange(event.target.value)}
              disabled={decisionPending}
            />
            <p className="text-xs text-muted-foreground">Required when you reject or ask for a revision.</p>
          </div>

          {currentUserId && batch.createdBy === currentUserId && (
            <p className="text-xs text-muted-foreground">
              You submitted this batch. If maker-checker is enabled, the server will refuse your decision and ask for
              another approver.
            </p>
          )}

          {validationError && (
            <p role="alert" className="text-sm text-destructive">
              {validationError}
            </p>
          )}
          {decisionError && (
            <p role="alert" className="text-sm text-destructive">
              {decisionError}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => decide("REQUEST_REVISION")} disabled={decisionPending}>
              Request revision
            </Button>
            <Button variant="outline" className="text-destructive" onClick={() => decide("REJECT")} disabled={decisionPending}>
              Reject
            </Button>
            <Button variant="brand" onClick={() => setConfirmOpen(true)} disabled={decisionPending}>
              {decisionPending ? "Saving…" : "Approve and apply"}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              Publishes {totalElements} element{totalElements === 1 ? "" : "s"} to {organizationName}: {summaryLine}.
              Published versions cannot be deleted, only archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {drift.length > 0 && (
            <p className="rounded-md border border-warn/40 bg-warn/5 p-2 text-sm text-warn">
              The organization changed after submission. The server may refuse this decision with a conflict.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={decisionPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={decisionPending}
              onClick={() => {
                setConfirmOpen(false);
                onDecide("APPROVE");
              }}
            >
              Approve and apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
