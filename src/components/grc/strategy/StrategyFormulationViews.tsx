import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isAxiosError } from "axios";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileClock,
  Gauge,
  History,
  Layers3,
  ListChecks,
  Network,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/grc/common/states";
import { MeterBar } from "@/components/grc/assessment/badges";
import {
  useArchiveStrategyElement,
  useCreateStrategyElement,
  useCreateStrategyVersion,
  usePublishStrategyVersion,
  useRecordStrategyApprovalDecision,
  useRecordStrategyProgress,
  useStrategyElementDetail,
  useStrategyProgressHistory,
  useStrategyVersion,
  useStrategyVersionHistory,
  useUpdateStrategyFormulationSettings,
} from "@/hooks/use-strategy-formulation";
import type {
  CreateStrategyElementRequest,
  StrategyElementType,
  StrategyFormulationSettings,
  StrategyInsights,
  StrategySummary,
  StrategyTreeNode,
  StrategyVersion,
  StrategyVersionStatus,
} from "@/lib/strategy-formulation-types";
import {
  elementCompletion,
  flattenStrategyTree,
  formatDateRange,
  statusCounts,
  strategyReadiness,
  STRATEGY_TYPE_LABELS,
  STRATEGY_TYPE_ORDER,
  type FlatStrategyNode,
  typeIconClass,
} from "@/lib/strategy-formulation-view";
import { cn } from "@/lib/utils";

interface OrgNodeOption {
  id: string;
  name: string;
}

interface SharedViewProps {
  tree: StrategyTreeNode[];
  summary?: StrategySummary;
  insights?: StrategyInsights;
  loading: boolean;
  error: unknown;
  canManage: boolean;
  onOpen: (elementId: string) => void;
  onNew: (type?: StrategyElementType) => void;
}

function errorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const body = error.response?.data as { message?: string; detail?: string } | undefined;
    return body?.message || body?.detail || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function validPeriod(start: string, end: string): boolean {
  return !start || !end || start <= end;
}

function numericValue(value: string, label: string, required: boolean): number | null {
  if (!value && !required) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid number`);
  return parsed;
}

export function StrategyStatusBadge({ status }: { status: StrategyVersionStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 text-[11px] font-medium",
        status === "PUBLISHED" && "border-success/40 bg-success/10 text-success",
        status === "DRAFT" && "border-warn/40 bg-warn/10 text-warn",
        status === "ARCHIVED" && "bg-muted text-muted-foreground",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status === "PUBLISHED" ? "Published" : status === "DRAFT" ? "Draft" : "Archived"}
    </Badge>
  );
}

export function StrategyTypeBadge({ type }: { type: StrategyElementType }) {
  return (
    <Badge variant="secondary" className="border-0 bg-muted text-[11px] font-medium text-foreground">
      {STRATEGY_TYPE_LABELS[type]}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: typeof Compass;
  tone?: "brand" | "success" | "warn" | "danger";
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-foreground">{value}</p>
          </div>
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              tone === "brand" && "bg-brand-accent/10 text-brand-accent",
              tone === "success" && "bg-success/12 text-success",
              tone === "warn" && "bg-warn/15 text-warn",
              tone === "danger" && "bg-destructive/10 text-destructive",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function QueryState({
  loading,
  error,
  label,
  children,
}: {
  loading: boolean;
  error: unknown;
  label: string;
  children: ReactNode;
}) {
  if (loading) return <ListSkeleton label={label} rows={5} />;
  if (error) return <ErrorState title={`Couldn't load ${label}`} message={errorMessage(error, `Failed to load ${label}`)} />;
  return children;
}

function LifecycleRail({ tree, insights }: { tree: StrategyTreeNode[]; insights?: StrategyInsights }) {
  const counts = statusCounts(tree);
  const published = insights?.currentPublishedElementCount ?? counts.PUBLISHED;
  const pending = insights?.pendingApprovalCount ?? 0;
  const outstanding = insights?.outstandingDraftCount ?? counts.DRAFT;
  const drafts = Math.max(0, outstanding - pending);
  const total = Math.max(1, published + drafts + pending);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-brand-accent" /> Publication health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex h-3 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${published} published, ${drafts} draft and ${pending} pending approval strategy elements`}
        >
          <span className="bg-success" style={{ width: `${(published / total) * 100}%` }} />
          <span className="bg-warn" style={{ width: `${(drafts / total) * 100}%` }} />
          <span className="bg-brand-accent" style={{ width: `${(pending / total) * 100}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            ["Published", published, "bg-success"],
            ["Draft", drafts, "bg-warn"],
            ["Approval", pending, "bg-brand-accent"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-lg bg-muted/55 p-3">
              <p className="text-xl font-semibold text-foreground">{value}</p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", String(color))} /> {label}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ReadinessPanel({ tree, onOpen }: { tree: StrategyTreeNode[]; onOpen: (id: string) => void }) {
  const readiness = strategyReadiness(tree);
  const incomplete = flattenStrategyTree(tree)
    .map((row) => ({ ...row, completion: elementCompletion(row.node) }))
    .filter((row) => row.completion.missing.length > 0)
    .slice(0, 5);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-royal" /> Formulation readiness
          </CardTitle>
          <span className="text-2xl font-semibold text-foreground">{readiness}%</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <MeterBar value={readiness} color="231 51% 50%" label="Strategy formulation readiness" />
        <p className="text-xs text-muted-foreground">
          Based on descriptions, responsible units, planning periods, outcomes, targets and units.
        </p>
        <Separator />
        {incomplete.length ? (
          <div className="space-y-2">
            {incomplete.map(({ node, completion }) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onOpen(node.id)}
                className="flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/5"
              >
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", typeIconClass(node.type))}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{node.title}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Missing {completion.missing.join(", ")}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> All available elements are complete.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StrategyOverviewView(props: SharedViewProps) {
  const { tree, summary, insights, loading, error, canManage, onOpen, onNew } = props;
  return (
    <QueryState loading={loading} error={error} label="strategy overview">
      <div className="space-y-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Strategy summary">
          <StatCard label="Pillars" value={summary?.pillarCount ?? "—"} hint="Organization-wide strategic anchors" icon={Compass} />
          <StatCard label="Objectives" value={summary?.objectiveCount ?? "—"} hint="Outcome-directed priorities" icon={Target} tone="success" />
          <StatCard label="Initiatives" value={summary?.initiativeCount ?? "—"} hint="Major transformation programs" icon={Layers3} tone="warn" />
          <StatCard label="KPIs" value={summary?.kpiCount ?? "—"} hint={`${summary?.activityCount ?? 0} supporting activities`} icon={TrendingUp} tone="danger" />
        </section>
        <div className="grid gap-5 lg:grid-cols-2">
          <LifecycleRail tree={tree} insights={insights} />
          <ReadinessPanel tree={tree} onOpen={onOpen} />
        </div>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm">Strategy blueprint</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">A quick read of the latest visible structure and publication state.</p>
            </div>
            {canManage && (
              <Button size="sm" variant="brand" onClick={() => onNew()}>
                <Plus /> New element
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {tree.length ? (
              <div className="space-y-2">
                {flattenStrategyTree(tree)
                  .filter((row) => row.depth < 2)
                  .slice(0, 6)
                  .map((row) => (
                    <button
                      key={row.node.id}
                      type="button"
                      onClick={() => onOpen(row.node.id)}
                      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/5"
                    >
                      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", typeIconClass(row.node.type))}>
                        {row.node.type === "KPI" ? <TrendingUp className="h-4 w-4" /> : <Network className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1" style={{ marginLeft: `${row.depth * 20}px` }}>
                        <span className="block truncate text-sm font-medium text-foreground">{row.node.title}</span>
                        <span className="block text-[11px] text-muted-foreground">{row.path.join("  ›  ")}</span>
                      </span>
                      <StrategyStatusBadge status={row.node.status} />
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
              </div>
            ) : (
              <EmptyState
                icon={Compass}
                title="Start with a strategic pillar"
                description="Pillars anchor every objective, initiative, activity and KPI in the formulation."
                action={canManage ? <Button variant="brand" onClick={() => onNew("PILLAR")}><Plus /> Create first pillar</Button> : undefined}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </QueryState>
  );
}

function TreeNodeRow({
  row,
  onOpen,
}: {
  row: FlatStrategyNode;
  onOpen: (elementId: string) => void;
}) {
  const completion = elementCompletion(row.node);
  return (
    <>
      <button
        type="button"
        onClick={() => onOpen(row.node.id)}
        className="group flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors last:border-0 hover:bg-brand-accent/5 sm:px-4"
      >
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", typeIconClass(row.node.type))}>
          {row.node.type === "PILLAR" ? <Compass className="h-4 w-4" /> : row.node.type === "KPI" ? <TrendingUp className="h-4 w-4" /> : <Network className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1" style={{ marginLeft: `${row.depth * 22}px` }}>
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{row.node.title}</span>
            <StrategyTypeBadge type={row.node.type} />
            <span className="text-[11px] text-muted-foreground">v{row.node.version}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{formatDateRange(row.node.periodStart, row.node.periodEnd)}</span>
            <span>{row.node.children.length} direct children</span>
            <span>{completion.score}% complete</span>
          </span>
        </span>
        <StrategyStatusBadge status={row.node.status} />
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
      {row.node.children.map((child) => (
        <TreeNodeRow key={child.id} row={{ node: child, depth: row.depth + 1, path: [...row.path, child.title] }} onOpen={onOpen} />
      ))}
    </>
  );
}

export function StrategyBlueprintView(props: SharedViewProps) {
  const { tree, loading, error, canManage, onOpen, onNew } = props;
  return (
    <QueryState loading={loading} error={error} label="strategy blueprint">
      {tree.length ? (
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b bg-muted/25 py-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm"><Network className="h-4 w-4 text-brand-accent" /> Recursive strategy hierarchy</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Pillars → objectives → initiatives → activities → KPIs</p>
            </div>
            {canManage && <Button size="sm" variant="brand" onClick={() => onNew()}><Plus /> New element</Button>}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y-0">
              {tree.map((node) => (
                <TreeNodeRow key={node.id} row={{ node, depth: 0, path: [node.title] }} onOpen={onOpen} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Network}
          title="No strategy blueprint yet"
          description="Create a pillar to begin connecting organizational goals to measurable work."
          action={canManage ? <Button variant="brand" onClick={() => onNew("PILLAR")}><Plus /> Create first pillar</Button> : undefined}
        />
      )}
    </QueryState>
  );
}

export function StrategyElementsView(props: SharedViewProps) {
  const { tree, loading, error, canManage, onOpen, onNew } = props;
  const [search, setSearch] = useState("");
  const [type, setType] = useState<StrategyElementType | "ALL">("ALL");
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return flattenStrategyTree(tree).filter(
      (row) =>
        (type === "ALL" || row.node.type === type) &&
        (!term || row.node.title.toLowerCase().includes(term) || row.node.description?.toLowerCase().includes(term)),
    );
  }, [search, tree, type]);
  return (
    <QueryState loading={loading} error={error} label="strategy elements">
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="strategy-search">Search elements</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="strategy-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or description" className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="strategy-element-type">Element type</Label>
              <Select value={type} onValueChange={(value) => setType(value as StrategyElementType | "ALL")}>
                <SelectTrigger id="strategy-element-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All element types</SelectItem>
                  {STRATEGY_TYPE_ORDER.map((value) => <SelectItem key={value} value={value}>{STRATEGY_TYPE_LABELS[value]}s</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canManage && <Button variant="brand" onClick={() => onNew()}><Plus /> New element</Button>}
          </CardContent>
        </Card>
        {rows.length ? (
          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b py-3">
              <CardTitle className="text-sm">Element register</CardTitle>
              <Badge variant="secondary">{rows.length} shown</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {rows.map((row) => (
                <button key={row.node.id} type="button" onClick={() => onOpen(row.node.id)} className="flex w-full items-center gap-3 border-b p-4 text-left transition-colors last:border-0 hover:bg-brand-accent/5">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", typeIconClass(row.node.type))}>
                    {row.node.type === "KPI" ? <TrendingUp className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium text-foreground">{row.node.title}</span><StrategyTypeBadge type={row.node.type} /></span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{row.path.join("  ›  ")}</span>
                  </span>
                  <span className="hidden text-xs text-muted-foreground md:block">{formatDateRange(row.node.periodStart, row.node.periodEnd)}</span>
                  <StrategyStatusBadge status={row.node.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        ) : (
          <EmptyState icon={Search} title="No matching elements" description={tree.length ? "Try a different search or element type." : "Create the first strategy pillar to populate the register."} action={canManage && !tree.length ? <Button variant="brand" onClick={() => onNew("PILLAR")}><Plus /> Create pillar</Button> : undefined} />
        )}
      </div>
    </QueryState>
  );
}

export function StrategyKpisView(props: SharedViewProps) {
  const { tree, loading, error, canManage, onOpen, onNew } = props;
  const kpis = flattenStrategyTree(tree).filter((row) => row.node.type === "KPI");
  return (
    <QueryState loading={loading} error={error} label="KPI register">
      {kpis.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kpis.map(({ node, path }) => (
            <Card key={node.id} className="group transition-colors hover:border-brand-accent/40">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent"><TrendingUp className="h-5 w-5" /></span>
                  <StrategyStatusBadge status={node.status} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{node.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{node.description || "No KPI description"}</p>
                <div className="mt-4 rounded-lg bg-muted/55 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Target</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{node.targetValue ?? "—"} {node.unit || ""}</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="truncate text-[11px] text-muted-foreground">{path.slice(0, -1).join(" › ")}</span>
                  <Button size="sm" variant="outline" onClick={() => onOpen(node.id)}>{canManage ? "Log progress" : "View KPI"}<ArrowRight /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={TrendingUp} title="No KPIs defined" description="Add a KPI beneath an initiative to begin collecting target and raw progress observations." action={canManage ? <Button variant="brand" onClick={() => onNew("KPI")}><Plus /> Add KPI</Button> : undefined} />
      )}
    </QueryState>
  );
}

export function StrategyInsightsView(props: SharedViewProps) {
  const { tree, insights, loading, error, onOpen } = props;
  return (
    <QueryState loading={loading} error={error} label="strategy insights">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><BarChart3 className="h-4 w-4 text-brand-accent" /> Formulation insights</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-gradient-to-br from-brand-accent/10 to-royal/5 p-5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Current published</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{insights?.currentPublishedElementCount ?? "—"}</p>
              <p className="mt-2 text-xs text-muted-foreground">Authoritative elements currently in force</p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Action required</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><p className="text-2xl font-semibold text-warn">{insights?.outstandingDraftCount ?? "—"}</p><p className="text-[11px] text-muted-foreground">Outstanding drafts</p></div>
                <div><p className="text-2xl font-semibold text-brand-accent">{insights?.pendingApprovalCount ?? "—"}</p><p className="text-[11px] text-muted-foreground">Pending approval</p></div>
              </div>
            </div>
            <div className="rounded-xl border p-5 sm:col-span-2">
              <div className="flex items-end justify-between gap-3">
                <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">KPI reporting coverage</p><p className="mt-2 text-2xl font-semibold text-foreground">{insights?.kpisWithProgressCount ?? 0} of {insights?.kpiCount ?? 0}</p></div>
                <span className="text-sm font-medium text-success">{insights?.kpiCount ? Math.round(((insights.kpisWithProgressCount ?? 0) / insights.kpiCount) * 100) : 0}%</span>
              </div>
              <MeterBar className="mt-4" value={insights?.kpiCount ? ((insights.kpisWithProgressCount ?? 0) / insights.kpiCount) * 100 : 0} color="158 53% 49%" label="KPI reporting coverage" />
              <p className="mt-3 text-xs text-muted-foreground">{insights?.kpisWithoutProgressCount ?? 0} KPIs have no raw progress observations yet.</p>
            </div>
          </CardContent>
        </Card>
        <ReadinessPanel tree={tree} onOpen={onOpen} />
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-sm">Portfolio snapshot</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-5">
            {STRATEGY_TYPE_ORDER.map((type) => {
              const count = flattenStrategyTree(tree).filter((row) => row.node.type === type).length;
              return (
                <div key={type} className="rounded-lg border p-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{STRATEGY_TYPE_LABELS[type]}s</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{count}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </QueryState>
  );
}

function expectedParentType(type: StrategyElementType): StrategyElementType | null {
  return type === "OBJECTIVE"
    ? "PILLAR"
    : type === "INITIATIVE"
      ? "OBJECTIVE"
      : type === "ACTIVITY" || type === "KPI"
        ? "INITIATIVE"
        : null;
}

function defaultParent(type: StrategyElementType, rows: FlatStrategyNode[]): string {
  const wanted = expectedParentType(type);
  return wanted ? rows.filter((row) => row.node.type === wanted).at(-1)?.node.id ?? "" : "";
}

export function CreateStrategyElementDialog({
  open,
  onOpenChange,
  orgId,
  tree,
  orgNodes,
  orgNodesError,
  initialType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  tree: StrategyTreeNode[];
  orgNodes: OrgNodeOption[];
  orgNodesError: unknown;
  initialType: StrategyElementType;
}) {
  const mutation = useCreateStrategyElement(orgId);
  const rows = useMemo(() => flattenStrategyTree(tree), [tree]);
  const [type, setType] = useState<StrategyElementType>(initialType);
  const parentRows = useMemo(() => {
    const parentType = expectedParentType(type);
    return parentType ? rows.filter((row) => row.node.type === parentType) : [];
  }, [rows, type]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [parentElementId, setParentElementId] = useState(() => defaultParent(initialType, rows));
  const [orgNodeId, setOrgNodeId] = useState("");
  const [outcomeSummary, setOutcomeSummary] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Element title required");
      return;
    }
    if (type !== "PILLAR" && (!parentElementId || !orgNodeId)) {
      toast.error("Select a parent and responsible unit");
      return;
    }
    if (!validPeriod(periodStart, periodEnd)) {
      toast.error("Period end must be on or after period start");
      return;
    }
    let parsedTarget: number | null = null;
    try {
      parsedTarget = numericValue(targetValue, "Target value", false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid target value");
      return;
    }
    const body: CreateStrategyElementRequest = {
      type,
      orgNodeId: type === "PILLAR" ? null : orgNodeId,
      parentElementId: type === "PILLAR" ? null : parentElementId,
      title: title.trim(),
      description: description.trim() || null,
      outcomeSummary: type === "ACTIVITY" ? outcomeSummary.trim() || null : null,
      targetValue: ["ACTIVITY", "KPI"].includes(type) ? parsedTarget : null,
      unit: ["ACTIVITY", "KPI"].includes(type) ? unit.trim() || null : null,
      periodStart: ["INITIATIVE", "ACTIVITY", "KPI"].includes(type) ? periodStart || null : null,
      periodEnd: ["INITIATIVE", "ACTIVITY", "KPI"].includes(type) ? periodEnd || null : null,
    };
    try {
      await mutation.mutateAsync(body);
      toast.success(`${STRATEGY_TYPE_LABELS[type]} draft created`);
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create strategy element"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create strategy element</DialogTitle>
          <DialogDescription>Creates the stable element and immutable version 1 as a draft.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="new-element-type">Element type *</Label><Select value={type} onValueChange={(value) => { const next = value as StrategyElementType; setType(next); setParentElementId(defaultParent(next, rows)); }}><SelectTrigger id="new-element-type"><SelectValue /></SelectTrigger><SelectContent>{STRATEGY_TYPE_ORDER.map((value) => <SelectItem key={value} value={value}>{STRATEGY_TYPE_LABELS[value]}</SelectItem>)}</SelectContent></Select></div>
          {type !== "PILLAR" && <div className="space-y-1.5"><Label htmlFor="new-element-parent">Parent element *</Label><Select value={parentElementId} onValueChange={setParentElementId} disabled={!parentRows.length}><SelectTrigger id="new-element-parent"><SelectValue placeholder="Select parent" /></SelectTrigger><SelectContent>{parentRows.map((row) => <SelectItem key={row.node.id} value={row.node.id}>{row.path.join(" › ")}</SelectItem>)}</SelectContent></Select></div>}
          {type !== "PILLAR" && <div className="space-y-1.5"><Label htmlFor="new-element-unit">Responsible unit *</Label><Select value={orgNodeId} onValueChange={setOrgNodeId} disabled={!orgNodes.length}><SelectTrigger id="new-element-unit"><SelectValue placeholder="Select unit" /></SelectTrigger><SelectContent>{orgNodes.map((node) => <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>)}</SelectContent></Select></div>}
          {type !== "PILLAR" && orgNodesError && <div className="md:col-span-2"><ErrorState title="Responsible units unavailable" message={errorMessage(orgNodesError, "The organization unit lookup failed. Confirm that you have orgnode.view permission.")} /></div>}
          {type !== "PILLAR" && !orgNodesError && !orgNodes.length && <div className="rounded-lg border border-warn/30 bg-warn/5 p-3 text-xs text-warn md:col-span-2">No active organization units are available. Ask an administrator to grant orgnode.view or activate a responsible unit.</div>}
          <div className="space-y-1.5 md:col-span-2"><Label htmlFor="new-strategy-title">Title *</Label><Input id="new-strategy-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Give this strategy element a clear name" /></div>
          <div className="space-y-1.5 md:col-span-2"><Label htmlFor="new-strategy-description">Description</Label><Textarea id="new-strategy-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain the intended outcome or purpose" /></div>
          {["INITIATIVE", "ACTIVITY", "KPI"].includes(type) && <><div className="space-y-1.5"><Label htmlFor="period-start">Period start</Label><Input id="period-start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="period-end">Period end</Label><Input id="period-end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></div></>}
          {type === "ACTIVITY" && <div className="space-y-1.5 md:col-span-2"><Label htmlFor="outcome-summary">Outcome summary</Label><Textarea id="outcome-summary" value={outcomeSummary} onChange={(event) => setOutcomeSummary(event.target.value)} placeholder="Describe the expected result of this activity" /></div>}
          {["ACTIVITY", "KPI"].includes(type) && <><div className="space-y-1.5"><Label htmlFor="target-value">Target value</Label><Input id="target-value" type="number" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="target-unit">Unit</Label><Input id="target-unit" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="%, days, incidents…" /></div></>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button><Button variant="brand" onClick={submit} disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create draft"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StrategySettingsDialog({
  open,
  onOpenChange,
  orgId,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  settings: StrategyFormulationSettings;
}) {
  const mutation = useUpdateStrategyFormulationSettings(orgId);
  const [requiresApproval, setRequiresApproval] = useState(settings.requiresApproval);
  const [strictTypeHierarchy, setStrictTypeHierarchy] = useState(settings.strictTypeHierarchy);
  useEffect(() => { setRequiresApproval(settings.requiresApproval); setStrictTypeHierarchy(settings.strictTypeHierarchy); }, [settings]);
  const save = async () => {
    try {
      await mutation.mutateAsync({ requiresApproval, strictTypeHierarchy });
      toast.success("Strategy settings updated");
      onOpenChange(false);
    } catch (error) { toast.error(errorMessage(error, "Failed to update strategy settings")); }
  };
  return (
    <Dialog open={open} onOpenChange={mutation.isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Strategy settings</DialogTitle><DialogDescription>Control publication governance for this organization.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4"><div><Label htmlFor="requires-approval">Require publication approval</Label><p className="mt-1 text-xs text-muted-foreground">Drafts enter an approval queue before becoming current.</p></div><Switch id="requires-approval" checked={requiresApproval} onCheckedChange={setRequiresApproval} /></div>
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4"><div><Label htmlFor="strict-hierarchy">Strict type hierarchy</Label><p className="mt-1 text-xs text-muted-foreground">Persisted governance setting; server enforcement may be deferred.</p></div><Switch id="strict-hierarchy" checked={strictTypeHierarchy} onCheckedChange={setStrictTypeHierarchy} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button><Button variant="brand" onClick={save} disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save settings"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiProgressPanel({ orgId, elementId, target, unit, canManage }: { orgId: string; elementId: string; target: number | null; unit: string | null; canManage: boolean }) {
  const historyQuery = useStrategyProgressHistory(orgId, elementId);
  const mutation = useRecordStrategyProgress(orgId);
  const [reportedValue, setReportedValue] = useState("");
  const [note, setNote] = useState("");
  const latest = historyQuery.data?.[0];
  const progress = latest?.reportedValue != null && target && target > 0 ? Math.min(100, Math.max(0, (latest.reportedValue / target) * 100)) : 0;
  const submit = async () => {
    let value: number | null = null;
    try {
      value = numericValue(reportedValue, "Reported value", false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid reported value");
      return;
    }
    if (value === null && !note.trim()) { toast.error("Enter a reported value or note"); return; }
    try {
      await mutation.mutateAsync({ elementId, body: value === null ? { reportedValue: null, note: note.trim() } : { reportedValue: value, note: note.trim() || null } });
      setReportedValue(""); setNote(""); toast.success("KPI progress recorded");
    } catch (error) { toast.error(errorMessage(error, "Failed to record KPI progress")); }
  };
  return (
    <div className="space-y-4 rounded-xl border bg-muted/25 p-4">
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">KPI progress</p><p className="text-xs text-muted-foreground">Raw observations; scoring stays in assessment.</p></div><TrendingUp className="h-5 w-5 text-brand-accent" /></div>
      <div className="rounded-lg bg-background p-3"><div className="flex items-end justify-between"><div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Latest observation</p><p className="mt-1 text-2xl font-semibold text-foreground">{latest?.reportedValue ?? "—"} {unit || ""}</p></div>{target !== null && <span className="text-xs text-muted-foreground">Target {target} {unit || ""}</span>}</div>{latest?.reportedValue != null && target && target > 0 && <MeterBar className="mt-3" value={progress} color="158 53% 49%" label="Latest reported value against target" />}</div>
      {canManage ? <div className="grid gap-3 sm:grid-cols-[150px_1fr_auto] sm:items-end"><div className="space-y-1.5"><Label htmlFor="reported-value">Reported value</Label><Input id="reported-value" type="number" value={reportedValue} onChange={(event) => setReportedValue(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="progress-note">Observation note</Label><Input id="progress-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional context" /></div><Button variant="brand" onClick={submit} disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Record"}</Button></div> : <p className="text-xs text-muted-foreground">Read-only view. A strategy manager can record raw KPI observations.</p>}
      {historyQuery.isLoading ? <p className="text-xs text-muted-foreground">Loading progress history…</p> : historyQuery.error ? <p className="text-xs text-destructive">{errorMessage(historyQuery.error, "Failed to load KPI progress history")}</p> : historyQuery.data?.length ? <div className="space-y-2">{historyQuery.data.slice(0, 4).map((entry) => <div key={entry.id} className="flex items-start justify-between gap-3 border-t pt-2 text-xs"><div><p className="font-medium text-foreground">{entry.reportedValue ?? "Note only"} {entry.reportedValue !== null ? unit || "" : ""}</p>{entry.note && <p className="text-muted-foreground">{entry.note}</p>}</div><span className="shrink-0 text-muted-foreground">{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(entry.recordedAt))}</span></div>)}</div> : <p className="text-xs text-muted-foreground">No progress observations recorded.</p>}
    </div>
  );
}

function VersionTimeline({ versions, onSelect, selectedId }: { versions: StrategyVersion[]; onSelect: (id: string) => void; selectedId?: string }) {
  if (!versions.length) return <p className="text-xs text-muted-foreground">No version history is available.</p>;
  return (
    <div className="space-y-0">
      {versions.map((version, index) => (
        <button key={version.versionId} type="button" onClick={() => onSelect(version.versionId)} className={cn("relative flex w-full gap-3 pb-4 text-left last:pb-0", selectedId === version.versionId && "text-brand-accent")}>
          <span className="relative flex w-5 shrink-0 justify-center"><span className={cn("relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background", version.current ? "bg-success" : version.status === "DRAFT" ? "bg-warn" : "bg-muted-foreground")} />{index < versions.length - 1 && <span className="absolute bottom-0 top-4 w-px bg-border" />}</span>
          <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-sm font-medium text-foreground">Version {version.version}</span><StrategyStatusBadge status={version.status} />{version.current && <span className="text-[11px] font-medium text-success">Current</span>}</span><span className="mt-1 block text-xs text-muted-foreground">{version.title}</span><span className="mt-1 block text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(version.versionCreatedAt))}</span></span>
        </button>
      ))}
    </div>
  );
}

export function StrategyElementDetailSheet({
  orgId,
  elementId,
  open,
  onOpenChange,
  canManage,
}: {
  orgId: string;
  elementId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const detailQuery = useStrategyElementDetail(orgId, open ? elementId ?? undefined : undefined);
  const historyQuery = useStrategyVersionHistory(orgId, open ? elementId ?? undefined : undefined);
  const [selectedVersionId, setSelectedVersionId] = useState<string>();
  const versionQuery = useStrategyVersion(orgId, open ? elementId ?? undefined : undefined, selectedVersionId);
  const createVersion = useCreateStrategyVersion(orgId);
  const publish = usePublishStrategyVersion(orgId);
  const decision = useRecordStrategyApprovalDecision(orgId);
  const archive = useArchiveStrategyElement(orgId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [outcomeSummary, setOutcomeSummary] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [pendingApprovalVersionId, setPendingApprovalVersionId] = useState<string>();
  const initializedElementId = useRef<string>();
  const detail = detailQuery.data;
  const source = detail?.draftVersion ?? detail?.currentVersion;
  useEffect(() => {
    if (!detail || initializedElementId.current === detail.id) return;
    initializedElementId.current = detail.id;
    setSelectedVersionId(undefined);
    setEditing(false);
    setPendingApprovalVersionId(undefined);
    setTitle(source?.title ?? "");
    setDescription(source?.description ?? "");
    setOutcomeSummary(source?.outcomeSummary ?? "");
    setTargetValue(source?.targetValue === null || source?.targetValue === undefined ? "" : String(source.targetValue));
    setUnit(source?.unit ?? "");
    setPeriodStart(source?.periodStart ?? "");
    setPeriodEnd(source?.periodEnd ?? "");
  }, [detail, source]);
  const saveVersion = async () => {
    if (!elementId || !title.trim()) { toast.error("Element title required"); return; }
    if (!validPeriod(periodStart, periodEnd)) { toast.error("Period end must be on or after period start"); return; }
    let parsedTarget: number | null = null;
    try {
      parsedTarget = numericValue(targetValue, "Target value", false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid target value");
      return;
    }
    try {
      await createVersion.mutateAsync({ elementId, body: { title: title.trim(), description: description.trim() || null, outcomeSummary: outcomeSummary.trim() || null, targetValue: parsedTarget, unit: unit.trim() || null, periodStart: periodStart || null, periodEnd: periodEnd || null } });
      toast.success("New draft version created"); setEditing(false);
    } catch (error) { toast.error(errorMessage(error, "Failed to create a new version")); }
  };
  const publishDraft = async () => {
    if (!elementId || !detail?.draftVersion) return;
    try { const result = await publish.mutateAsync({ elementId, versionId: detail.draftVersion.id }); if (!result.current) setPendingApprovalVersionId(result.versionId); toast.success(result.current ? "Version published" : "Version submitted for approval"); }
    catch (error) { toast.error(errorMessage(error, "Failed to publish version")); }
  };
  const recordDecision = async (value: "APPROVE" | "REJECT" | "REQUEST_REVISION") => {
    if (!elementId || !detail?.draftVersion) return;
    try { await decision.mutateAsync({ elementId, versionId: detail.draftVersion.id, body: { decision: value, comments: null } }); setPendingApprovalVersionId(undefined); toast.success(value === "APPROVE" ? "Version approved and published" : value === "REJECT" ? "Version rejected" : "Revision requested"); }
    catch (error) { toast.error(errorMessage(error, "Failed to record approval decision")); }
  };
  const archiveElement = async () => {
    if (!elementId) return;
    try { await archive.mutateAsync(elementId); toast.success("Element archived"); onOpenChange(false); }
    catch (error) { toast.error(errorMessage(error, "Failed to archive element")); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle className="pr-8">{detail?.type ? STRATEGY_TYPE_LABELS[detail.type] : "Strategy element"}</SheetTitle><SheetDescription>Server-authoritative element, immutable versions and lifecycle actions.</SheetDescription></SheetHeader>
        {detailQuery.isLoading ? <div className="mt-6"><ListSkeleton label="element detail" rows={3} /></div> : detailQuery.error || !detail ? <div className="mt-6"><ErrorState title="Couldn't load element" message={errorMessage(detailQuery.error, "The element may be outside your assigned scope.")} /></div> : (
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center gap-2"><StrategyTypeBadge type={detail.type} />{detail.currentVersion && <StrategyStatusBadge status={detail.currentVersion.status} />}{detail.draftVersion && <Badge variant="outline" className="border-brand-accent/40 bg-brand-accent/10 text-brand-accent">Draft v{detail.draftVersion.version}</Badge>}</div>
            <div className="rounded-xl border bg-muted/25 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-semibold text-foreground">{source?.title ?? "Untitled element"}</p><p className="mt-1 text-sm text-muted-foreground">{source?.description || "No description provided."}</p></div>{canManage && !detail.draftVersion && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><FileClock /> New version</Button>}</div></div>
            {editing ? <div className="space-y-3 rounded-xl border border-brand-accent/30 bg-brand-accent/5 p-4"><div className="space-y-1.5"><Label htmlFor="version-title">Title *</Label><Input id="version-title" value={title} onChange={(event) => setTitle(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="version-description">Description</Label><Textarea id="version-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div>{detail.type === "ACTIVITY" && <div className="space-y-1.5"><Label htmlFor="version-outcome">Outcome summary</Label><Textarea id="version-outcome" value={outcomeSummary} onChange={(event) => setOutcomeSummary(event.target.value)} /></div>}{["ACTIVITY", "KPI"].includes(detail.type) && <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="version-target">Target</Label><Input id="version-target" type="number" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="version-unit">Unit</Label><Input id="version-unit" value={unit} onChange={(event) => setUnit(event.target.value)} /></div></div>}{["INITIATIVE", "ACTIVITY", "KPI"].includes(detail.type) && <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="version-period-start">Period start</Label><Input id="version-period-start" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="version-period-end">Period end</Label><Input id="version-period-end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></div></div>}<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button variant="brand" onClick={saveVersion} disabled={createVersion.isPending}>{createVersion.isPending ? "Saving…" : "Create draft"}</Button></div></div> : null}
            <div className="grid grid-cols-2 gap-3 text-xs"><div className="rounded-lg border p-3"><p className="text-muted-foreground">Current version</p><p className="mt-1 font-medium text-foreground">{detail.currentVersion ? `v${detail.currentVersion.version} · ${detail.currentVersion.status.toLowerCase()}` : "Not published"}</p></div><div className="rounded-lg border p-3"><p className="text-muted-foreground">Draft version</p><p className="mt-1 font-medium text-foreground">{detail.draftVersion ? `v${detail.draftVersion.version}` : "None"}</p></div></div>
            {canManage && detail.draftVersion && !editing && <div className="rounded-xl border border-warn/30 bg-warn/5 p-4"><p className="text-sm font-semibold text-foreground">Draft workflow</p><p className="mt-1 text-xs text-muted-foreground">{pendingApprovalVersionId === detail.draftVersion.id ? "This draft is awaiting an approval decision." : "Submit this draft to begin the publication workflow."}</p><div className="mt-3 flex flex-wrap gap-2">{pendingApprovalVersionId === detail.draftVersion.id ? <><Button size="sm" variant="brand" onClick={() => recordDecision("APPROVE")} disabled={decision.isPending}><CheckCircle2 /> Approve</Button><Button size="sm" variant="outline" onClick={() => recordDecision("REQUEST_REVISION")} disabled={decision.isPending}><History /> Request revision</Button><Button size="sm" variant="outline" onClick={() => recordDecision("REJECT")} disabled={decision.isPending}><XCircle /> Reject</Button></> : <Button size="sm" variant="brand" onClick={publishDraft} disabled={publish.isPending}><Send /> {publish.isPending ? "Submitting…" : "Submit for publication"}</Button>}</div></div>}
            {detail.type === "KPI" && <KpiProgressPanel orgId={orgId} elementId={detail.id} target={detail.currentVersion?.targetValue ?? null} unit={detail.currentVersion?.unit ?? null} canManage={canManage} />}
            <div className="grid gap-5 md:grid-cols-2"><div><div className="mb-3 flex items-center gap-2"><History className="h-4 w-4 text-brand-accent" /><p className="text-sm font-semibold text-foreground">Version history</p></div>{historyQuery.error ? <p className="text-xs text-destructive">{errorMessage(historyQuery.error, "Failed to load version history")}</p> : <VersionTimeline versions={historyQuery.data ?? []} onSelect={setSelectedVersionId} selectedId={selectedVersionId} />}</div><div><div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-accent" /><p className="text-sm font-semibold text-foreground">Selected version</p></div>{versionQuery.isLoading ? <p className="text-xs text-muted-foreground">Loading exact version…</p> : versionQuery.error ? <p className="text-xs text-destructive">{errorMessage(versionQuery.error, "Failed to load the exact version")}</p> : versionQuery.data ? <div className="rounded-lg border p-3 text-xs"><p className="font-medium text-foreground">Version {versionQuery.data.version} · {versionQuery.data.status}</p><p className="mt-2 text-muted-foreground">{versionQuery.data.description || "No description"}</p><p className="mt-2 text-muted-foreground">Created {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(versionQuery.data.versionCreatedAt))}</p></div> : <p className="text-xs text-muted-foreground">Select a version to inspect its exact stored value.</p>}</div></div>
            {canManage && detail.currentVersion?.current && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">Archive element</p><p className="mt-1 text-xs text-muted-foreground">The stable element and full version history remain available.</p></div><Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={archiveElement} disabled={archive.isPending}>{archive.isPending ? "Archiving…" : "Archive"}</Button></div></div>}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
