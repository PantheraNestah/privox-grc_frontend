import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eraser,
  FileJson,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useBatchDecision,
  useBatchDryRun,
  useBatchSubmit,
  useStrategyBatch,
  useStrategyBatches,
  useStrategyConformance,
  useStrategyHierarchyRules,
} from "@/hooks/use-strategy-batches";
import {
  batchErrorMessage,
  exportFormulation,
  formatIssueSource,
  fetchBatchSchema,
  fetchTemplate,
  saveBlob,
  type BatchAction,
  type BatchDecision,
  type BatchDetail,
  type BatchIssue,
  type BatchMode,
  type BatchReport,
  type BatchStatus,
  type BatchTreeNode,
  type TemplateKind,
} from "@/lib/strategy-batches";
import { parsePlanText, type PlanParseResult } from "@/lib/strategy-plan-text";
import { cn } from "@/lib/utils";
import { PlanEditor, PlanPreview } from "@/components/grc/strategy/PlanEditor";

const STATUS_LABEL: Record<BatchStatus, string> = {
  SUBMITTED: "Awaiting decision",
  APPROVED: "Applied",
  REJECTED: "Rejected",
  REVISION_REQUESTED: "Revision requested",
};

const ACTION_LABEL: Record<BatchAction, string> = {
  CREATE: "Create",
  NEW_VERSION: "New version",
  UNCHANGED: "Unchanged",
};

const MODE_HELP: Record<BatchMode, string> = {
  CREATE_ONLY: "Only adds new elements. Existing codes are rejected.",
  UPSERT: "Adds new elements and publishes new versions of existing codes.",
};

export function StrategyBulkView({
  orgId,
  canContribute,
  canApprove,
  canManageSettings,
}: {
  orgId: string;
  canContribute: boolean;
  canApprove: boolean;
  canManageSettings: boolean;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <BulkImportCard orgId={orgId} canContribute={canContribute} />
        <BatchesCard orgId={orgId} canApprove={canApprove} />
      </div>
      <div className="space-y-5">
        <TemplatesCard orgId={orgId} />
        <RulesCard orgId={orgId} canManageSettings={canManageSettings} />
      </div>
    </div>
  );
}

/* ---------- Import ---------- */

function BulkImportCard({ orgId, canContribute }: { orgId: string; canContribute: boolean }) {
  const [text, setText] = useState("");
  const [spreadsheet, setSpreadsheet] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<BatchMode>("CREATE_ONLY");
  const [report, setReport] = useState<BatchReport | null>(null);
  const [checkedKey, setCheckedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dryRun = useBatchDryRun(orgId);
  const submit = useBatchSubmit(orgId);
  const parsed = useMemo<PlanParseResult | null>(() => (text.trim() ? parsePlanText(text) : null), [text]);
  const busy = dryRun.isPending || submit.isPending;

  // Either a JSON plan in the editor or a spreadsheet, never both.
  const hasSource = spreadsheet !== null || (parsed !== null && parsed.ok);
  const currentKey = spreadsheet
    ? `file|${spreadsheet.name}|${spreadsheet.size}|${spreadsheet.lastModified}|${mode}`
    : parsed?.ok
      ? `json|${text}|${mode}`
      : null;
  const isChecked = currentKey !== null && checkedKey === currentKey;
  const canSubmit = canContribute && isChecked && report?.outcome !== "INVALID";

  const input = (dry: boolean) => {
    if (spreadsheet) {
      return {
        source: {
          kind: "file" as const,
          file: spreadsheet,
          options: { name: name.trim() || spreadsheet.name, mode, dryRun: dry },
        },
        mode,
      };
    }
    return { source: { kind: "json" as const, plan: parsed?.ok ? parsed.value : null }, mode };
  };

  const changeText = (next: string) => {
    setText(next);
    setSpreadsheet(null);
    setReport(null);
    setCheckedKey(null);
    setError(null);
  };

  const onOpenFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      setSpreadsheet(file);
      setText("");
      setReport(null);
      setCheckedKey(null);
      setError(null);
      return;
    }
    changeText(await file.text());
  };

  const runCheck = async () => {
    setError(null);
    try {
      const result = await dryRun.mutateAsync(input(true) as Parameters<typeof dryRun.mutateAsync>[0]);
      setReport(result.report);
      setCheckedKey(currentKey);
    } catch (err) {
      setReport(null);
      setError(batchErrorMessage(err));
    }
  };

  const runSubmit = async () => {
    setError(null);
    try {
      const result = await submit.mutateAsync(input(false) as Parameters<typeof submit.mutateAsync>[0]);
      setReport(result.report);
      if (result.httpStatus === 422) {
        setCheckedKey(null);
        return;
      }
      toast.success(
        result.httpStatus === 202
          ? "Sent for approval."
          : `Applied ${result.report.summary.total} elements.`,
      );
      changeText("");
      setSpreadsheet(null);
      setName("");
    } catch (err) {
      setError(batchErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Upload className="h-4 w-4 text-brand-accent" /> Bulk import
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="When a code already exists"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as BatchMode)}
            disabled={busy}
          >
            <option value="CREATE_ONLY">Create only</option>
            <option value="UPSERT">Create or update</option>
          </select>
          <Input
            aria-label="Batch name"
            className="h-9 w-48"
            value={name}
            maxLength={200}
            placeholder={spreadsheet ? spreadsheet.name : "Batch name"}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            <FileJson className="h-4 w-4" /> Open file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.xlsx"
            className="hidden"
            onChange={(e) => void onOpenFile(e)}
            aria-label="Open plan file"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="min-w-0">
            {spreadsheet ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center">
                <FileSpreadsheet className="h-8 w-8 text-brand-accent" />
                <p className="text-sm font-medium">{spreadsheet.name}</p>
                <p className="text-xs text-muted-foreground">Spreadsheet plans are checked on the server.</p>
                <Button variant="ghost" size="sm" onClick={() => changeText("")} disabled={busy}>
                  <Eraser className="h-4 w-4" /> Remove
                </Button>
              </div>
            ) : (
              <PlanEditor value={text} onChange={changeText} disabled={busy} parsed={parsed} />
            )}
          </div>
          <div className="min-w-0 space-y-4">
            <PlanPreview parsed={spreadsheet ? null : parsed} />
            {report && <BatchReportView report={report} />}
          </div>
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!canContribute && <span className="mr-auto text-xs text-muted-foreground">Read only</span>}
          <Button variant="outline" onClick={runCheck} disabled={!hasSource || busy || !canContribute}>
            {dryRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {dryRun.isPending ? "Checking…" : "Check"}
          </Button>
          <Button variant="brand" onClick={runSubmit} disabled={!canSubmit || busy}>
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {submit.isPending ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const OUTCOME_COPY: Record<BatchReport["outcome"], { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  VALID: { label: "Valid. Ready to submit.", tone: "text-success", icon: CheckCircle2 },
  INVALID: { label: "Invalid. Fix the errors below.", tone: "text-destructive", icon: XCircle },
  PENDING_APPROVAL: { label: "Would be sent for approval.", tone: "text-warn", icon: AlertTriangle },
  APPLIED: { label: "Applied.", tone: "text-success", icon: CheckCircle2 },
};

export function BatchReportView({ report }: { report: BatchReport }) {
  const outcome = OUTCOME_COPY[report.outcome];
  const Icon = outcome.icon;
  const { summary } = report;
  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <p className={cn("flex items-center gap-2 text-sm font-medium", outcome.tone)}>
        <Icon className="h-4 w-4" /> {outcome.label}
        {report.dryRun && <Badge variant="outline">Dry run, nothing written</Badge>}
      </p>

      <dl className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
        <Stat label="Elements" value={summary.total} />
        <Stat label="Create" value={summary.create} />
        <Stat label="New version" value={summary.newVersion} />
        <Stat label="Unchanged" value={summary.unchanged} />
        <Stat label="Errors" value={summary.errors} tone={summary.errors ? "text-destructive" : undefined} />
        <Stat label="Warnings" value={summary.warnings} tone={summary.warnings ? "text-warn" : undefined} />
      </dl>

      {report.issues.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Issues{report.issuesTruncated ? " (first 500 shown)" : ""}
          </p>
          <ul className="divide-y rounded-md border bg-background">
            {report.issues.map((issue, index) => (
              <IssueRow key={`${issue.rule}-${index}`} issue={issue} />
            ))}
          </ul>
        </div>
      )}

      {report.tree.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Planned structure</p>
          <div className="max-h-96 overflow-auto rounded-md border bg-background p-2">
            <TreePreview nodes={report.tree} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md bg-background p-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg font-semibold", tone)}>{value}</dd>
    </div>
  );
}

function IssueRow({ issue }: { issue: BatchIssue }) {
  const isError = issue.severity === "ERROR";
  return (
    <li className="flex gap-3 px-3 py-2 text-sm">
      <span className={cn("mt-0.5 shrink-0 text-xs font-semibold", isError ? "text-destructive" : "text-warn")}>
        {isError ? "Error" : "Warning"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words">{issue.message}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{issue.rule}</span>
          {issue.item ? ` · ${issue.item}` : ""}
          {formatIssueSource(issue.source) ? ` · at ${formatIssueSource(issue.source)}` : ""}
        </p>
      </div>
    </li>
  );
}

function TreePreview({ nodes, depth = 0 }: { nodes: BatchTreeNode[]; depth?: number }) {
  return (
    <ul className="space-y-1">
      {nodes.map((node, index) => (
        <li key={`${node.code ?? node.title ?? "node"}-${index}`}>
          <div className="flex flex-wrap items-center gap-2 text-sm" style={{ paddingLeft: depth * 16 }}>
            <Badge variant="outline" className="font-mono text-[10px]">{node.type}</Badge>
            <span className="font-medium">{node.title ?? node.code ?? "Untitled"}</span>
            {node.code && <span className="font-mono text-xs text-muted-foreground">{node.code}</span>}
            <span className={cn("text-xs", node.action === "UNCHANGED" ? "text-muted-foreground" : "text-brand-accent")}>
              {ACTION_LABEL[node.action]}
            </span>
            {node.status !== "OK" && (
              <span className={cn("text-xs font-semibold", node.status === "ERROR" ? "text-destructive" : "text-warn")}>
                {node.status === "ERROR" ? "Error" : "Warning"}
              </span>
            )}
            {node.orgNode?.path && (
              <span className="text-xs text-muted-foreground">
                → {node.orgNode.path}
                {node.orgNode.matchedBy === "INHERITED" ? " (inherited)" : ""}
              </span>
            )}
          </div>
          {node.children && node.children.length > 0 && <TreePreview nodes={node.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Templates & export ---------- */

function TemplatesCard({ orgId }: { orgId: string }) {
  const [pending, setPending] = useState<string | null>(null);

  const download = async (key: string, run: () => Promise<Blob>, filename: string) => {
    setPending(key);
    try {
      saveBlob(await run(), filename);
    } catch (err) {
      toast.error(batchErrorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const actions: Array<{ key: string; label: string; icon: typeof Download; run: () => Promise<Blob>; file: string }> = [
    { key: "tpl-json", label: "JSON template (with examples)", icon: FileJson, run: () => fetchTemplate(orgId, "json"), file: "strategy-plan-template.json" },
    { key: "tpl-xlsx", label: "Excel template (with examples)", icon: FileSpreadsheet, run: () => fetchTemplate(orgId, "xlsx"), file: "strategy-plan-template.xlsx" },
    { key: "schema", label: "JSON schema", icon: FileJson, run: () => fetchBatchSchema(orgId), file: "strategy-plan-schema.json" },
    { key: "export-json", label: "Export current plan (JSON)", icon: Download, run: () => exportFormulation(orgId, "json" as TemplateKind), file: "strategy-plan-export.json" },
    { key: "export-xlsx", label: "Export current plan (Excel)", icon: Download, run: () => exportFormulation(orgId, "xlsx"), file: "strategy-plan-export.xlsx" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Download className="h-4 w-4 text-brand-accent" /> Templates and export
        </CardTitle>
        <CardDescription>Start a plan from a template, or export what is published now.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.key}
              variant="outline"
              className="justify-start"
              disabled={pending !== null}
              onClick={() => void download(action.key, action.run, action.file)}
            >
              {pending === action.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              {action.label}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ---------- Rules & conformance ---------- */

function RulesCard({ orgId, canManageSettings }: { orgId: string; canManageSettings: boolean }) {
  const rules = useStrategyHierarchyRules(orgId);
  // The conformance list needs organization.manage on the server.
  const conformance = useStrategyConformance(orgId, canManageSettings);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-brand-accent" /> Hierarchy rules
        </CardTitle>
        <CardDescription>
          {rules.data?.strictTypeHierarchy
            ? "Strict: a child must sit under a strictly higher level."
            : "Relaxed: any non-KPI element may sit under any non-pillar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rules.isPending && <p className="text-sm text-muted-foreground">Loading rules…</p>}
        {rules.error && <p className="text-sm text-destructive">Could not load the hierarchy rules.</p>}
        {rules.data && (
          <ul className="space-y-1.5 text-sm">
            {rules.data.rules.map((rule) => (
              <li key={rule.childType} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{rule.childType}</span>
                <span className="text-muted-foreground">
                  under {rule.allowedParentTypes.length ? rule.allowedParentTypes.join(", ") : "nothing (root only)"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {canManageSettings && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conformance</p>
            {conformance.isPending && <p className="text-sm text-muted-foreground">Checking…</p>}
            {conformance.error && <p className="text-sm text-destructive">Could not load conformance.</p>}
            {conformance.data && conformance.data.nonConformingElementCount === 0 && (
              <p className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> Every element follows the current rules.
              </p>
            )}
            {conformance.data && conformance.data.nonConformingElementCount > 0 && (
              <>
                <p className="text-sm text-warn">
                  {conformance.data.nonConformingElementCount} element
                  {conformance.data.nonConformingElementCount === 1 ? "" : "s"} break the current rules. Changing the
                  rules never rewrites them, so fix them by hand.
                </p>
                <ul className="max-h-48 space-y-1 overflow-auto text-xs">
                  {conformance.data.elements.map((el) => (
                    <li key={el.id} className="flex flex-wrap gap-x-2">
                      <span className="font-mono">{el.code ?? el.id.slice(0, 8)}</span>
                      <span>{el.type}</span>
                      <span className="text-muted-foreground">
                        under {el.parentType ?? "—"}
                        {el.orgNodeName ? ` · ${el.orgNodeName}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Batches ---------- */

function BatchesCard({ orgId, canApprove }: { orgId: string; canApprove: boolean }) {
  const [status, setStatus] = useState<BatchStatus | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useStrategyBatches(orgId, status || undefined);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-sm">Batches</CardTitle>
          <CardDescription>
            {canApprove ? "Review submitted plans and decide on them." : "Plans you and your colleagues submitted."}
          </CardDescription>
        </div>
        <select
          aria-label="Filter batches by status"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as BatchStatus | "")}
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as BatchStatus[]).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent>
        {list.isPending && <p className="text-sm text-muted-foreground">Loading batches…</p>}
        {list.error && <p className="text-sm text-destructive">Could not load batches.</p>}
        {list.data && list.data.length === 0 && <p className="text-sm text-muted-foreground">No batches yet.</p>}
        {list.data && list.data.length > 0 && (
          <ul className="divide-y rounded-md border">
            {list.data.map((batch) => (
              <li key={batch.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(batch.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-muted/50"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{batch.name}</span>
                  <Badge variant={batch.status === "APPROVED" ? "secondary" : "outline"}>{STATUS_LABEL[batch.status]}</Badge>
                  <span className="text-xs text-muted-foreground">{batch.mode === "UPSERT" ? "Create or update" : "Create only"}</span>
                  <span className="text-xs text-muted-foreground">{batch.elementCount} elements</span>
                  <span className="text-xs text-muted-foreground">{new Date(batch.createdAt).toLocaleDateString()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <BatchDetailDialog
        orgId={orgId}
        batchId={selectedId}
        canApprove={canApprove}
        onClose={() => setSelectedId(null)}
      />
    </Card>
  );
}

function BatchDetailDialog({
  orgId,
  batchId,
  canApprove,
  onClose,
}: {
  orgId: string;
  batchId: string | null;
  canApprove: boolean;
  onClose: () => void;
}) {
  const detail = useStrategyBatch(orgId, batchId);
  const decide = useBatchDecision(orgId);
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);

  const batch: BatchDetail | undefined = detail.data;
  const canDecide = canApprove && batch?.status === "SUBMITTED";
  const tree = useMemo(() => batch?.tree ?? [], [batch]);

  const decideWith = async (decision: BatchDecision) => {
    if (!batch) return;
    if (decision !== "APPROVE" && !comments.trim()) {
      setError("Add a comment so the submitter knows what to change.");
      return;
    }
    setError(null);
    try {
      await decide.mutateAsync({ batchId: batch.id, decision, comments: comments.trim() || undefined });
      toast.success(decision === "APPROVE" ? "Batch approved and applied." : "Decision recorded.");
      setComments("");
      onClose();
    } catch (err) {
      // 409 means the organization changed since submission, so the plan must be re-checked.
      setError(batchErrorMessage(err));
    }
  };

  return (
    <Dialog open={batchId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{batch?.name ?? "Batch"}</DialogTitle>
          <DialogDescription>
            {batch ? `${STATUS_LABEL[batch.status]} · ${batch.elementCount} elements` : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {detail.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {detail.error && <p className="text-sm text-destructive">Could not load this batch.</p>}

        {batch && (
          <div className="space-y-4">
            {batch.pathChanged && (
              <p className="flex items-center gap-2 text-sm text-warn">
                <AlertTriangle className="h-4 w-4" /> An org node in this plan was renamed, moved or ended after it was
                submitted. Check the structure before you approve.
              </p>
            )}
            {batch.approvalComments && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Last comment</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{batch.approvalComments}</p>
              </div>
            )}
            {batch.warnings && batch.warnings.length > 0 && (
              <ul className="space-y-1 text-sm">
                {batch.warnings.map((warning, index) => (
                  <li key={`${warning.rule}-${index}`} className="text-warn">
                    {warning.message}
                  </li>
                ))}
              </ul>
            )}
            {tree.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-md border p-2">
                <TreePreview nodes={tree} />
              </div>
            )}

            {canDecide && (
              <div className="space-y-3 border-t pt-4">
                <Label htmlFor="batch-comments">Comments</Label>
                <Textarea
                  id="batch-comments"
                  rows={3}
                  maxLength={2000}
                  placeholder="Required when you reject or ask for a revision"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  disabled={decide.isPending}
                />
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={() => decideWith("REQUEST_REVISION")} disabled={decide.isPending}>
                    Request revision
                  </Button>
                  <Button variant="outline" onClick={() => decideWith("REJECT")} disabled={decide.isPending}>
                    Reject
                  </Button>
                  <Button variant="brand" onClick={() => decideWith("APPROVE")} disabled={decide.isPending}>
                    {decide.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Approve and apply
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
