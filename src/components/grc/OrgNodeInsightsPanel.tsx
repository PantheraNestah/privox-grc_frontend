// Side panel showing roll-up insights for a single org node:
// linked objectives, initiatives, documents (with currency), assessment progress,
// users assigned to that unit, and per-document approval state.
//
// Pure presentation: receives all data via props.

import { CheckCircle2, AlertTriangle, FileEdit, Target, Rocket, FileText, Users, Layers } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ORG_TYPE_LABELS, ORG_TYPE_COLORS, type OrgNode } from "@/data/orgStore";
import {
  DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_COLORS,
  computeDocumentStatus, type PolicyDocument,
} from "@/data/documentsStore";
import { ASSESSMENT_STATUS_LABELS, ASSESSMENT_STATUS_COLORS, type InitiativeAssessment } from "@/data/assessmentStore";
import type { StrategyConfig } from "@/data/strategyStore";
import type { AppUser } from "@/data/userStore";
import { ROLE_LABELS, ROLE_COLORS } from "@/data/userStore";

interface Props {
  node: OrgNode | null;
  open: boolean;
  onClose: () => void;
  /** All children/descendant ids of the selected node (incl. itself) — used to roll up counts. */
  descendantIds: Set<string>;
  documents: PolicyDocument[];
  strategy: StrategyConfig;
  assessments: InitiativeAssessment[];
  users: AppUser[];
}

export const OrgNodeInsightsPanel = ({
  node, open, onClose, descendantIds, documents, strategy, assessments, users,
}: Props) => {
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

  // ---- Users assigned ----
  const assignedUsers = users.filter(u => u.orgNodeId && descendantIds.has(u.orgNodeId));

  const color = ORG_TYPE_COLORS[node.type];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: `hsl(${color} / 0.12)`, color: `hsl(${color})` }}
            >
              {ORG_TYPE_LABELS[node.type]}
            </span>
            <Badge variant="secondary" className="text-[10px]">{descendantIds.size - 1} child unit{descendantIds.size === 2 ? "" : "s"}</Badge>
          </div>
          <SheetTitle className="text-xl">{node.name}</SheetTitle>
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
            <MiniStat icon={<Users className="w-3.5 h-3.5" />} label="Users" value={assignedUsers.length} />
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
                        <span
                          className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded shrink-0"
                          style={{
                            background: `hsl(${DOCUMENT_TYPE_COLORS[d.type]} / 0.12)`,
                            color: `hsl(${DOCUMENT_TYPE_COLORS[d.type]})`,
                          }}
                        >
                          {DOCUMENT_TYPE_LABELS[d.type]}
                        </span>
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

          {/* Users */}
          <Section title="Users assigned" icon={<Users className="w-3.5 h-3.5" />}>
            {assignedUsers.length === 0 ? (
              <Empty>No users linked to this unit (or its sub-units).</Empty>
            ) : (
              <ul className="space-y-1.5">
                {assignedUsers.slice(0, 10).map(u => (
                  <li key={u.id} className="flex items-center gap-2 text-xs">
                    <span
                      className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded shrink-0"
                      style={{ background: `hsl(${ROLE_COLORS[u.role]} / 0.12)`, color: `hsl(${ROLE_COLORS[u.role]})` }}
                    >
                      {ROLE_LABELS[u.role]}
                    </span>
                    <span className="text-foreground truncate flex-1">{u.name}</span>
                    <span className="text-muted-foreground text-[10px] truncate">{u.email}</span>
                  </li>
                ))}
                {assignedUsers.length > 10 && <li className="text-[11px] text-muted-foreground italic">+{assignedUsers.length - 10} more</li>}
              </ul>
            )}
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <Card className="p-3">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
      {icon}{title}
    </p>
    {children}
  </Card>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-muted-foreground italic">{children}</p>
);

const MiniStat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="border border-border rounded-md p-2.5">
    <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">{icon}{label}</p>
    <p className="text-lg font-semibold text-foreground leading-tight mt-0.5">{value}</p>
  </div>
);

const CurrencyPill = ({ icon, label, count, color }: { icon: React.ReactNode; label: string; count: number; color: string }) => (
  <div
    className="rounded-md border px-2 py-1.5 flex flex-col items-start gap-0.5"
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
