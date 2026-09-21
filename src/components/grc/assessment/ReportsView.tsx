import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AssessmentInsights } from "@/components/grc/AssessmentInsights";
import { RAG_COLORS, RAG_LABELS, ragFromPercent, type InitiativeAssessment } from "@/data/assessmentStore";
import type { OrgNode } from "@/data/orgStore";
import type { StrategyConfig } from "@/data/strategyStore";
import { MeterBar, RagBadge } from "./badges";
import { computePillarPerformance, overallScore, performanceLabel, type VisibleRow } from "./helpers";

interface ReportsViewProps {
  rows: VisibleRow[];
  assessments: InitiativeAssessment[];
  cfg: StrategyConfig;
  orgNodes: OrgNode[];
}

const GAUGE_PATH = "M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831";

export function ReportsView({ rows, assessments, cfg, orgNodes }: ReportsViewProps) {
  const pillarPerf = useMemo(() => computePillarPerformance(cfg, rows, assessments), [cfg, rows, assessments]);
  const overall = overallScore(pillarPerf);
  const overallRag = ragFromPercent(overall);
  const assessedPillars = pillarPerf.filter((p) => p.count > 0).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-navy-deep">Performance by pillar</CardTitle>
            <CardDescription className="text-xs">
              Average % achievement across all assessed initiatives in each pillar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pillarPerf.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No pillars defined.</p>
            ) : (
              <ul className="space-y-4">
                {pillarPerf.map((p) => (
                  <li key={p.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.count > 0 ? `${p.avg}%` : "no data"}
                        <span className="ml-1.5">({p.count} assessed)</span>
                      </span>
                    </div>
                    <MeterBar value={p.avg} color={RAG_COLORS[ragFromPercent(p.avg)]} label={`${p.name} performance`} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-navy-deep">Overall score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pb-6">
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90" aria-hidden>
                <path className="text-muted" stroke="currentColor" strokeWidth="3.5" fill="none" d={GAUGE_PATH} />
                <path
                  stroke={`hsl(${RAG_COLORS[overallRag]})`}
                  strokeWidth="3.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${overall}, 100`}
                  d={GAUGE_PATH}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-semibold text-foreground">{overall}%</span>
              </div>
            </div>
            <RagBadge rag={overallRag} className="text-xs">
              {RAG_LABELS[overallRag]} · {performanceLabel(overall)}
            </RagBadge>
            <p className="text-center text-xs text-muted-foreground">
              {assessedPillars} of {pillarPerf.length} pillars assessed
            </p>
          </CardContent>
        </Card>
      </div>

      <AssessmentInsights cfg={cfg} orgNodes={orgNodes} assessments={assessments} />
    </div>
  );
}
