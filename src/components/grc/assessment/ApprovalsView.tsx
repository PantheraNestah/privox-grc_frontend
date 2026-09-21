import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assessmentScore, ragFromPercent, type InitiativeAssessment } from "@/data/assessmentStore";
import type { OrgNode } from "@/data/orgStore";
import type { Initiative, StrategyConfig } from "@/data/strategyStore";
import { can, ROLE_LABELS, type AppUser } from "@/data/userStore";
import { RagDot } from "./badges";
import { approvalEmptyReasons, isAwaitingDecision } from "./helpers";

interface ApprovalsViewProps {
  queue: InitiativeAssessment[];
  cfg: StrategyConfig;
  users: AppUser[];
  orgNodes: OrgNode[];
  activeUser: AppUser;
  allAssessments: InitiativeAssessment[];
  onReview: (a: InitiativeAssessment) => void;
}

export function ApprovalsView({ queue, cfg, users, orgNodes, activeUser, allAssessments, onReview }: ApprovalsViewProps) {
  const initMap = useMemo(() => {
    const m = new Map<string, { init: Initiative; pillarName: string; objTitle: string }>();
    cfg.pillars.forEach((p) =>
      cfg.objectives
        .filter((o) => o.pillarId === p.id)
        .forEach((o) => o.initiatives.forEach((i) => m.set(i.id, { init: i, pillarName: p.name, objTitle: o.title }))),
    );
    return m;
  }, [cfg]);
  const orgNodeMap = useMemo(() => new Map(orgNodes.map((n) => [n.id, n])), [orgNodes]);

  if (queue.length === 0) {
    const reasons = approvalEmptyReasons({
      roleLabel: ROLE_LABELS[activeUser.role],
      canApproveRole: can.approve(activeUser.role),
      isAdmin: activeUser.role === "admin",
      hasOrgUnit: !!activeUser.orgNodeId,
      submittedCount: allAssessments.filter(isAwaitingDecision).length,
    });

    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
            <ShieldCheck className="h-6 w-6" strokeWidth={1.6} />
          </span>
          <p className="mt-4 text-sm font-semibold text-navy-deep">No assessments awaiting your approval</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Approvals appear here when someone in a unit <em>below yours</em> submits an assessment.
          </p>
          {reasons.length > 0 && (
            <ul className="mt-4 max-w-md list-disc space-y-1 pl-4 text-left text-xs text-muted-foreground">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Initiative</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Submitted by</TableHead>
            <TableHead>From unit</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queue.map((a) => {
            const meta = initMap.get(a.initiativeId);
            const submitter = users.find((u) => u.id === a.createdByUserId);
            const unit = submitter?.orgNodeId ? orgNodeMap.get(submitter.orgNodeId) : null;
            const score = assessmentScore(a);
            return (
              <TableRow key={a.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{meta?.init.name ?? "(deleted)"}</p>
                  <p className="text-xs text-muted-foreground">
                    {meta?.pillarName} · {meta?.objTitle}
                  </p>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    {score}%
                    <RagDot rag={ragFromPercent(score)} />
                  </span>
                </TableCell>
                <TableCell className="text-foreground">{submitter?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{unit?.name ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => onReview(a)}>
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
