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
import { Card } from "@/components/ui/card";
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
          <span key={n.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground">
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
      const s = init.formulationStatus;
      return (
        <Badge variant="outline" className="text-[10px]"
          style={{
            background: `hsl(${FORMULATION_STATUS_COLORS[s]} / 0.12)`,
            borderColor: `hsl(${FORMULATION_STATUS_COLORS[s]} / 0.4)`,
            color: `hsl(${FORMULATION_STATUS_COLORS[s]})`,
          }}>
          {FORMULATION_STATUS_LABELS[s]}
        </Badge>
      );
    }
    // assessment — show BOTH the workflow status and the actual progress status
    const a = props.assessments.find(x => x.initiativeId === init.id);
    if (!a) {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground italic">Not started</span>
          <Badge variant="outline" className="text-[10px] gap-1"
            style={{
              background: `hsl(${INITIATIVE_STATUS_COLORS[init.status]} / 0.12)`,
              borderColor: `hsl(${INITIATIVE_STATUS_COLORS[init.status]} / 0.4)`,
              color: `hsl(${INITIATIVE_STATUS_COLORS[init.status]})`,
            }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${INITIATIVE_STATUS_COLORS[init.status]})` }} />
            {INITIATIVE_STATUS_LABELS[init.status]}
          </Badge>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className="text-[10px]"
          style={{
            background: `hsl(${ASSESSMENT_STATUS_COLORS[a.status]} / 0.12)`,
            borderColor: `hsl(${ASSESSMENT_STATUS_COLORS[a.status]} / 0.4)`,
            color: `hsl(${ASSESSMENT_STATUS_COLORS[a.status]})`,
          }}>
          {ASSESSMENT_STATUS_LABELS[a.status]}
        </Badge>
        <Badge variant="outline" className="text-[10px] gap-1"
          style={{
            background: `hsl(${INITIATIVE_STATUS_COLORS[a.initiativeStatus]} / 0.12)`,
            borderColor: `hsl(${INITIATIVE_STATUS_COLORS[a.initiativeStatus]} / 0.4)`,
            color: `hsl(${INITIATIVE_STATUS_COLORS[a.initiativeStatus]})`,
          }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${INITIATIVE_STATUS_COLORS[a.initiativeStatus]})` }} />
          {INITIATIVE_STATUS_LABELS[a.initiativeStatus]}
        </Badge>
      </div>
    );
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            {props.variant === "formulation" ? "Formulation table" : "Assessment table"}
          </span>
        </div>
        <Badge variant="secondary" className="text-[10px]">{filteredRows.length} of {rows.length}</Badge>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Filter by level:</span>
          <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as OrgNodeType | "all")}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
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
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[1400px]">
          <TableHeader>
            <TableRow>
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
      </div>
    </Card>
  );
};
