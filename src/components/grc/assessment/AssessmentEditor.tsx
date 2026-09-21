import { Gauge, Lock, Rocket, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { assessmentScore, ragFromPercent, type InitiativeAssessment, type KpiAssessment } from "@/data/assessmentStore";
import type { Initiative, InitiativeStatus } from "@/data/strategyStore";
import { RagBadge } from "./badges";
import { CommentList } from "./CommentList";
import { EvidencePanel } from "./EvidencePanel";
import { KpiScoreCard } from "./KpiScoreCard";

interface AssessmentEditorProps {
  assessment: InitiativeAssessment;
  init: Initiative;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onUpdate: (mutate: (a: InitiativeAssessment) => InitiativeAssessment) => void;
  onSubmit: () => void;
}

/** Self-assessment dialog: initiative status, narrative, per-KPI scoring, evidence and comments. */
export function AssessmentEditor({
  assessment,
  init,
  currentUserId,
  currentUserName,
  onClose,
  onUpdate,
  onSubmit,
}: AssessmentEditorProps) {
  const locked =
    assessment.status === "submitted" || assessment.status === "in_review" || assessment.status === "approved";
  const isOwner = assessment.createdByUserId === currentUserId;
  const canEditEvidence = !locked && isOwner;

  const getKpi = (kpiId: string): KpiAssessment =>
    assessment.kpiAssessments.find((x) => x.kpiId === kpiId) ?? { kpiId, status: "not-started" };

  const setKpi = (kpiId: string, patch: Partial<KpiAssessment>) =>
    onUpdate((a) => {
      const exists = a.kpiAssessments.some((x) => x.kpiId === kpiId);
      return {
        ...a,
        kpiAssessments: exists
          ? a.kpiAssessments.map((x) => (x.kpiId === kpiId ? { ...x, ...patch } : x))
          : [...a.kpiAssessments, { kpiId, status: "not-started", ...patch }],
      };
    });

  const score = assessmentScore(assessment);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 shrink-0 text-brand-accent" />
            <span className="truncate">{init.name}</span>
          </DialogTitle>
          <DialogDescription>
            Self-assess each KPI: enter actual value, % achievement (auto-RAG), and notes.
          </DialogDescription>
        </DialogHeader>

        {locked && (
          <Alert className="py-2.5">
            <Lock className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {assessment.status === "approved" ? "Approved — locked." : "Submitted — read-only until decided by approver."}
            </AlertDescription>
          </Alert>
        )}

        {assessment.kpiAssessments.length > 0 && (
          <Card className="shadow-none">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Overall score</p>
                <p className="mt-1 text-3xl font-semibold leading-none text-foreground">{score}%</p>
              </div>
              <RagBadge rag={ragFromPercent(score)} />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="initiative-status" className="text-xs">Initiative status</Label>
            <Select
              value={assessment.initiativeStatus}
              onValueChange={(v) => onUpdate((a) => ({ ...a, initiativeStatus: v as InitiativeStatus }))}
              disabled={locked}
            >
              <SelectTrigger id="initiative-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not-started">Not Started</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="assessment-narrative" className="text-xs">Self-assessment narrative</Label>
            <Textarea
              id="assessment-narrative"
              rows={2}
              value={assessment.narrative ?? ""}
              onChange={(e) => onUpdate((a) => ({ ...a, narrative: e.target.value }))}
              disabled={locked}
              placeholder="Summarise progress, blockers, key wins..."
            />
          </div>
        </div>

        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" /> KPIs
          </h3>
          {init.kpis.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="p-4 text-center text-xs text-muted-foreground">
                No KPIs defined on this initiative. Add them in Strategy Formulation first.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {init.kpis.map((kpi) => (
                <KpiScoreCard
                  key={kpi.id}
                  kpi={kpi}
                  value={getKpi(kpi.id)}
                  disabled={locked}
                  onChange={(patch) => setKpi(kpi.id, patch)}
                />
              ))}
            </div>
          )}
        </section>

        <EvidencePanel
          evidence={assessment.evidence}
          editable={canEditEvidence}
          uploadedBy={currentUserName}
          onAdd={(files) => onUpdate((a) => ({ ...a, evidence: [...a.evidence, ...files] }))}
          onRemove={(id) => onUpdate((a) => ({ ...a, evidence: a.evidence.filter((e) => e.id !== id) }))}
        />

        <CommentList comments={assessment.comments} />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {!locked && isOwner && (
            <Button variant="brand" onClick={onSubmit}>
              <Send /> Submit for approval
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
