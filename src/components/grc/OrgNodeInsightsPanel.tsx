// Side panel showing roll-up insights for a single org node:
// linked objectives, initiatives, documents (with currency), assessment progress,
// people placed at that unit (live from the API), and per-document approval state.
//
// Documents/strategy/assessments arrive via props; placed users are fetched (and
// cached) here so the panel always reflects the real placements.

import { CheckCircle2, AlertTriangle, FileEdit, Target, Rocket, FileText, Users, Layers } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgNodeMembers } from "@/hooks/use-org-nodes";
import { formatDateTime, initials } from "@/lib/format";
import { isAxiosError } from "axios";
import { ORG_TYPE_LABELS, ORG_TYPE_COLORS, type OrgNode } from "@/data/orgStore";
import {
  DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_COLORS,
  computeDocumentStatus, type PolicyDocument,
} from "@/data/documentsStore";
import { ASSESSMENT_STATUS_LABELS, ASSESSMENT_STATUS_COLORS, type InitiativeAssessment } from "@/data/assessmentStore";
import type { StrategyConfig } from "@/data/strategyStore";

interface Props {
  /** Organization the node belongs to (needed to load its members). */
  orgId?: string;
  node: OrgNode | null;
  open: boolean;
  onClose: () => void;
  /** All children/descendant ids of the selected node (incl. itself) — used to roll up counts. */
  descendantIds: Set<string>;
  documents: PolicyDocument[];
  strategy: StrategyConfig;
  assessments: InitiativeAssessment[];
}

export const OrgNodeInsightsPanel = ({
  orgId, node, open, onClose, descendantIds, documents, strategy, assessments,
}: Props) => {
  const membersQuery = useOrgNodeMembers(orgId, open ? node?.id : undefined);
  if (!node) return null;

  // ---- Documents linked to this node OR any descendant ----
  const linkedDocs = documents.filter(d => d.linkedOrgNodeIds.some(id => descendantIds.has(id)));
  const docsByStatus = { current: 0, expired: 0, draft: 0 };
  linkedDocs.forEach(d => {
    const s = computeDocumentStatus(d);
    docsByStatus[s] = (docsByStatus[s] ?? 0) + 1;
  });

  // ---- Objectives + initiatives ----
  const linkedObjectives = strategy.objectives.filter(o =>
    o.linkedOrgNodeIds.some(id => descendantIds.has(id))
  );
  const linkedInitiatives = linkedObjectives.flatMap(o => o.initiatives);
  const initiativeIds = new Set(linkedInitiatives.map(i => i.id));

  // ---- Assessments tied to those initiatives ----
  const relatedAssessments = assessments.filter(a => initiativeIds.has(a.initiativeId));
  const assessmentBuckets = {
    draft: 0, submitted: 0, in_review: 0, approved: 0, rejected: 0,
  } as Record<string, number>;
  relatedAssessments.forEach(a => { assessmentBuckets[a.status] = (assessmentBuckets[a.status] ?? 0) + 1; });

  const members = membersQuery.data ?? [];

  const color = ORG_TYPE_COLORS[node.type];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[480px]">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-transparent text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: `hsl(${color} / 0.12)`, color: `hsl(${color})` }}
            >
              {ORG_TYPE_LABELS[node.type]}
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-normal">{descendantIds.size - 1} child unit{descendantIds.size === 2 ? "" : "s"}</Badge>
          </div>
          <SheetTitle className="text-xl text-navy-deep">{node.name}</SheetTitle>
          {node.description && (
            <SheetDescription className="text-xs">{node.description}</SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* Quick counts */}
          <div className="grid grid-cols-2 gap-2">
            <MiniStat icon={<Target className="w-3.5 h-3.5" />} label="Objectives" value={linkedObjectives.length} />
            <MiniStat icon={<Rocket className="w-3.5 h-3.5" />} label="Initiatives" value={linkedInitiatives.length} />
            <MiniStat icon={<FileText className="w-3.5 h-3.5" />} label="Documents" value={linkedDocs.length} />
            <MiniStat icon={<Users className="w-3.5 h-3.5" />} label="People" value={membersQuery.isSuccess ? members.length : "—"} />
          </div>

          {/* Document currency */}
          <Section title="Document currency" icon={<FileText className="w-3.5 h-3.5" />}>
            {linkedDocs.length === 0 ? (
              <Empty>No documents linked yet.</Empty>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <CurrencyPill icon={<CheckCircle2 className="w-3 h-3" />} label="Current" count={docsByStatus.current} color={DOCUMENT_STATUS_COLORS.current} />
                  <CurrencyPill icon={<AlertTriangle className="w-3 h-3" />} label="Due / Expired" count={docsByStatus.expired} color={DOCUMENT_STATUS_COLORS.expired} />
                  <CurrencyPill icon={<FileEdit className="w-3 h-3" />} label="Draft" count={docsByStatus.draft} color={DOCUMENT_STATUS_COLORS.draft} />
                </div>
                <ul className="space-y-1.5">
                  {linkedDocs.slice(0, 8).map(d => {
                    const s = computeDocumentStatus(d);
                    return (
                      <li key={d.id} className="flex items-center gap-2 text-xs">
                        <Badge
                          variant="outline"
                          className="shrink-0 border-transparent px-1.5 py-0 text-[9px] uppercase tracking-wider"
                          style={{
                            background: `hsl(${DOCUMENT_TYPE_COLORS[d.type]} / 0.12)`,
                            color: `hsl(${DOCUMENT_TYPE_COLORS[d.type]})`,
                          }}
                        >
                          {DOCUMENT_TYPE_LABELS[d.type]}
                        </Badge>
                        <span className="text-foreground truncate flex-1">{d.title}</span>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `hsl(${DOCUMENT_STATUS_COLORS[s]})` }} title={DOCUMENT_STATUS_LABELS[s]} />
                      </li>
                    );
                  })}
                  {linkedDocs.length > 8 && <li className="text-[11px] text-muted-foreground italic">+{linkedDocs.length - 8} more</li>}
                </ul>
              </>
            )}
          </Section>

          {/* Strategy roll-up */}
          <Section title="Strategy progress" icon={<Layers className="w-3.5 h-3.5" />}>
            {linkedInitiatives.length === 0 ? (
              <Empty>No objectives or initiatives linked.</Empty>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
                  <ProgressLine label="Approved" value={assessmentBuckets.approved} total={linkedInitiatives.length} color={ASSESSMENT_STATUS_COLORS.approved} />
                  <ProgressLine label="Awaiting Approver" value={assessmentBuckets.submitted} total={linkedInitiatives.length} color={ASSESSMENT_STATUS_COLORS.submitted} />
                  <ProgressLine label="Awaiting Risk Mgr" value={assessmentBuckets.in_review} total={linkedInitiatives.length} color={ASSESSMENT_STATUS_COLORS.in_review} />
                  <ProgressLine label="Draft / Not started" value={(assessmentBuckets.draft ?? 0) + (linkedInitiatives.length - relatedAssessments.length)} total={linkedInitiatives.length} color={ASSESSMENT_STATUS_COLORS.draft} />
                </div>
              </>
            )}
          </Section>

          {/* People placed at this unit */}
          <Section title="People placed here" icon={<Users className="w-3.5 h-3.5" />}>
            {membersQuery.isLoading && (
              <div className="space-y-2" role="status">
                <span className="sr-only">Loading members…</span>
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            )}
            {membersQuery.isError && (
              <p className="text-xs text-destructive">{membersErrorMessage(membersQuery.error)}</p>
            )}
            {membersQuery.isSuccess && members.length === 0 && (
              <Empty>No one is placed at this unit yet.</Empty>
            )}
            {members.length > 0 && (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {members.map(m => {
                  const ended = !!m.effectiveTo && new Date(m.effectiveTo).getTime() < Date.now();
                  return (
                    <li key={m.id} className="flex items-center gap-2.5 text-xs">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-brand-accent/10 text-[10px] font-semibold text-navy">
                          {initials(m.userFullName || m.userEmail)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{m.userFullName || m.userEmail}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{m.userEmail}</p>
                      </div>
                      {ended ? (
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">Ended</Badge>
                      ) : (
                        <span className="shrink-0 text-[10px] text-muted-foreground" title={`Placed ${formatDateTime(m.effectiveFrom)}`}>
                          since {new Date(m.effectiveFrom).toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

function membersErrorMessage(error: unknown): string {
  if (isAxiosError(error) && error.response?.status === 403) {
    return "You don't have permission to view the people placed at this unit.";
  }
  return "Couldn't load the people placed at this unit.";
}

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <Card className="shadow-none">
    <CardHeader className="p-3 pb-2">
      <CardTitle className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}{title}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-3 pt-0">{children}</CardContent>
  </Card>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs italic text-muted-foreground">{children}</p>
);

const MiniStat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) => (
  <Card className="shadow-none">
    <CardContent className="p-2.5">
      <p className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">{icon}{label}</p>
      <p className="mt-0.5 text-lg font-semibold leading-tight text-navy-deep">{value}</p>
    </CardContent>
  </Card>
);

const CurrencyPill = ({ icon, label, count, color }: { icon: React.ReactNode; label: string; count: number; color: string }) => (
  <div
    className="flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5"
    style={{ borderColor: `hsl(${color} / 0.4)`, background: `hsl(${color} / 0.08)` }}
  >
    <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: `hsl(${color})` }}>
      {icon}{label}
    </span>
    <span className="text-base font-semibold text-foreground">{count}</span>
  </div>
);

const ProgressLine = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value} <span className="text-muted-foreground">({pct}%)</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: `hsl(${color})` }} />
      </div>
    </div>
  );
};
