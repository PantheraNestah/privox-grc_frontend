// Insights block for Strategy Formulation: pillar × org-unit coverage heatmap,
// per-pillar KPI summary cards, and a Gantt-style timeline of initiatives.
//
// All visuals are interactive — clicking a heatmap cell, summary card, or timeline
// bar opens a side panel listing the matching objectives / initiatives.

import { useMemo, useState } from "react";
import { Compass, Target, Rocket, Gauge, ListChecks, Clock, AlertTriangle, MousePointerClick } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ORG_TYPE_LABELS, type OrgNode, type OrgNodeType } from "@/data/orgStore";
import {
  INITIATIVE_STATUS_COLORS, INITIATIVE_STATUS_LABELS,
  type StrategyConfig, type Initiative, type StrategicObjective,
} from "@/data/strategyStore";

interface Props {
  cfg: StrategyConfig;
  orgNodes: OrgNode[];
}

const HEATMAP_LEVELS: OrgNodeType[] = ["group", "company", "department", "division", "section"];

interface DrillObjectiveRow { kind: "objective"; pillarName: string; objective: StrategicObjective; orgUnits: OrgNode[] }
interface DrillInitiativeRow { kind: "initiative"; pillarName: string; objectiveTitle: string; initiative: Initiative }

type DrillRow = DrillObjectiveRow | DrillInitiativeRow;

interface Drill { title: string; subtitle: string; rows: DrillRow[] }

export const FormulationInsights = ({ cfg, orgNodes }: Props) => {
  const orgNodeMap = useMemo(() => new Map(orgNodes.map(n => [n.id, n])), [orgNodes]);
  const [drill, setDrill] = useState<Drill | null>(null);

  const presentLevels = useMemo(
    () => HEATMAP_LEVELS.filter(level => orgNodes.some(n => n.type === level)),
    [orgNodes]
  );

  const pillarMetrics = useMemo(() => cfg.pillars.map(p => {
    const objs = cfg.objectives.filter(o => o.pillarId === p.id);
    const inits = objs.flatMap(o => o.initiatives);
    const acts = inits.flatMap(i => i.activities);
    const kpis = inits.flatMap(i => i.kpis);
    const owners = new Set(inits.map(i => i.owner).filter(Boolean));

    const today = Date.now();
    const overdue = inits.filter(i =>
      i.expectedCompletion && new Date(i.expectedCompletion).getTime() < today && i.status !== "completed"
    );
    const dueSoon = inits.filter(i => {
      if (!i.expectedCompletion || i.status === "completed") return false;
      const t = new Date(i.expectedCompletion).getTime();
      return t >= today && t - today < 30 * 24 * 60 * 60 * 1000;
    });

    const coverageByLevel: Record<OrgNodeType, number> = {} as Record<OrgNodeType, number>;
    presentLevels.forEach(level => {
      const ids = new Set<string>();
      objs.forEach(o => o.linkedOrgNodeIds.forEach(nid => {
        const n = orgNodeMap.get(nid);
        if (n?.type === level) ids.add(n.id);
      }));
      coverageByLevel[level] = ids.size;
    });

    return {
      pillar: p, objs, inits, objectives: objs.length, initiatives: inits.length,
      activities: acts.length, kpis: kpis.length, owners: owners.size,
      overdue, dueSoon, coverageByLevel,
    };
  }), [cfg, presentLevels, orgNodeMap]);

  const totalsByLevel = useMemo(() => {
    const t: Record<OrgNodeType, number> = {} as Record<OrgNodeType, number>;
    presentLevels.forEach(level => { t[level] = orgNodes.filter(n => n.type === level).length; });
    return t;
  }, [orgNodes, presentLevels]);

  const timelineData = useMemo(() => {
    const initiatives: { pillarId: string; pillarName: string; objectiveTitle: string; init: Initiative; start: number; end: number }[] = [];
    cfg.pillars.forEach(p => {
      const objs = cfg.objectives.filter(o => o.pillarId === p.id);
      objs.forEach(o => o.initiatives.forEach(i => {
        const startStr = i.startDate || i.expectedCompletion;
        const endStr = i.expectedCompletion || i.startDate;
        if (!startStr || !endStr) return;
        const start = new Date(startStr).getTime();
        const end = new Date(endStr).getTime();
        if (isNaN(start) || isNaN(end)) return;
        initiatives.push({
          pillarId: p.id, pillarName: p.name, objectiveTitle: o.title, init: i,
          start: Math.min(start, end), end: Math.max(start, end),
        });
      }));
    });
    if (initiatives.length === 0) return null;
    const min = Math.min(...initiatives.map(x => x.start));
    const max = Math.max(...initiatives.map(x => x.end));
    return { items: initiatives, min, max: Math.max(max, min + 24 * 60 * 60 * 1000) };
  }, [cfg]);

  // Drill: heatmap cell -> list objectives in that pillar with linked unit at that level
  const drillHeatCell = (pillarId: string, level: OrgNodeType) => {
    const pillar = cfg.pillars.find(p => p.id === pillarId);
    if (!pillar) return;
    const rows: DrillRow[] = cfg.objectives
      .filter(o => o.pillarId === pillarId)
      .map(o => {
        const orgUnits = o.linkedOrgNodeIds
          .map(id => orgNodeMap.get(id))
          .filter((n): n is OrgNode => !!n && n.type === level);
        return orgUnits.length > 0 ? { kind: "objective" as const, pillarName: pillar.name, objective: o, orgUnits } : null;
      })
      .filter((x): x is DrillObjectiveRow => !!x);
    setDrill({
      title: `${pillar.name} · ${ORG_TYPE_LABELS[level]} coverage`,
      subtitle: `${rows.length} objective${rows.length === 1 ? "" : "s"} link to a ${ORG_TYPE_LABELS[level]} unit.`,
      rows,
    });
  };

  // Drill: pillar summary card -> list all initiatives under the pillar
  const drillPillar = (pillarId: string, filter: "all" | "overdue" | "due-soon" = "all") => {
    const m = pillarMetrics.find(x => x.pillar.id === pillarId);
    if (!m) return;
    const pool = filter === "overdue" ? m.overdue : filter === "due-soon" ? m.dueSoon : m.inits;
    const rows: DrillRow[] = pool.map(init => {
      const obj = m.objs.find(o => o.initiatives.some(i => i.id === init.id));
      return { kind: "initiative" as const, pillarName: m.pillar.name, objectiveTitle: obj?.title ?? "—", initiative: init };
    });
    setDrill({
      title: `${m.pillar.name}${filter === "all" ? "" : ` · ${filter === "overdue" ? "Overdue" : "Due in 30 days"}`}`,
      subtitle: `${rows.length} initiative${rows.length === 1 ? "" : "s"}.`,
      rows,
    });
  };

  // Drill: timeline bar -> single initiative
  const drillInitiative = (item: { pillarName: string; objectiveTitle: string; init: Initiative }) => {
    setDrill({
      title: item.init.name || "(unnamed initiative)",
      subtitle: `${item.pillarName} · ${item.objectiveTitle}`,
      rows: [{ kind: "initiative", pillarName: item.pillarName, objectiveTitle: item.objectiveTitle, initiative: item.init }],
    });
  };

  if (cfg.pillars.length === 0) return null;

  return (
    <Card className="p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-4 h-4 text-primary" />
        <h2 className="text-base font-semibold text-foreground">Plan insights</h2>
        <Badge variant="secondary" className="text-[10px]">read-only roll-up</Badge>
        <span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-1">
          <MousePointerClick className="w-3 h-3" /> click any chart to drill in
        </span>
      </div>

      {/* Per-pillar KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        {pillarMetrics.map(m => (
          <button
            key={m.pillar.id}
            onClick={() => drillPillar(m.pillar.id, "all")}
            className="text-left border border-border rounded-lg p-3 bg-card hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <Compass className="w-3.5 h-3.5 text-primary" />
              <p className="text-sm font-semibold text-foreground truncate flex-1">{m.pillar.name}</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <Stat icon={<Target className="w-3 h-3" />} value={m.objectives} label="Obj" />
              <Stat icon={<Rocket className="w-3 h-3" />} value={m.initiatives} label="Init" />
              <Stat icon={<ListChecks className="w-3 h-3" />} value={m.activities} label="Act" />
              <Stat icon={<Gauge className="w-3 h-3" />} value={m.kpis} label="KPI" />
            </div>
            <div className="mt-2 flex items-center gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Target className="w-3 h-3" />{m.owners} owner{m.owners === 1 ? "" : "s"}
              </span>
              {m.dueSoon.length > 0 && (
                <span
                  onClick={(e) => { e.stopPropagation(); drillPillar(m.pillar.id, "due-soon"); }}
                  className="inline-flex items-center gap-1 text-[hsl(34_89%_45%)] hover:underline cursor-pointer"
                >
                  <Clock className="w-3 h-3" />{m.dueSoon.length} due&lt;30d
                </span>
              )}
              {m.overdue.length > 0 && (
                <span
                  onClick={(e) => { e.stopPropagation(); drillPillar(m.pillar.id, "overdue"); }}
                  className="inline-flex items-center gap-1 text-destructive hover:underline cursor-pointer"
                >
                  <AlertTriangle className="w-3 h-3" />{m.overdue.length} overdue
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Coverage heatmap */}
      {presentLevels.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
            <span>Pillar × Org-unit coverage</span>
            <span className="text-[10px] font-normal text-muted-foreground">
              How many org units of each level have objectives under each pillar (click a cell to see them).
            </span>
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Pillar</th>
                  {presentLevels.map(l => (
                    <th key={l} className="text-center px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                      {ORG_TYPE_LABELS[l]}
                      <div className="text-[9px] font-normal normal-case">of {totalsByLevel[l]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pillarMetrics.map(m => (
                  <tr key={m.pillar.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{m.pillar.name}</td>
                    {presentLevels.map(l => {
                      const covered = m.coverageByLevel[l] ?? 0;
                      const total = totalsByLevel[l] || 1;
                      const intensity = Math.min(1, covered / total);
                      const clickable = covered > 0;
                      return (
                        <td key={l} className="px-2 py-1.5 text-center">
                          <button
                            disabled={!clickable}
                            onClick={() => drillHeatCell(m.pillar.id, l)}
                            className={`inline-flex items-center justify-center rounded min-w-[42px] h-7 text-[11px] font-semibold transition-transform ${clickable ? "hover:scale-105 cursor-pointer" : "cursor-default"}`}
                            style={{
                              background: covered === 0
                                ? "hsl(var(--muted))"
                                : `hsl(var(--primary) / ${0.12 + intensity * 0.55})`,
                              color: covered === 0 ? "hsl(var(--muted-foreground))" : "hsl(var(--primary-foreground))",
                            }}
                            title={`${covered} of ${total} ${ORG_TYPE_LABELS[l]} units covered${clickable ? " — click to drill in" : ""}`}
                          >
                            {covered}/{total}
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

      {/* Timeline */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Initiative timeline</p>
        {!timelineData ? (
          <p className="text-xs text-muted-foreground italic border border-dashed border-border rounded p-3">
            No initiatives have start/expected dates yet — add dates in Initiative details to see the timeline.
          </p>
        ) : (
          <TimelineStrip items={timelineData.items} min={timelineData.min} max={timelineData.max} onSelect={drillInitiative} />
        )}
      </div>

      <DrillSheet drill={drill} onClose={() => setDrill(null)} />
    </Card>
  );
};

const Stat = ({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) => (
  <div className="flex flex-col items-center gap-0.5 py-1 rounded bg-muted/40">
    <span className="text-muted-foreground">{icon}</span>
    <span className="text-sm font-semibold text-foreground leading-none">{value}</span>
    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
  </div>
);

interface TimelineItem {
  pillarName: string;
  objectiveTitle: string;
  init: Initiative;
  start: number;
  end: number;
}

const STATUS_COLOR: Record<string, string> = {
  "not-started": "215 16% 47%",
  "in-progress": "210 61% 49%",
  "completed": "158 53% 49%",
};

const TimelineStrip = ({ items, min, max, onSelect }: { items: TimelineItem[]; min: number; max: number; onSelect: (item: TimelineItem) => void }) => {
  const byPillar = new Map<string, TimelineItem[]>();
  items.forEach(i => {
    const arr = byPillar.get(i.pillarName) ?? [];
    arr.push(i);
    byPillar.set(i.pillarName, arr);
  });
  const range = max - min || 1;

  const ticks: { pct: number; label: string }[] = [];
  const months = Math.ceil(range / (30 * 24 * 60 * 60 * 1000));
  const step = Math.max(1, Math.ceil(months / 8));
  const startDate = new Date(min);
  startDate.setDate(1);
  for (let i = 0; i <= months; i += step) {
    const d = new Date(startDate);
    d.setMonth(startDate.getMonth() + i);
    const pct = ((d.getTime() - min) / range) * 100;
    if (pct >= 0 && pct <= 100) {
      ticks.push({ pct, label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }) });
    }
  }
  const todayPct = ((Date.now() - min) / range) * 100;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="relative h-6 bg-muted/30 border-b border-border">
        {ticks.map((t, idx) => (
          <span key={idx} className="absolute top-1 text-[9px] text-muted-foreground -translate-x-1/2" style={{ left: `${t.pct}%` }}>
            {t.label}
          </span>
        ))}
        {todayPct >= 0 && todayPct <= 100 && (
          <span className="absolute top-0 bottom-0 w-px bg-destructive" style={{ left: `${todayPct}%` }} title="Today" />
        )}
      </div>

      {Array.from(byPillar.entries()).map(([pillar, arr]) => (
        <div key={pillar} className="px-2 py-2 border-b border-border last:border-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{pillar}</p>
          <div className="space-y-1">
            {arr.map(item => {
              const left = ((item.start - min) / range) * 100;
              const width = Math.max(1, ((item.end - item.start) / range) * 100);
              const overdue = item.end < Date.now() && item.init.status !== "completed";
              const color = STATUS_COLOR[item.init.status] ?? "215 16% 47%";
              return (
                <div key={item.init.id} className="relative h-5">
                  <div className="absolute inset-y-0 left-0 right-0 bg-muted/20 rounded" />
                  <button
                    onClick={() => onSelect(item)}
                    className="absolute inset-y-0 rounded flex items-center px-1.5 overflow-hidden hover:ring-2 hover:ring-primary/40 transition-shadow"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: `hsl(${color} / 0.85)`,
                      color: "hsl(var(--primary-foreground))",
                      minWidth: "20px",
                    }}
                    title={`${item.init.name} · ${item.init.startDate ?? "?"} → ${item.init.expectedCompletion ?? "?"} — click for details`}
                  >
                    <span className="text-[10px] font-medium truncate">{item.init.name}</span>
                  </button>
                  {overdue && (
                    <span className="absolute -right-1 top-0 -translate-y-1/2 text-destructive pointer-events-none" title="Overdue">
                      <AlertTriangle className="w-3 h-3" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

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
            <p className="text-xs text-muted-foreground italic">No matching items.</p>
          ) : drill.rows.map((row, idx) => {
            if (row.kind === "objective") {
              return (
                <div key={`o-${row.objective.id}-${idx}`} className="border border-border rounded-md p-2.5 bg-card">
                  <div className="flex items-start gap-2">
                    <Target className="w-3.5 h-3.5 text-[hsl(158_53%_49%)] mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{row.objective.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        <Compass className="inline w-3 h-3 mr-1" />{row.pillarName}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.orgUnits.map(u => (
                          <Badge key={u.id} variant="secondary" className="text-[10px]">{u.name}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            const init = row.initiative;
            const sColor = INITIATIVE_STATUS_COLORS[init.status];
            return (
              <div key={`i-${init.id}-${idx}`} className="border border-border rounded-md p-2.5 bg-card">
                <div className="flex items-start gap-2">
                  <Rocket className="w-3.5 h-3.5 text-[hsl(265_88%_66%)] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{init.name || "(unnamed initiative)"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      <Compass className="inline w-3 h-3 mr-1" />{row.pillarName}
                      <span className="mx-1.5">·</span>
                      <Target className="inline w-3 h-3 mr-1" />{row.objectiveTitle}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px]"
                    style={{
                      background: `hsl(${sColor} / 0.12)`,
                      borderColor: `hsl(${sColor} / 0.4)`,
                      color: `hsl(${sColor})`,
                    }}>
                    {INITIATIVE_STATUS_LABELS[init.status]}
                  </Badge>
                  {init.owner && <span className="text-[10px] text-muted-foreground">Owner: <strong className="text-foreground">{init.owner}</strong></span>}
                  {init.expectedCompletion && (
                    <span className="text-[10px] text-muted-foreground ml-auto">Due {init.expectedCompletion}</span>
                  )}
                </div>
                {init.kpis.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    <Gauge className="inline w-3 h-3 mr-1" />{init.kpis.length} KPI · {init.activities.length} activities
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
