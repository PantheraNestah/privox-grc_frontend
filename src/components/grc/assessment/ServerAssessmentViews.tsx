import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plus, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAmendAssessment,
  useAssessment,
  useAssessmentSettings,
  useAssessmentSummary,
  useCreateAssessment,
  useDecideRevision,
  useDiscardRevision,
  usePendingApprovals,
  useResyncRevision,
  useRollup,
  useSaveDraft,
  useSubmitRevision,
  useUpdateAssessmentSettings,
  useWorklist,
  type AssessmentPeriod,
} from "@/hooks/use-strategy-assessment";
import {
  assessmentErrorMessage,
  ragLabel,
  type AssessmentDecision,
  type AssessmentRevision,
  type AssessmentSettings,
  type AssessmentRevisionStatus,
  type InitiativeStatus,
  type KpiLine,
  type Rag,
  type WorklistRow,
} from "@/lib/strategy-assessment";
import { cn } from "@/lib/utils";

const INITIATIVE_STATUS: Record<InitiativeStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const REVISION_STATUS: Record<AssessmentRevisionStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVISION_REQUESTED: "Changes requested",
  DISCARDED: "Discarded",
};

const RAG_CLASS: Record<Rag, string> = {
  GREEN: "bg-success",
  AMBER: "bg-warn",
  RED: "bg-destructive",
  NOT_RATED: "bg-muted-foreground",
};

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

function RagDot({ rag }: { rag: Rag | null | undefined }) {
  const key: Rag = rag ?? "NOT_RATED";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span aria-hidden className={cn("h-2 w-2 rounded-full", RAG_CLASS[key])} />
      {ragLabel(key)}
    </span>
  );
}

/** The quarter that contains `date`, as YYYY-MM-DD bounds. */
export function currentQuarter(date = new Date()): AssessmentPeriod {
  const quarter = Math.floor(date.getMonth() / 3);
  const start = new Date(date.getFullYear(), quarter * 3, 1);
  const end = new Date(date.getFullYear(), quarter * 3 + 3, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { periodStart: iso(start), periodEnd: iso(end) };
}

/* ---------- Period bar ---------- */

export function PeriodBar({ period, onChange }: { period: AssessmentPeriod; onChange: (next: AssessmentPeriod) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="period-start" className="text-xs">From</Label>
        <Input
          id="period-start"
          type="date"
          className="h-9 w-40"
          value={period.periodStart}
          onChange={(e) => onChange({ ...period, periodStart: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="period-end" className="text-xs">To</Label>
        <Input
          id="period-end"
          type="date"
          className="h-9 w-40"
          value={period.periodEnd}
          onChange={(e) => onChange({ ...period, periodEnd: e.target.value })}
        />
      </div>
      <Button variant="ghost" size="sm" onClick={() => onChange(currentQuarter())}>
        This quarter
      </Button>
    </div>
  );
}

/* ---------- Worklist ---------- */

export function WorklistView({
  orgId,
  period,
  canContribute,
}: {
  orgId: string;
  period: AssessmentPeriod;
  canContribute: boolean;
}) {
  const [status, setStatus] = useState<AssessmentRevisionStatus | "">("");
  const [open, setOpen] = useState<WorklistRow | null>(null);
  const worklist = useWorklist(orgId, period, status || undefined);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-sm">Initiatives</CardTitle>
        <select
          aria-label="Filter by status"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as AssessmentRevisionStatus | "")}
        >
          <option value="">All</option>
          {(Object.keys(REVISION_STATUS) as AssessmentRevisionStatus[]).map((value) => (
            <option key={value} value={value}>
              {REVISION_STATUS[value]}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent>
        {worklist.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {worklist.error && <p className="text-sm text-destructive">Could not load initiatives.</p>}
        {worklist.data && worklist.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No published initiatives in this period.</p>
        )}
        {worklist.data && worklist.data.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Initiative</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">RAG</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {worklist.data.map((row) => (
                  <tr
                    key={row.elementId}
                    onClick={() => setOpen(row)}
                    className="cursor-pointer transition hover:bg-muted/40"
                  >
                    <td className="px-3 py-2">
                      <span className="font-medium">{row.elementTitle}</span>
                      {row.elementCode && <span className="ml-2 font-mono text-xs text-muted-foreground">{row.elementCode}</span>}
                      {row.overdue && <Badge variant="outline" className="ml-2 text-[10px] text-warn">Overdue</Badge>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.orgNodeName ?? "—"}</td>
                    <td className="px-3 py-2">{row.status ? REVISION_STATUS[row.status] : "Not started"}</td>
                    <td className="px-3 py-2 tabular-nums">{row.computedScore != null ? `${Math.round(row.computedScore)}%` : "—"}</td>
                    <td className="px-3 py-2"><RagDot rag={row.finalRag ?? row.computedRag} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <AssessmentDialog
        orgId={orgId}
        row={open}
        period={period}
        canContribute={canContribute}
        onClose={() => setOpen(null)}
      />
    </Card>
  );
}

/* ---------- Assessment dialog ---------- */

function AssessmentDialog({
  orgId,
  row,
  period,
  canContribute,
  onClose,
}: {
  orgId: string;
  row: WorklistRow | null;
  period: AssessmentPeriod;
  canContribute: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={row !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {/* Keyed by row so each initiative starts with its own state. */}
        {row && <AssessmentBody key={row.elementId} orgId={orgId} row={row} period={period} canContribute={canContribute} />}
      </DialogContent>
    </Dialog>
  );
}

function AssessmentBody({
  orgId,
  row,
  period,
  canContribute,
}: {
  orgId: string;
  row: WorklistRow;
  period: AssessmentPeriod;
  canContribute: boolean;
}) {
  const [assessmentId, setAssessmentId] = useState<string | null>(row.assessmentId);
  const create = useCreateAssessment(orgId);
  const amend = useAmendAssessment(orgId);
  const detail = useAssessment(orgId, assessmentId);
  const [error, setError] = useState<string | null>(null);

  const revision: AssessmentRevision | null = detail.data?.openRevision ?? detail.data?.currentRevision ?? null;
  const canAmend = Boolean(detail.data && !detail.data.openRevision && detail.data.currentRevision);

  const start = async () => {
    setError(null);
    try {
      const created = await create.mutateAsync({ strategyElementId: row.elementId, ...period });
      setAssessmentId(created.assessmentId);
    } catch (err) {
      setError(assessmentErrorMessage(err));
    }
  };

  const startAmend = async () => {
    if (!assessmentId) return;
    setError(null);
    try {
      await amend.mutateAsync(assessmentId);
    } catch (err) {
      setError(assessmentErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{row.elementTitle}</DialogTitle>
        <DialogDescription>
          {row.orgNodeName ?? "No unit"} · {row.periodStart} to {row.periodEnd}
        </DialogDescription>
      </DialogHeader>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {!assessmentId && (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-sm text-muted-foreground">Not assessed for this period yet.</p>
          <Button variant="brand" onClick={start} disabled={!canContribute || create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Start assessment
          </Button>
        </div>
      )}

      {assessmentId && detail.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}

      {revision && (
        <RevisionEditor
          key={`${revision.revisionId}-${revision.lockVersion}`}
          orgId={orgId}
          revision={revision}
          canEdit={canContribute && revision.status === "DRAFT"}
          onError={setError}
        />
      )}

      {assessmentId && detail.data && !revision && <p className="text-sm text-muted-foreground">No revision to show.</p>}

      {canAmend && (
        <div className="flex justify-end border-t pt-4">
          <Button variant="outline" onClick={startAmend} disabled={!canContribute || amend.isPending}>
            {amend.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Amend
          </Button>
        </div>
      )}
    </>
  );
}

/* ---------- Revision editor ---------- */

interface LineDraft {
  kpiElementId: string;
  actualValue: string;
  actualSource: KpiLine["actualSource"];
  note: string;
}

function RevisionEditor({
  orgId,
  revision,
  canEdit,
  onError,
}: {
  orgId: string;
  revision: AssessmentRevision;
  canEdit: boolean;
  onError: (message: string | null) => void;
}) {
  const save = useSaveDraft(orgId);
  const submit = useSubmitRevision(orgId);
  const resync = useResyncRevision(orgId);
  const discard = useDiscardRevision(orgId);

  const [initiativeStatus, setInitiativeStatus] = useState<InitiativeStatus>(revision.initiativeStatus);
  const [narrative, setNarrative] = useState(revision.narrative ?? "");
  const [overrideRag, setOverrideRag] = useState<Rag | "">(revision.overrideRag && revision.overrideRag !== "NOT_RATED" ? revision.overrideRag : "");
  const [overrideReason, setOverrideReason] = useState(revision.overrideReason ?? "");
  const [lines, setLines] = useState<LineDraft[]>(() =>
    revision.kpiLines.map((line) => ({
      kpiElementId: line.kpiElementId,
      actualValue: line.actualValue != null ? String(line.actualValue) : "",
      actualSource: line.actualSource ?? "MANUAL",
      note: line.note ?? "",
    })),
  );
  const [evidence, setEvidence] = useState(revision.evidence);
  const [newEvidence, setNewEvidence] = useState({ name: "", url: "" });
  const [localError, setLocalError] = useState<string | null>(null);

  const busy = save.isPending || submit.isPending || resync.isPending || discard.isPending;
  const readOnly = !canEdit;

  const body = () => ({
    lockVersion: revision.lockVersion,
    initiativeStatus,
    narrative: narrative.trim() || null,
    overrideRag: overrideRag || null,
    overrideReason: overrideReason.trim() || null,
    kpiLines: lines.map((line) => ({
      kpiElementId: line.kpiElementId,
      actualValue: line.actualValue.trim() === "" ? null : Number(line.actualValue),
      actualSource: line.actualSource ?? "MANUAL",
      note: line.note.trim() || null,
    })),
    evidence,
  });

  const validate = (): string | null => {
    if (overrideRag && !overrideReason.trim()) return "Give a reason for the rating override.";
    const bad = lines.find((line) => line.actualValue.trim() !== "" && !Number.isFinite(Number(line.actualValue)));
    if (bad) return "Actual values must be numbers.";
    return null;
  };

  const saveDraft = async () => {
    const problem = validate();
    setLocalError(problem);
    if (problem) return null;
    onError(null);
    try {
      return await save.mutateAsync({ revisionId: revision.revisionId, body: body() });
    } catch (err) {
      onError(assessmentErrorMessage(err));
      return null;
    }
  };

  const onSave = async (event?: FormEvent) => {
    event?.preventDefault();
    const saved = await saveDraft();
    if (saved) toast.success("Draft saved");
  };

  const onSubmit = async () => {
    const saved = await saveDraft();
    if (!saved) return;
    try {
      const result = await submit.mutateAsync(revision.revisionId);
      toast.success(result.httpStatus === 202 ? "Sent for approval" : "Approved");
    } catch (err) {
      onError(assessmentErrorMessage(err));
    }
  };

  const onResync = async () => {
    try {
      await resync.mutateAsync(revision.revisionId);
      toast.success("Draft refreshed from the latest initiative");
    } catch (err) {
      onError(assessmentErrorMessage(err));
    }
  };

  const onDiscard = async () => {
    try {
      await discard.mutateAsync(revision.revisionId);
      toast.success("Draft discarded");
    } catch (err) {
      onError(assessmentErrorMessage(err));
    }
  };

  const addEvidence = () => {
    const name = newEvidence.name.trim();
    const url = newEvidence.url.trim();
    if (!name || !/^https?:\/\//i.test(url)) {
      setLocalError("Evidence needs a name and an http(s) link.");
      return;
    }
    if (evidence.length >= 20) {
      setLocalError("Up to 20 evidence links.");
      return;
    }
    setEvidence([...evidence, { name, url }]);
    setNewEvidence({ name: "", url: "" });
    setLocalError(null);
  };

  return (
    <form onSubmit={onSave} className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{REVISION_STATUS[revision.status]}</Badge>
        <span className="text-xs text-muted-foreground">Revision {revision.revision}</span>
        {revision.stale && (
          <span className="text-xs text-warn">The initiative changed since this draft. Refresh it before submitting.</span>
        )}
        {revision.approvalComments && revision.status !== "APPROVED" && (
          <span className="w-full text-xs text-muted-foreground">Reviewer: {revision.approvalComments}</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="initiative-status" className="text-xs">Initiative status</Label>
          <select
            id="initiative-status"
            className={inputClass}
            value={initiativeStatus}
            onChange={(e) => setInitiativeStatus(e.target.value as InitiativeStatus)}
            disabled={readOnly || busy}
          >
            {(Object.keys(INITIATIVE_STATUS) as InitiativeStatus[]).map((value) => (
              <option key={value} value={value}>{INITIATIVE_STATUS[value]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="override-rag" className="text-xs">Override rating</Label>
          <select
            id="override-rag"
            className={inputClass}
            value={overrideRag}
            onChange={(e) => setOverrideRag(e.target.value as Rag | "")}
            disabled={readOnly || busy}
          >
            <option value="">Use computed ({ragLabel(revision.computedRag)})</option>
            <option value="GREEN">Green</option>
            <option value="AMBER">Amber</option>
            <option value="RED">Red</option>
          </select>
        </div>
      </div>

      {overrideRag && (
        <div className="space-y-1.5">
          <Label htmlFor="override-reason" className="text-xs">Reason for override</Label>
          <Input
            id="override-reason"
            value={overrideReason}
            maxLength={2000}
            onChange={(e) => setOverrideReason(e.target.value)}
            disabled={readOnly || busy}
          />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">KPIs</p>
        {lines.length === 0 && <p className="text-sm text-muted-foreground">This initiative has no KPIs.</p>}
        {lines.map((line, index) => {
          const source = revision.kpiLines.find((k) => k.kpiElementId === line.kpiElementId);
          return (
            <div key={line.kpiElementId} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{source?.title ?? "KPI"}</p>
                <p className="text-xs text-muted-foreground">
                  Target {source?.targetValue ?? "—"} {source?.unit ?? ""}
                </p>
              </div>
              <Input
                aria-label={`Actual for ${source?.title ?? "KPI"}`}
                inputMode="decimal"
                placeholder="Actual"
                className="h-9"
                value={line.actualValue}
                disabled={readOnly || busy}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...line, actualValue: e.target.value };
                  setLines(next);
                }}
              />
              <div className="flex items-center text-xs">
                <RagDot rag={source?.rag} />
                {source?.achievementPct != null && (
                  <span className="ml-2 tabular-nums text-muted-foreground">{Math.round(source.achievementPct)}%</span>
                )}
              </div>
              <Input
                aria-label={`Note for ${source?.title ?? "KPI"}`}
                placeholder="Note"
                className="h-9"
                value={line.note}
                disabled={readOnly || busy}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...line, note: e.target.value };
                  setLines(next);
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="narrative" className="text-xs">Narrative</Label>
        <Textarea
          id="narrative"
          rows={3}
          maxLength={10000}
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          disabled={readOnly || busy}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Evidence ({evidence.length}/20)</p>
        {evidence.map((item, index) => (
          <div key={`${item.url}-${index}`} className="flex items-center gap-2 text-sm">
            <a href={item.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-brand-accent hover:underline">
              {item.name}
            </a>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${item.name}`}
                onClick={() => setEvidence(evidence.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {!readOnly && (
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <Input
              aria-label="Evidence name"
              placeholder="Name"
              className="h-9"
              value={newEvidence.name}
              onChange={(e) => setNewEvidence({ ...newEvidence, name: e.target.value })}
            />
            <Input
              aria-label="Evidence link"
              placeholder="https://"
              className="h-9"
              value={newEvidence.url}
              onChange={(e) => setNewEvidence({ ...newEvidence, url: e.target.value })}
            />
            <Button type="button" variant="outline" size="sm" onClick={addEvidence}>Add</Button>
          </div>
        )}
      </div>

      {localError && <p role="alert" className="text-sm text-destructive">{localError}</p>}

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          {revision.stale && (
            <Button type="button" variant="outline" onClick={onResync} disabled={busy}>Refresh from initiative</Button>
          )}
          <Button type="button" variant="ghost" onClick={onDiscard} disabled={busy}>Discard</Button>
          <Button type="submit" variant="outline" disabled={busy}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
          <Button type="button" variant="brand" onClick={onSubmit} disabled={busy}>
            {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </div>
      )}
    </form>
  );
}

/* ---------- Approvals ---------- */

export function ApprovalsView({ orgId, canApprove }: { orgId: string; canApprove: boolean }) {
  const pending = usePendingApprovals(orgId);
  const [selected, setSelected] = useState<AssessmentRevision | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Awaiting decision</CardTitle>
        <CardDescription>{canApprove ? "Review and decide." : "Assessments routed to you for review."}</CardDescription>
      </CardHeader>
      <CardContent>
        {pending.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {pending.data && pending.data.length === 0 && <p className="text-sm text-muted-foreground">Nothing to decide.</p>}
        {pending.data && pending.data.length > 0 && (
          <ul className="divide-y rounded-md border">
            {pending.data.map((revision) => (
              <ApprovalRow key={revision.revisionId} orgId={orgId} revision={revision} canApprove={canApprove} onOpen={() => setSelected(revision)} />
            ))}
          </ul>
        )}
      </CardContent>
      <DecisionDialog orgId={orgId} revision={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

function ApprovalRow({
  orgId,
  revision,
  canApprove,
  onOpen,
}: {
  orgId: string;
  revision: AssessmentRevision;
  canApprove: boolean;
  onOpen: () => void;
}) {
  const detail = useAssessment(orgId, revision.assessmentId);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        disabled={!canApprove}
        className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <span className="min-w-0 flex-1 truncate font-medium">{detail.data?.elementTitle ?? "Initiative"}</span>
        <RagDot rag={revision.finalRag ?? revision.computedRag} />
        <span className="text-xs text-muted-foreground">Revision {revision.revision}</span>
        {revision.submittedAt && (
          <span className="text-xs text-muted-foreground">{new Date(revision.submittedAt).toLocaleDateString()}</span>
        )}
      </button>
    </li>
  );
}

function DecisionDialog({ orgId, revision, onClose }: { orgId: string; revision: AssessmentRevision | null; onClose: () => void }) {
  return (
    <Dialog open={revision !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl">
        {revision && <DecisionBody key={revision.revisionId} orgId={orgId} revision={revision} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function DecisionBody({ orgId, revision, onClose }: { orgId: string; revision: AssessmentRevision; onClose: () => void }) {
  const decide = useDecideRevision(orgId);
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const detail = useAssessment(orgId, revision.assessmentId);

  const decideWith = async (decision: AssessmentDecision) => {
    if (decision !== "APPROVE" && !comments.trim()) {
      setError("Add a comment so the owner knows what to change.");
      return;
    }
    setError(null);
    try {
      await decide.mutateAsync({ revisionId: revision.revisionId, decision, comments: comments.trim() || undefined });
      toast.success(decision === "APPROVE" ? "Approved" : "Decision recorded");
      onClose();
    } catch (err) {
      setError(assessmentErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{detail.data?.elementTitle ?? "Assessment"}</DialogTitle>
        <DialogDescription>Revision {revision.revision}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <RagDot rag={revision.finalRag ?? revision.computedRag} />
              {revision.computedScore != null && <span className="tabular-nums">{Math.round(revision.computedScore)}%</span>}
              {revision.initiativeStatus && <span className="text-muted-foreground">{INITIATIVE_STATUS[revision.initiativeStatus]}</span>}
            </div>
            {revision.narrative && <p className="whitespace-pre-wrap break-words text-sm">{revision.narrative}</p>}
            <div className="space-y-2">
              <Label htmlFor="decision-comments" className="text-xs">Comments</Label>
              <Textarea
                id="decision-comments"
                rows={3}
                maxLength={2000}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                disabled={decide.isPending}
              />
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => decideWith("REQUEST_REVISION")} disabled={decide.isPending}>Request changes</Button>
              <Button variant="outline" onClick={() => decideWith("REJECT")} disabled={decide.isPending}>Reject</Button>
              <Button variant="brand" onClick={() => decideWith("APPROVE")} disabled={decide.isPending}>
                {decide.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve
              </Button>
            </div>
      </div>
    </>
  );
}

/* ---------- Reports ---------- */

export function ReportsView({ orgId, period }: { orgId: string; period: AssessmentPeriod }) {
  const summary = useAssessmentSummary(orgId, period);
  const rollup = useRollup(orgId, period);
  const items = [
    ["Initiatives", summary.data?.initiativesCount],
    ["Drafts", summary.data?.draftCount],
    ["Awaiting approval", summary.data?.submittedCount],
    ["Approved", summary.data?.approvedCount],
    ["Rejected", summary.data?.rejectedCount],
    ["Overdue", summary.data?.overdueCount],
  ] as const;

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-background p-3">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">By pillar</CardTitle>
        </CardHeader>
        <CardContent>
          {rollup.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
          {rollup.data && rollup.data.length === 0 && <p className="text-sm text-muted-foreground">No pillars yet.</p>}
          {rollup.data && rollup.data.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Pillar</th>
                    <th className="px-3 py-2 font-medium">Assessed</th>
                    <th className="px-3 py-2 font-medium">Coverage</th>
                    <th className="px-3 py-2 font-medium">Average</th>
                    <th className="px-3 py-2 font-medium">Green / Amber / Red</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rollup.data.map((pillar) => (
                    <tr key={pillar.pillarId}>
                      <td className="px-3 py-2 font-medium">{pillar.pillarTitle}</td>
                      <td className="px-3 py-2 tabular-nums">{pillar.assessedCount} / {pillar.assessableCount}</td>
                      <td className="px-3 py-2 tabular-nums">{Math.round(pillar.coverage)}%</td>
                      <td className="px-3 py-2 tabular-nums">{pillar.averageScore != null ? `${Math.round(pillar.averageScore)}%` : "—"}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {pillar.ragDistribution.GREEN} / {pillar.ragDistribution.AMBER} / {pillar.ragDistribution.RED}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Settings ---------- */

export function AssessmentSettingsDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const settings = useAssessmentSettings(orgId);
  const update = useUpdateAssessmentSettings(orgId);
  const [draft, setDraft] = useState<{ requiresApproval: boolean; ragGreenMin: string; ragAmberMin: string; assessmentFrequency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = draft ?? (settings.data
    ? {
        requiresApproval: settings.data.requiresApproval,
        ragGreenMin: String(settings.data.ragGreenMin),
        ragAmberMin: String(settings.data.ragAmberMin),
        assessmentFrequency: settings.data.assessmentFrequency ?? "",
      }
    : null);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!current) return;
    const green = Number(current.ragGreenMin);
    const amber = Number(current.ragAmberMin);
    if (!Number.isFinite(green) || !Number.isFinite(amber) || amber >= green) {
      setError("Amber must be below green.");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({
        requiresApproval: current.requiresApproval,
        ragGreenMin: green,
        ragAmberMin: amber,
        assessmentFrequency: (current.assessmentFrequency || null) as AssessmentSettings["assessmentFrequency"],
      });
      toast.success("Settings saved");
      setDraft(null);
      onOpenChange(false);
    } catch (err) {
      setError(assessmentErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assessment settings</DialogTitle>
        </DialogHeader>
        {current && (
          <form onSubmit={save} className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={current.requiresApproval}
                onChange={(e) => setDraft({ ...current, requiresApproval: e.target.checked })}
              />
              Require approval
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="green-min" className="text-xs">Green from (%)</Label>
                <Input id="green-min" inputMode="decimal" className="h-9" value={current.ragGreenMin} onChange={(e) => setDraft({ ...current, ragGreenMin: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amber-min" className="text-xs">Amber from (%)</Label>
                <Input id="amber-min" inputMode="decimal" className="h-9" value={current.ragAmberMin} onChange={(e) => setDraft({ ...current, ragAmberMin: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency" className="text-xs">Review frequency</Label>
              <select
                id="frequency"
                className={inputClass}
                value={current.assessmentFrequency}
                onChange={(e) => setDraft({ ...current, assessmentFrequency: e.target.value })}
              >
                <option value="">None</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUALLY">Annually</option>
              </select>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" variant="brand" disabled={update.isPending}>
                {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </form>
        )}
        {!current && settings.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {settings.error && <p className="text-sm text-destructive">Could not load settings.</p>}
      </DialogContent>
    </Dialog>
  );
}

