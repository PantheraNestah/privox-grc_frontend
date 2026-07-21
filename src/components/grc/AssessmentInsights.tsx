// Insights block for Strategy Performance Assessment:
// • status doughnut + initiative met/not-met progress bars
// • RAG grid by Pillar × Org-unit (root entities) based on KPI achievement
// • trend line of % achievement across periods (month buckets of assessment.updatedAt)
//
// All visuals are interactive — clicking a segment, bar, RAG cell or trend point
// opens a side-panel listing the matching initiatives so users can drill in.

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { TrendingUp, BarChart3, ShieldCheck, Rocket, MousePointerClick, Target, Compass } from "lucide-react";
import {
  ASSESSMENT_STATUS_LABELS, ASSESSMENT_STATUS_COLORS,
  type InitiativeAssessment, type AssessmentStatus,
} from "@/data/assessmentStore";
import {
  INITIATIVE_STATUS_COLORS, INITIATIVE_STATUS_LABELS,
  type StrategyConfig, type Initiative, type KpiStatus,
} from "@/data/strategyStore";
import { ORG_TYPE_LABELS, type OrgNode } from "@/data/orgStore";

interface Props {
  cfg: StrategyConfig;
  orgNodes: OrgNode[];
  assessments: InitiativeAssessment[];
}

const POSITIVE_KPI_STATUSES: KpiStatus[] = ["on-track", "met"];
const NEGATIVE_KPI_STATUSES: KpiStatus[] = ["at-risk", "off-track", "not-met"];

interface DrillRow {
  initiative: Initiative;
  pillarName: string;
  objectiveTitle: string;
  assessment?: InitiativeAssessment;
}

interface Drill {
  title: string;
  subtitle: string;
  rows: DrillRow[];
}

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

  return (
    <Card className="p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Assessment insights</h2>
        <Badge variant="secondary" className="text-[10px]">live roll-up</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <MousePointerClick className="w-3 h-3" /> click any chart to drill in
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Doughnut + bars */}
        <div className="border border-border rounded-lg p-4">
          <div className="flex items-center gap-4">
            <Doughnut
              segments={[
                { key: "approved", value: statusCounts.approved, color: ASSESSMENT_STATUS_COLORS.approved, label: ASSESSMENT_STATUS_LABELS.approved },
                { key: "in_review", value: statusCounts.in_review, color: ASSESSMENT_STATUS_COLORS.in_review, label: ASSESSMENT_STATUS_LABELS.in_review },
                { key: "submitted", value: statusCounts.submitted, color: ASSESSMENT_STATUS_COLORS.submitted, label: ASSESSMENT_STATUS_LABELS.submitted },
                { key: "rejected", value: statusCounts.rejected, color: ASSESSMENT_STATUS_COLORS.rejected, label: ASSESSMENT_STATUS_LABELS.rejected },
                { key: "draft", value: statusCounts.draft, color: ASSESSMENT_STATUS_COLORS.draft, label: ASSESSMENT_STATUS_LABELS.draft },
                { key: "not_started", value: statusCounts.not_started, color: "215 16% 70%", label: "Not started" },
              ]}
              total={totalInitiatives}
              centerLabel="Initiatives"
              onSegmentClick={(key) => drillStatus(key as AssessmentStatus | "not_started")}
            />
            <div className="flex-1 space-y-1.5">
              {[
                { key: "approved" as const, count: statusCounts.approved, color: ASSESSMENT_STATUS_COLORS.approved, label: ASSESSMENT_STATUS_LABELS.approved },
                { key: "in_review" as const, count: statusCounts.in_review, color: ASSESSMENT_STATUS_COLORS.in_review, label: ASSESSMENT_STATUS_LABELS.in_review },
                { key: "submitted" as const, count: statusCounts.submitted, color: ASSESSMENT_STATUS_COLORS.submitted, label: ASSESSMENT_STATUS_LABELS.submitted },
                { key: "rejected" as const, count: statusCounts.rejected, color: ASSESSMENT_STATUS_COLORS.rejected, label: ASSESSMENT_STATUS_LABELS.rejected },
                { key: "draft" as const, count: statusCounts.draft, color: ASSESSMENT_STATUS_COLORS.draft, label: ASSESSMENT_STATUS_LABELS.draft },
                { key: "not_started" as const, count: statusCounts.not_started, color: "215 16% 70%", label: "Not started" },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => drillStatus(item.key)}
                  className="w-full flex items-center gap-2 text-[11px] text-left hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `hsl(${item.color})` }} />
                  <span className="text-muted-foreground flex-1 truncate">{item.label}</span>
                  <span className="text-foreground font-medium">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">KPI achievement (all assessments)</p>
            {kpiTotals.total === 0 ? (
              <p className="text-xs text-muted-foreground italic">No KPIs scored yet.</p>
            ) : (
              <div className="space-y-1.5">
                <Bar label="Met / On Track" value={kpiTotals.met} total={kpiTotals.total} color="158 53% 49%" onClick={() => drillKpiBucket("met")} />
                <Bar label="Not Met / Off Track / At Risk" value={kpiTotals.notMet} total={kpiTotals.total} color="352 70% 61%" onClick={() => drillKpiBucket("notMet")} />
                <Bar label="In progress" value={kpiTotals.inProgress} total={kpiTotals.total} color="210 61% 49%" onClick={() => drillKpiBucket("inProgress")} />
                <Bar label="Not started" value={kpiTotals.notStarted} total={kpiTotals.total} color="215 16% 47%" onClick={() => drillKpiBucket("notStarted")} />
              </div>
            )}
          </div>
        </div>

        {/* Trend */}
        <div className="border border-border rounded-lg p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> KPI achievement over time
          </p>
          {trend.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No KPI data yet — submit assessments to see a trend.</p>
          ) : (
            <Trendline points={trend} onPointClick={drillTrendPoint} />
          )}
        </div>
      </div>

      {/* RAG grid */}
      {rootOrgs.length > 0 && cfg.pillars.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-2 inline-flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
            <span>RAG grid · Pillar × top-level org unit</span>
            <span className="text-[10px] font-normal text-muted-foreground">
              Green ≥ 70% KPIs met · Amber 40-70% · Red &lt; 40% (grey = no data). Click any cell to drill in.
            </span>
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Pillar</th>
                  {rootOrgs.map(r => (
                    <th key={r.id} className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                      <div className="text-[9px] font-normal normal-case text-muted-foreground/70">{ORG_TYPE_LABELS[r.type]}</div>
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cfg.pillars.map(p => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{p.name}</td>
                    {rootOrgs.map(r => {
                      const cell = ragGrid.get(`${p.id}|${r.id}`);
                      const total = cell?.total ?? 0;
                      const met = cell?.met ?? 0;
                      const inits = cell?.initiatives ?? 0;
                      const pct = total === 0 ? null : Math.round((met / total) * 100);
                      let bg = "215 16% 70%";
                      let fg = "hsl(var(--muted-foreground))";
                      if (pct !== null) {
                        if (pct >= 70) bg = "158 53% 49%";
                        else if (pct >= 40) bg = "34 89% 61%";
                        else bg = "352 70% 61%";
                        fg = "hsl(var(--primary-foreground))";
                      }
                      const clickable = inits > 0;
                      return (
                        <td key={r.id} className="px-2 py-1.5 text-center">
                          <button
                            disabled={!clickable}
                            onClick={() => drillRagCell(p.id, r.id)}
                            className={`inline-flex flex-col items-center justify-center rounded min-w-[64px] h-9 text-[11px] font-semibold transition-transform ${clickable ? "hover:scale-105 cursor-pointer" : "cursor-default opacity-80"}`}
                            style={{ background: pct === null ? "hsl(var(--muted))" : `hsl(${bg} / 0.85)`, color: fg }}
                            title={inits ? `${inits} initiative(s) · ${met}/${total} KPIs met — click to drill in` : "No data"}
                          >
                            {pct === null ? "—" : `${pct}%`}
                            {inits ? <span className="text-[9px] font-normal opacity-80">{inits} init</span> : null}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DrillSheet drill={drill} onClose={() => setDrill(null)} />
    </Card>
  );
};

// ---- Doughnut chart (SVG) ----
const Doughnut = ({
  segments, total, centerLabel, onSegmentClick,
}: {
  segments: { key: string; value: number; color: string; label: string }[];
  total: number;
  centerLabel: string;
  onSegmentClick?: (key: string) => void;
}) => {
  const size = 120;
  const radius = 48;
  const stroke = 18;
  const circ = 2 * Math.PI * radius;

  let offset = 0;
  const sumValues = segments.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
        {segments.map((s) => {
          if (s.value === 0) return null;
          const len = (s.value / sumValues) * circ;
          const dasharray = `${len} ${circ - len}`;
          const dashoffset = -offset;
          offset += len;
          return (
            <circle
              key={s.key}
              cx={size / 2} cy={size / 2} r={radius}
              stroke={`hsl(${s.color})`}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              style={{ cursor: onSegmentClick ? "pointer" : "default" }}
              onClick={() => onSegmentClick?.(s.key)}
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xl font-semibold text-foreground leading-none">{total}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{centerLabel}</span>
      </div>
    </div>
  );
};

const Bar = ({ label, value, total, color, onClick }: { label: string; value: number; total: number; color: string; onClick?: () => void }) => {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <button
      onClick={onClick}
      disabled={value === 0}
      className="w-full text-left disabled:cursor-default disabled:opacity-70 hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
    >
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value} <span className="text-muted-foreground">({pct}%)</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: `hsl(${color})` }} />
      </div>
    </button>
  );
};

const Trendline = ({ points, onPointClick }: { points: { key: string; label: string; pct: number }[]; onPointClick: (key: string) => void }) => {
  const w = 360, h = 140, padX = 30, padY = 18;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const xStep = points.length > 1 ? innerW / (points.length - 1) : 0;
  const coord = (i: number, pct: number) => ({
    x: padX + i * xStep,
    y: padY + innerH - (pct / 100) * innerH,
  });
  const path = points.map((p, i) => {
    const c = coord(i, p.pct);
    return `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`;
  }).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} className="text-muted-foreground">
        {[0, 25, 50, 75, 100].map(v => {
          const y = padY + innerH - (v / 100) * innerH;
          return (
            <g key={v}>
              <line x1={padX} y1={y} x2={w - padX} y2={y} stroke="hsl(var(--border))" strokeDasharray="2 3" />
              <text x={4} y={y + 3} fontSize="9" fill="currentColor">{v}%</text>
            </g>
          );
        })}
        {points.length === 1 ? (
          <circle cx={coord(0, points[0].pct).x} cy={coord(0, points[0].pct).y} r={5} fill="hsl(var(--primary))" style={{ cursor: "pointer" }} onClick={() => onPointClick(points[0].key)}>
            <title>{`${points[0].label}: ${points[0].pct}%`}</title>
          </circle>
        ) : (
          <>
            <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
            {points.map((p, i) => {
              const c = coord(i, p.pct);
              return (
                <g key={p.key} style={{ cursor: "pointer" }} onClick={() => onPointClick(p.key)}>
                  <circle cx={c.x} cy={c.y} r={8} fill="transparent" />
                  <circle cx={c.x} cy={c.y} r={4} fill="hsl(var(--primary))" />
                  <title>{`${p.label}: ${p.pct}% — click to drill in`}</title>
                </g>
              );
            })}
          </>
        )}
        {points.map((p, i) => {
          const c = coord(i, p.pct);
          return (
            <text key={p.key} x={c.x} y={h - 4} fontSize="9" textAnchor="middle" fill="currentColor">
              {p.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

// ---- Drill-down side panel ----
const DrillSheet = ({ drill, onClose }: { drill: Drill | null; onClose: () => void }) => {
  return (
    <Sheet open={!!drill} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">{drill?.title}</SheetTitle>
          <SheetDescription className="text-xs">{drill?.subtitle}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {!drill || drill.rows.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No matching initiatives.</p>
          ) : drill.rows.map((row) => {
            const aStatus = row.assessment?.status;
            const aColor = aStatus ? ASSESSMENT_STATUS_COLORS[aStatus] : "215 16% 47%";
            const aLabel = aStatus ? ASSESSMENT_STATUS_LABELS[aStatus] : "Not started";
            return (
              <div key={row.initiative.id} className="border border-border rounded-md p-2.5 bg-card">
                <div className="flex items-start gap-2">
                  <Rocket className="w-3.5 h-3.5 text-[hsl(265_88%_66%)] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{row.initiative.name || "(unnamed initiative)"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      <Compass className="inline w-3 h-3 mr-1" />{row.pillarName}
                      <span className="mx-1.5">·</span>
                      <Target className="inline w-3 h-3 mr-1" />{row.objectiveTitle}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] gap-1"
                    style={{
                      background: `hsl(${INITIATIVE_STATUS_COLORS[row.initiative.status]} / 0.12)`,
                      borderColor: `hsl(${INITIATIVE_STATUS_COLORS[row.initiative.status]} / 0.4)`,
                      color: `hsl(${INITIATIVE_STATUS_COLORS[row.initiative.status]})`,
                    }}>
                    {INITIATIVE_STATUS_LABELS[row.initiative.status]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1"
                    style={{
                      background: `hsl(${aColor} / 0.12)`,
                      borderColor: `hsl(${aColor} / 0.4)`,
                      color: `hsl(${aColor})`,
                    }}>
                    {aLabel}
                  </Badge>
                  {row.assessment && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      Updated {new Date(row.assessment.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
