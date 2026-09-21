// Shared filterable table for Strategy Formulation & Assessment.
// Filter is a SINGLE org-level chooser (Group / Company / Department / Division / Section).
// Selecting a level shows only rows for objectives linked to org units of that exact level.
// Columns: Pillar · Objective · Initiative · Activity · Expected outcome · KPIs · Timeline · Responsibility.

import { useMemo, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader } from "@/components/ui/card";
import { Filter } from "lucide-react";
import { ORG_TYPE_LABELS, type OrgNode, type OrgNodeType } from "@/data/orgStore";
import {
  FORMULATION_STATUS_LABELS, FORMULATION_STATUS_COLORS,
  INITIATIVE_STATUS_LABELS, INITIATIVE_STATUS_COLORS,
  type StrategyConfig, type Initiative,
} from "@/data/strategyStore";
import {
  ASSESSMENT_STATUS_LABELS, ASSESSMENT_STATUS_COLORS,
  type InitiativeAssessment,
} from "@/data/assessmentStore";

/** Badge tinted from an HSL "h s% l%" token supplied by the status maps. */
const ToneBadge = ({ color, dot, children }: { color: string; dot?: boolean; children: React.ReactNode }) => (
  <Badge
    variant="outline"
    className="w-fit gap-1 text-[10px] font-medium"
    style={{
      background: `hsl(${color} / 0.12)`,
      borderColor: `hsl(${color} / 0.4)`,
      color: `hsl(${color})`,
    }}
  >
    {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${color})` }} />}
    {children}
  </Badge>
);

// Only "real" org levels (no processes / sub-processes — those don't own strategy)
const FILTER_LEVELS: OrgNodeType[] = ["group", "company", "department", "division", "section"];

interface BaseProps {
  cfg: StrategyConfig;
  orgNodes: OrgNode[];
}

interface FormulationProps extends BaseProps {
  variant: "formulation";
}

interface AssessmentProps extends BaseProps {
  variant: "assessment";
  assessments: InitiativeAssessment[];
}

type Props = FormulationProps | AssessmentProps;

export const StrategyTable = (props: Props) => {
  const { cfg, orgNodes } = props;
  const [levelFilter, setLevelFilter] = useState<OrgNodeType | "all">("all");

  const orgNodeMap = useMemo(() => new Map(orgNodes.map(n => [n.id, n])), [orgNodes]);

  // Build flat rows
  const rows = useMemo(() => {
    type Row = {
      key: string;
      pillarName: string;
      objectiveTitle: string;
      objLinkedOrgNodeIds: string[];
      init: Initiative;
      activityText: string;
      outcomeText: string;
    };
    const list: Row[] = [];
    cfg.pillars.forEach(p => {
      cfg.objectives.filter(o => o.pillarId === p.id).forEach(o => {
        o.initiatives.forEach(init => {
          // One row per initiative — activities/outcomes summarised inline.
          list.push({
            key: init.id,
            pillarName: p.name,
            objectiveTitle: o.title,
            objLinkedOrgNodeIds: o.linkedOrgNodeIds,
            init,
            activityText: init.activities.map(a => a.description).filter(Boolean).join(" • ") || "—",
            outcomeText: init.outcomes.map(x => x.description).filter(Boolean).join(" • ") || "—",
          });
        });
      });
    });
    return list;
  }, [cfg]);

  // Apply org-level filter: keep rows whose objective links to AT LEAST ONE node of the chosen level.
  const filteredRows = useMemo(() => {
    if (levelFilter === "all") return rows;
    return rows.filter(r => r.objLinkedOrgNodeIds.some(nid => {
      const n = orgNodeMap.get(nid);
      return n && n.type === levelFilter;
    }));
  }, [rows, levelFilter, orgNodeMap]);

  // Helper to render the responsibility cell — show only nodes at the filtered level (or all real levels).
  const renderResponsibility = (linkedIds: string[]) => {
    const nodes = linkedIds
      .map(id => orgNodeMap.get(id))
      .filter((n): n is OrgNode => !!n)
      .filter(n => levelFilter === "all" ? FILTER_LEVELS.includes(n.type) : n.type === levelFilter);
    if (nodes.length === 0) return <span className="text-muted-foreground italic">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {nodes.map(n => (
          <span key={n.id} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
            <span className="text-muted-foreground uppercase tracking-wider">{ORG_TYPE_LABELS[n.type]}</span>
            {n.name}
          </span>
        ))}
      </div>
    );
  };

  const renderTimeline = (init: Initiative) => {
    if (!init.startDate && !init.expectedCompletion) return <span className="text-muted-foreground italic">—</span>;
    return (
      <span className="text-[11px]">
        {init.startDate || "—"}<span className="text-muted-foreground"> → </span>{init.expectedCompletion || "—"}
      </span>
    );
  };

  const renderKpis = (init: Initiative) => {
    if (init.kpis.length === 0) return <span className="text-muted-foreground italic">—</span>;
    return (
      <div className="flex flex-col gap-0.5">
        {init.kpis.map(k => (
          <span key={k.id} className="text-[11px]">
            <Badge variant="outline" className="text-[9px] mr-1 px-1 py-0">{k.type === "quantitative" ? "Q" : "L"}</Badge>
            {k.name || "(unnamed)"}
            {k.target && <span className="text-muted-foreground"> · target {k.target}{k.unit ? ` ${k.unit}` : ""}</span>}
          </span>
        ))}
      </div>
    );
  };

  const renderStatus = (init: Initiative) => {
    if (props.variant === "formulation") {
      const status = init.formulationStatus;
      return <ToneBadge color={FORMULATION_STATUS_COLORS[status]}>{FORMULATION_STATUS_LABELS[status]}</ToneBadge>;
    }
    // assessment — show BOTH the workflow status and the actual progress status
    const assessment = props.assessments.find((x) => x.initiativeId === init.id);
    if (!assessment) {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] italic text-muted-foreground">Not started</span>
          <ToneBadge color={INITIATIVE_STATUS_COLORS[init.status]} dot>
            {INITIATIVE_STATUS_LABELS[init.status]}
          </ToneBadge>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <ToneBadge color={ASSESSMENT_STATUS_COLORS[assessment.status]}>{ASSESSMENT_STATUS_LABELS[assessment.status]}</ToneBadge>
        <ToneBadge color={INITIATIVE_STATUS_COLORS[assessment.initiativeStatus]} dot>
          {INITIATIVE_STATUS_LABELS[assessment.initiativeStatus]}
        </ToneBadge>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row flex-wrap items-center gap-3 space-y-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-navy-deep">
            {props.variant === "formulation" ? "Formulation table" : "Assessment table"}
          </span>
        </div>
        <Badge variant="secondary" className="text-[10px] font-normal">{filteredRows.length} of {rows.length}</Badge>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Filter by level:</span>
          <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as OrgNodeType | "all")}>
            <SelectTrigger className="h-8 w-[180px] text-xs" aria-label="Filter by level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {FILTER_LEVELS.map(t => (
                <SelectItem key={t} value={t}>{ORG_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <Table className="min-w-[1400px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[10px] uppercase tracking-wider">Pillar</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider">Objective</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider">Initiative</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider">Activities</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider">Expected outcomes</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider">Performance indicators</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider">Timeline</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider">Responsibility</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider">{props.variant === "assessment" ? "Workflow / progress" : "Status"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8 italic">
                No initiatives match this filter.
              </TableCell>
            </TableRow>
          ) : filteredRows.map(r => (
            <TableRow key={r.key} className="align-top">
              <TableCell className="text-xs font-medium text-foreground py-2 px-3 align-top whitespace-normal break-words">{r.pillarName}</TableCell>
              <TableCell className="text-xs text-foreground py-2 px-3 align-top whitespace-normal break-words">{r.objectiveTitle}</TableCell>
              <TableCell className="text-xs text-foreground py-2 px-3 align-top whitespace-normal break-words">
                <p className="font-medium">{r.init.name}</p>
                {r.init.owner && <p className="text-[10px] text-muted-foreground">Owner: {r.init.owner}</p>}
              </TableCell>
              <TableCell className="text-[11px] text-muted-foreground py-2 px-3 align-top whitespace-normal break-words">{r.activityText}</TableCell>
              <TableCell className="text-[11px] text-muted-foreground py-2 px-3 align-top whitespace-normal break-words">{r.outcomeText}</TableCell>
              <TableCell className="py-2 px-3 align-top whitespace-normal break-words">{renderKpis(r.init)}</TableCell>
              <TableCell className="py-2 px-3 whitespace-nowrap align-top">{renderTimeline(r.init)}</TableCell>
              <TableCell className="py-2 px-3 align-top">{renderResponsibility(r.objLinkedOrgNodeIds)}</TableCell>
              <TableCell className="py-2 px-3 align-top">{renderStatus(r.init)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
