import { useState } from "react";
import { ArrowUpRight, Check, RotateCcw, X } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { assessmentScore, ragFromPercent, RAG_LABELS, type InitiativeAssessment } from "@/data/assessmentStore";
import type { Initiative } from "@/data/strategyStore";
import { can, ROLE_LABELS, type AppUser } from "@/data/userStore";
import { RagBadge, RagDot } from "./badges";
import { CommentList } from "./CommentList";
import { EvidencePanel } from "./EvidencePanel";

interface ReviewDialogProps {
  assessment: InitiativeAssessment;
  init: Initiative | undefined;
  submitter: AppUser | undefined;
  users: AppUser[];
  activeUser: AppUser;
  onClose: () => void;
  onApprove: (comment: string) => void;
  onReject: (comment: string) => void;
  onSendBack: (comment: string) => void;
  onDelegate: (toUserId: string, comment: string) => void;
}

/** Approver review: read-only scorecard plus approve / reject / send back / delegate upward. */
export function ReviewDialog({
  assessment,
  init,
  submitter,
  users,
  activeUser,
  onClose,
  onApprove,
  onReject,
  onSendBack,
  onDelegate,
}: ReviewDialogProps) {
  const [comment, setComment] = useState("");
  const [delegateTo, setDelegateTo] = useState("");
  const score = assessmentScore(assessment);

  // Anyone with an approver-capable role, excluding self and the submitter.
  const delegationTargets = users.filter(
    (u) => u.id !== activeUser.id && u.id !== submitter?.id && can.approve(u.role),
  );
  const delegatedTo = users.find((u) => u.id === assessment.delegatedToUserId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review assessment</DialogTitle>
          <DialogDescription>
            Submitted by <strong>{submitter?.name ?? "(unknown)"}</strong>
            {submitter && ` (${ROLE_LABELS[submitter.role]})`}.
          </DialogDescription>
        </DialogHeader>

        <Card className="shadow-none">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-foreground">{init?.name ?? "(initiative deleted)"}</p>
              <RagBadge rag={ragFromPercent(score)}>
                {score}% · {RAG_LABELS[ragFromPercent(score)]}
              </RagBadge>
            </div>

            {assessment.narrative && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Narrative</p>
                <p className="rounded-md border border-border bg-background p-2.5 text-xs text-foreground">
                  {assessment.narrative}
                </p>
              </div>
            )}

            {init && init.kpis.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">KPIs</p>
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8">KPI</TableHead>
                      <TableHead className="h-8">Target</TableHead>
                      <TableHead className="h-8">Actual</TableHead>
                      <TableHead className="h-8 text-right">%</TableHead>
                      <TableHead className="h-8 text-right">RAG</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {init.kpis.map((k) => {
                      const ka = assessment.kpiAssessments.find((x) => x.kpiId === k.id);
                      const rag =
                        ka?.rag ??
                        (typeof ka?.percentAchievement === "number" ? ragFromPercent(ka.percentAchievement) : undefined);
                      return (
                        <TableRow key={k.id}>
                          <TableCell className="py-2 text-foreground">{k.name}</TableCell>
                          <TableCell className="py-2">
                            {k.target} {k.unit}
                          </TableCell>
                          <TableCell className="py-2">{ka?.actual ?? "—"}</TableCell>
                          <TableCell className="py-2 text-right">{ka?.percentAchievement ?? "—"}</TableCell>
                          <TableCell className="py-2 text-right">{rag ? <RagDot rag={rag} /> : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <EvidencePanel evidence={assessment.evidence} showCount />

        <CommentList comments={assessment.comments} title="Previous comments" />

        <div className="space-y-1.5">
          <Label htmlFor="approver-remarks" className="text-xs">
            Approver remarks{" "}
            <span className="font-normal text-muted-foreground">(required for reject / send-back / delegate)</span>
          </Label>
          <Textarea
            id="approver-remarks"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add your comments..."
          />
        </div>

        <Card className="border-dashed shadow-none">
          <CardContent className="space-y-2 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ArrowUpRight className="h-3.5 w-3.5" /> Delegate upward
              <span className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                · escalate to any approver across the system
              </span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={delegateTo} onValueChange={setDelegateTo}>
                <SelectTrigger className="flex-1" aria-label="Approver to delegate to">
                  <SelectValue placeholder="Select an approver to delegate to..." />
                </SelectTrigger>
                <SelectContent>
                  {delegationTargets.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No eligible delegates</div>
                  ) : (
                    delegationTargets.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} <span className="text-muted-foreground">· {ROLE_LABELS[u.role]}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button variant="outline" disabled={!delegateTo} onClick={() => onDelegate(delegateTo, comment)}>
                Delegate
              </Button>
            </div>
            {assessment.delegatedToUserId && (
              <p className="text-xs text-muted-foreground">
                Currently delegated to{" "}
                <strong className="font-medium text-foreground">{delegatedTo?.name ?? "(unknown)"}</strong>. Delegating
                again will reassign.
              </p>
            )}
          </CardContent>
        </Card>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => onSendBack(comment)}>
            <RotateCcw /> Send back
          </Button>
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onReject(comment)}
          >
            <X /> Reject
          </Button>
          <Button variant="brand" onClick={() => onApprove(comment)}>
            <Check /> Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
