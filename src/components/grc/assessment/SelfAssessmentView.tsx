import { Link } from "react-router-dom";
import { Compass, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/grc/common/states";
import {
  ASSESSMENT_STATUS_LABELS,
  assessmentScore,
  ragFromPercent,
  type InitiativeAssessment,
} from "@/data/assessmentStore";
import { getPendingActor } from "@/data/assessmentPending";
import type { OrgNode } from "@/data/orgStore";
import type { Initiative } from "@/data/strategyStore";
import type { AppUser } from "@/data/userStore";
import { RagBadge, StatusBadge } from "./badges";
import type { VisibleRow } from "./helpers";

interface SelfAssessmentViewProps {
  rows: VisibleRow[];
  assessments: InitiativeAssessment[];
  users: AppUser[];
  orgNodes: OrgNode[];
  canSelfAssess: boolean;
  onOpen: (init: Initiative, objectiveId: string, pillarId: string) => void;
}

export function SelfAssessmentView({ rows, assessments, users, orgNodes, canSelfAssess, onOpen }: SelfAssessmentViewProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="No initiatives to assess"
        description="Build your strategy first."
        action={
          <Button asChild size="sm" variant="brand">
            <Link to="/governance/strategy-formulation">Go to Strategy Formulation</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Initiative</TableHead>
            <TableHead>Pillar / Objective</TableHead>
            <TableHead>KPIs</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>RAG</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const a = assessments.find((x) => x.initiativeId === r.init.id);
            const scored = !!a && a.kpiAssessments.length > 0;
            const score = a ? assessmentScore(a) : 0;
            const status = a?.status ?? "draft";
            const pending = a
              ? getPendingActor(a, users, orgNodes)
              : { statusLabel: ASSESSMENT_STATUS_LABELS.draft, actorShort: "—", actorLabel: "", combined: ASSESSMENT_STATUS_LABELS.draft };
            return (
              <TableRow key={r.init.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{r.init.name}</p>
                  {r.init.owner && <p className="text-xs text-muted-foreground">Owner: {r.init.owner}</p>}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <p className="text-xs">{r.pillarName}</p>
                  <p>{r.objectiveTitle}</p>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.init.kpis.length}</TableCell>
                <TableCell className="font-mono text-xs font-semibold">{scored ? `${score}%` : "—"}</TableCell>
                <TableCell>
                  {scored ? <RagBadge rag={ragFromPercent(score)} /> : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <StatusBadge status={status}>{pending.statusLabel}</StatusBadge>
                  {pending.actorShort !== "—" && (
                    <p className="mt-1 max-w-[180px] truncate text-xs text-muted-foreground" title={pending.actorLabel}>
                      {pending.actorShort}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant={a ? "outline" : "default"}
                    onClick={() => onOpen(r.init, r.objectiveId, r.pillarId)}
                    disabled={!canSelfAssess && !a}
                  >
                    {a ? (
                      "Open"
                    ) : (
                      <>
                        <Plus /> Start
                      </>
                    )}
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
