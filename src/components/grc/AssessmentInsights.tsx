// Insights block for Strategy Performance Assessment:
// • status doughnut + initiative met/not-met progress bars
// • RAG grid by Pillar × Org-unit (root entities) based on KPI achievement
// • trend line of % achievement across periods (month buckets of assessment.updatedAt)
//
// All visuals are interactive — clicking a segment, bar, RAG cell or trend point
// opens a side-panel listing the matching initiatives so users can drill in.

import { useMemo, useState } from "react";
import { BarChart3, MousePointerClick, ShieldCheck, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ASSESSMENT_STATUS_COLORS,
  ASSESSMENT_STATUS_LABELS,
  type AssessmentStatus,
  type InitiativeAssessment,
} from "@/data/assessmentStore";
import { ORG_TYPE_LABELS, type OrgNode } from "@/data/orgStore";
import type { KpiStatus, StrategyConfig } from "@/data/strategyStore";
import { Bar, Doughnut, Trendline } from "./assessment/InsightCharts";
import { DrillSheet, type Drill, type DrillRow } from "./assessment/DrillSheet";

interface Props {
  cfg: StrategyConfig;
  orgNodes: OrgNode[];
  assessments: InitiativeAssessment[];
}

const POSITIVE_KPI_STATUSES: KpiStatus[] = ["on-track", "met"];
const NEGATIVE_KPI_STATUSES: KpiStatus[] = ["at-risk", "off-track", "not-met"];

export const AssessmentInsights = ({ cfg, orgNodes, assessments }: Props) => {
  const orgNodeMap = useMemo(() => new Map(orgNodes.map(n => [n.id, n])), [orgNodes]);
  const [drill, setDrill] = useState<Drill | null>(null);

  // Index helpers
  const rootIdOf = useMemo(() => {
    const cache = new Map<string, string>();
    return (id: string): string => {
      if (cache.has(id)) return cache.get(id)!;
      let cur = orgNodeMap.get(id);
      while (cur && cur.parentId) cur = orgNodeMap.get(cur.parentId);
      const root = cur?.id ?? id;
      cache.set(id, root);
      return root;
    };
  }, [orgNodeMap]);

  // Flat list of initiatives with parent metadata, used by drilldowns
  const allRows = useMemo<DrillRow[]>(() => {
    const list: DrillRow[] = [];
    cfg.pillars.forEach(p => {
      cfg.objectives.filter(o => o.pillarId === p.id).forEach(o => {
        o.initiatives.forEach(init => list.push({
          initiative: init, pillarName: p.name, objectiveTitle: o.title,
          assessment: assessments.find(a => a.initiativeId === init.id),
        }));
      });
    });
    return list;
  }, [cfg, assessments]);

  // ---- 1. Status doughnut data ----
  const allInitiatives = useMemo(
    () => cfg.objectives.flatMap(o => o.initiatives),
    [cfg]
  );
  const totalInitiatives = allInitiatives.length;

  const statusCounts = useMemo(() => {
    const counts: Record<AssessmentStatus | "not_started", number> = {
      draft: 0, submitted: 0, in_review: 0, approved: 0, rejected: 0, not_started: 0,
    };
    const assessedIds = new Set<string>();
    assessments.forEach(a => {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
      assessedIds.add(a.initiativeId);
    });
    counts.not_started = allInitiatives.filter(i => !assessedIds.has(i.id)).length;
    return counts;
  }, [assessments, allInitiatives]);

  // ---- 2. KPI met / not met across all assessments ----
  const kpiTotals = useMemo(() => {
    let met = 0, notMet = 0, inProgress = 0, notStarted = 0;
    assessments.forEach(a => a.kpiAssessments.forEach(k => {
      if (POSITIVE_KPI_STATUSES.includes(k.status)) met++;
      else if (NEGATIVE_KPI_STATUSES.includes(k.status)) notMet++;
      else if (k.status === "not-started") notStarted++;
      else inProgress++;
    }));
    return { met, notMet, inProgress, notStarted, total: met + notMet + inProgress + notStarted };
  }, [assessments]);

  // ---- 3. RAG grid: rows = pillars, cols = root org units ----
  const rootOrgs = useMemo(() => orgNodes.filter(n => !n.parentId), [orgNodes]);

  const ragGrid = useMemo(() => {
    const grid = new Map<string, { met: number; total: number; initiatives: number }>();
    cfg.pillars.forEach(p => rootOrgs.forEach(r => grid.set(`${p.id}|${r.id}`, { met: 0, total: 0, initiatives: 0 })));

    cfg.objectives.forEach(o => {
      const pillar = o.pillarId;
      const objectiveRoots = new Set<string>();
      o.linkedOrgNodeIds.forEach(nid => objectiveRoots.add(rootIdOf(nid)));
      if (objectiveRoots.size === 0) return;

      o.initiatives.forEach(init => {
        const a = assessments.find(x => x.initiativeId === init.id);
        if (!a) return;
        objectiveRoots.forEach(rootId => {
          const key = `${pillar}|${rootId}`;
          const cell = grid.get(key);
          if (!cell) return;
          cell.initiatives++;
          a.kpiAssessments.forEach(k => {
            cell.total++;
            if (POSITIVE_KPI_STATUSES.includes(k.status)) cell.met++;
          });
        });
      });
    });

    return grid;
  }, [cfg, rootOrgs, assessments, rootIdOf]);

  // Drilldown: initiatives behind a RAG cell
  const drillRagCell = (pillarId: string, rootId: string) => {
    const pillar = cfg.pillars.find(p => p.id === pillarId);
    const root = orgNodes.find(n => n.id === rootId);
    if (!pillar || !root) return;
    const rows = allRows.filter(r => {
      if (r.initiative.id == null) return false;
      const obj = cfg.objectives.find(o => o.id === r.assessment?.objectiveId
        || o.initiatives.some(i => i.id === r.initiative.id));
      if (!obj || obj.pillarId !== pillarId) return false;
      return obj.linkedOrgNodeIds.some(nid => rootIdOf(nid) === rootId);
    });
    setDrill({
      title: `${pillar.name} · ${root.name}`,
      subtitle: `Initiatives in this pillar linked to org units beneath ${root.name}.`,
      rows,
    });
  };

  // Drilldown: initiatives by assessment status
  const drillStatus = (status: AssessmentStatus | "not_started") => {
    const label = status === "not_started" ? "Not started" : ASSESSMENT_STATUS_LABELS[status];
    const rows = status === "not_started"
      ? allRows.filter(r => !r.assessment)
      : allRows.filter(r => r.assessment?.status === status);
    setDrill({
      title: `Status: ${label}`,
      subtitle: `${rows.length} initiative${rows.length === 1 ? "" : "s"} in this status.`,
      rows,
    });
  };

  // Drilldown: initiatives by KPI bucket (met / notMet / inProgress / notStarted)
  const drillKpiBucket = (bucket: "met" | "notMet" | "inProgress" | "notStarted") => {
    const matchers: Record<typeof bucket, (k: KpiStatus) => boolean> = {
      met: (k) => POSITIVE_KPI_STATUSES.includes(k),
      notMet: (k) => NEGATIVE_KPI_STATUSES.includes(k),
      inProgress: (k) => !POSITIVE_KPI_STATUSES.includes(k) && !NEGATIVE_KPI_STATUSES.includes(k) && k !== "not-started",
      notStarted: (k) => k === "not-started",
    };
    const labels: Record<typeof bucket, string> = {
      met: "KPIs Met / On Track", notMet: "KPIs Not Met / Off Track", inProgress: "KPIs In progress", notStarted: "KPIs Not started",
    };
    const rows = allRows.filter(r => r.assessment?.kpiAssessments.some(k => matchers[bucket](k.status)));
    setDrill({
      title: labels[bucket],
      subtitle: `${rows.length} initiative${rows.length === 1 ? "" : "s"} have at least one KPI in this state.`,
      rows,
    });
  };

  // ---- 4. Trend over periods (month buckets) ----
  const trend = useMemo(() => {
    const buckets = new Map<string, { met: number; total: number; date: Date; initiativeIds: Set<string> }>();
    assessments.forEach(a => {
      const d = new Date(a.updatedAt);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.get(key) ?? { met: 0, total: 0, date: new Date(d.getFullYear(), d.getMonth(), 1), initiativeIds: new Set<string>() };
      bucket.initiativeIds.add(a.initiativeId);
      a.kpiAssessments.forEach(k => {
        bucket.total++;
        if (POSITIVE_KPI_STATUSES.includes(k.status)) bucket.met++;
      });
      buckets.set(key, bucket);
    });
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, b]) => ({
        key,
        label: b.date.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        pct: b.total === 0 ? 0 : Math.round((b.met / b.total) * 100),
        initiativeIds: b.initiativeIds,
      }));
  }, [assessments]);

  const drillTrendPoint = (key: string) => {
    const point = trend.find(p => p.key === key);
    if (!point) return;
    const rows = allRows.filter(r => point.initiativeIds.has(r.initiative.id));
    setDrill({
      title: `Period: ${point.label}`,
      subtitle: `${rows.length} initiative${rows.length === 1 ? "" : "s"} updated this month — ${point.pct}% KPI achievement.`,
      rows,
    });
  };

  if (totalInitiatives === 0) return null;

  const statusItems = [
    { key: "approved" as const, count: statusCounts.approved, color: ASSESSMENT_STATUS_COLORS.approved, label: ASSESSMENT_STATUS_LABELS.approved },
    { key: "in_review" as const, count: statusCounts.in_review, color: ASSESSMENT_STATUS_COLORS.in_review, label: ASSESSMENT_STATUS_LABELS.in_review },
    { key: "submitted" as const, count: statusCounts.submitted, color: ASSESSMENT_STATUS_COLORS.submitted, label: ASSESSMENT_STATUS_LABELS.submitted },
    { key: "rejected" as const, count: statusCounts.rejected, color: ASSESSMENT_STATUS_COLORS.rejected, label: ASSESSMENT_STATUS_LABELS.rejected },
    { key: "draft" as const, count: statusCounts.draft, color: ASSESSMENT_STATUS_COLORS.draft, label: ASSESSMENT_STATUS_LABELS.draft },
    { key: "not_started" as const, count: statusCounts.not_started, color: "215 16% 70%", label: "Not started" },
  ];

  return (
    <Card>
      <CardHeader className="flex-col gap-2 space-y-0 pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-accent" />
          <CardTitle className="text-base text-navy-deep">Assessment insights</CardTitle>
          <Badge variant="secondary" className="text-[11px] font-normal">live roll-up</Badge>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground sm:ml-auto">
          <MousePointerClick className="h-3 w-3" /> click any chart to drill in
        </span>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-none">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-4">
                <Doughnut
                  segments={statusItems.map(({ key, count, color, label }) => ({ key, value: count, color, label }))}
                  total={totalInitiatives}
                  centerLabel="Initiatives"
                  onSegmentClick={(key) => drillStatus(key as AssessmentStatus | "not_started")}
                />
                <ul className="flex-1 space-y-1">
                  {statusItems.map((item) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => drillStatus(item.key)}
                        className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-muted/50"
                      >
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: `hsl(${item.color})` }} />
                        <span className="flex-1 truncate text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-foreground">{item.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  KPI achievement (all assessments)
                </p>
                {kpiTotals.total === 0 ? (
                  <p className="text-xs italic text-muted-foreground">No KPIs scored yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    <Bar label="Met / On Track" value={kpiTotals.met} total={kpiTotals.total} color="158 53% 49%" onClick={() => drillKpiBucket("met")} />
                    <Bar label="Not Met / Off Track / At Risk" value={kpiTotals.notMet} total={kpiTotals.total} color="352 70% 61%" onClick={() => drillKpiBucket("notMet")} />
                    <Bar label="In progress" value={kpiTotals.inProgress} total={kpiTotals.total} color="210 61% 49%" onClick={() => drillKpiBucket("inProgress")} />
                    <Bar label="Not started" value={kpiTotals.notStarted} total={kpiTotals.total} color="215 16% 47%" onClick={() => drillKpiBucket("notStarted")} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="space-y-2 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> KPI achievement over time
              </p>
              {trend.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">No KPI data yet — submit assessments to see a trend.</p>
              ) : (
                <Trendline points={trend} onPointClick={drillTrendPoint} />
              )}
            </CardContent>
          </Card>
        </div>

        {rootOrgs.length > 0 && cfg.pillars.length > 0 && (
          <section className="space-y-2">
            <h3 className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              RAG grid · Pillar × top-level org unit
              <span className="text-xs font-normal text-muted-foreground">
                Green ≥ 70% KPIs met · Amber 40-70% · Red &lt; 40% (grey = no data). Click any cell to drill in.
              </span>
            </h3>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Pillar</TableHead>
                    {rootOrgs.map((r) => (
                      <TableHead key={r.id} className="text-center">
                        <span className="block text-[11px] font-normal normal-case text-muted-foreground/80">
                          {ORG_TYPE_LABELS[r.type]}
                        </span>
                        {r.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cfg.pillars.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                      {rootOrgs.map((r) => {
                        const cell = ragGrid.get(`${p.id}|${r.id}`);
                        const total = cell?.total ?? 0;
                        const met = cell?.met ?? 0;
                        const inits = cell?.initiatives ?? 0;
                        const pct = total === 0 ? null : Math.round((met / total) * 100);
                        const tone = pct === null ? null : pct >= 70 ? "158 53% 49%" : pct >= 40 ? "34 89% 61%" : "352 70% 61%";
                        return (
                          <TableCell key={r.id} className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              disabled={inits === 0}
                              onClick={() => drillRagCell(p.id, r.id)}
                              className="inline-flex h-10 min-w-[64px] flex-col items-center justify-center rounded text-xs font-semibold disabled:cursor-default disabled:opacity-80"
                              style={{
                                background: tone ? `hsl(${tone} / 0.85)` : "hsl(var(--muted))",
                                color: tone ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                              }}
                              title={inits ? `${inits} initiative(s) · ${met}/${total} KPIs met — click to drill in` : "No data"}
                            >
                              {pct === null ? "—" : `${pct}%`}
                              {inits ? <span className="text-[11px] font-normal opacity-80">{inits} init</span> : null}
                            </button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </CardContent>

      <DrillSheet drill={drill} onClose={() => setDrill(null)} />
    </Card>
  );
};
