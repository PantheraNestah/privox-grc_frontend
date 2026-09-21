import { Check, RotateCcw, Send, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ApprovalDecision, PolicyDocument } from "@/data/documentsStore";
import { APPROVAL_DECISION_COLORS, APPROVAL_DECISION_LABELS, APPROVAL_ROLE_LABELS } from "@/data/strategyStore";
import type { UserRole } from "@/data/userStore";
import { ToneBadge } from "./DocumentBadges";
import { canDecideStep, type DocumentTabProps } from "./document-logic";

interface DocumentApprovalTabProps extends DocumentTabProps {
  isNew: boolean;
  userRole: UserRole;
  inDocScope: boolean;
  canSubmit: boolean;
  canReset: boolean;
  onSubmit: (d: PolicyDocument) => void;
  onDecide: (d: PolicyDocument, stepId: string, decision: ApprovalDecision, comment?: string) => void;
  onResetToDraft: (d: PolicyDocument) => void;
  onSendBack: (d: PolicyDocument, stepId: string, message: string) => void;
}

export function DocumentApprovalTab({
  draft,
  patch,
  isNew,
  userRole,
  inDocScope,
  canSubmit,
  canReset,
  onSubmit,
  onDecide,
  onResetToDraft,
  onSendBack,
}: DocumentApprovalTabProps) {
  if (isNew) {
    return <p className="p-3 text-sm text-muted-foreground">Save the document first, then submit it for approval.</p>;
  }

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Approval workflow (Approver → Risk Manager)
          </p>
          <div className="flex items-center gap-2">
            {canReset && (
              <Button type="button" size="sm" variant="outline" onClick={() => onResetToDraft(draft)}>
                Reset to draft
              </Button>
            )}
            {canSubmit && (
              <Button type="button" size="sm" variant="brand" onClick={() => onSubmit(draft)}>
                <Send /> Submit for approval
              </Button>
            )}
          </div>
        </div>

        {draft.approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Submit this document to start the 2-step approval chain.</p>
        ) : (
          <ol className="space-y-2">
            {draft.approvals.map((step, idx) => {
              const allowed = canDecideStep(draft, idx, step.role, userRole, inDocScope);
              return (
                <li key={step.id} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-navy-deep">
                      {idx + 1}
                    </span>
                    <div className="min-w-[8rem] flex-1">
                      <p className="text-sm font-medium text-navy-deep">{APPROVAL_ROLE_LABELS[step.role]}</p>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {idx === 0 ? "First level" : "Final level"}
                      </p>
                    </div>
                    <div className="min-w-[8rem] text-xs text-muted-foreground">
                      {step.approverName ? (
                        <span className="text-navy-deep">{step.approverName}</span>
                      ) : (
                        <em>Awaiting decision</em>
                      )}
                      {step.decidedAt && <p>{new Date(step.decidedAt).toLocaleString()}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <ToneBadge color={APPROVAL_DECISION_COLORS[step.decision]}>
                        {APPROVAL_DECISION_LABELS[step.decision]}
                      </ToneBadge>
                      {allowed && (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-success hover:text-success"
                            onClick={() => onDecide(draft, step.id, "approved")}
                            aria-label="Approve"
                            title="Approve"
                          >
                            <Check />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-warn hover:text-warn"
                            onClick={() => onSendBack(draft, step.id, step.comment ?? "")}
                            aria-label="Send back to author"
                            title="Send back to author (comment required)"
                          >
                            <RotateCcw />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => onDecide(draft, step.id, "rejected")}
                            aria-label="Reject"
                            title="Reject"
                          >
                            <X />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {!allowed && step.comment && (
                    <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{step.comment}</p>
                  )}

                  {allowed && (
                    <div className="space-y-1">
                      <Input
                        placeholder="Comment (required when sending back, optional otherwise)…"
                        aria-label="Decision comment"
                        value={step.comment ?? ""}
                        onChange={(e) =>
                          patch((d) => ({
                            ...d,
                            approvals: d.approvals.map((x) =>
                              x.id === step.id ? { ...x, comment: e.target.value } : x,
                            ),
                          }))
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Use <strong>Send back</strong> to return the document to the author for revision.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
