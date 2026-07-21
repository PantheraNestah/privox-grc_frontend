// Strategy Performance Assessment — StratOS-inspired rebuild.
//
// Tabs:
//   • Self-Assessment  — every user can score their initiatives' KPIs (% achievement + RAG)
//   • Approvals        — queue of submitted assessments where the current user qualifies as approver
//                        (must sit STRICTLY ABOVE the submitter in the org hierarchy)
//   • Reports          — pillar roll-ups & overall performance gauges
//
// Visibility (Self-Assessment):
//   - Global viewers (Admin / Risk Manager / Executive) see everything.
//   - Everyone else sees only initiatives whose objective is linked to their unit or a descendant.

import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, ClipboardCheck, Compass, Target, Rocket, Gauge,
  Send, Check, X, MessageSquare, Lock, Plus, ShieldCheck, RotateCcw, FileText,
  TrendingUp, Activity as ActivityIcon, Paperclip, Upload, Download, Trash2,
} from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  loadStrategy,
  type StrategyConfig, type Initiative, type InitiativeStatus, type Kpi, type EvidenceFile,
} from "@/data/strategyStore";
import {
  loadOrgNodes, getOrgDescendantChain, uid, type OrgNode,
} from "@/data/orgStore";
import {
  loadAssessments, saveAssessments, newAssessment, newAssessmentComment,
  ASSESSMENT_STATUS_LABELS, ASSESSMENT_STATUS_COLORS,
  ragFromPercent, RAG_COLORS, RAG_LABELS, assessmentScore,
  type InitiativeAssessment, type KpiAssessment, type RagStatus,
} from "@/data/assessmentStore";
import { useActiveUser } from "@/hooks/use-active-user";
import { can, ROLE_LABELS, loadUsers, type AppUser } from "@/data/userStore";
import { AssessmentInsights } from "@/components/grc/AssessmentInsights";
import { getPendingActor, getEligibleApprovers } from "@/data/assessmentPending";

type Tab = "assess" | "approvals" | "reports";

const StrategyAssessment = () => {
  const activeUser = useActiveUser();
  const [cfg, setCfg] = useState<StrategyConfig>({ pillars: [], objectives: [] });
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [assessments, setAssessments] = useState<InitiativeAssessment[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [tab, setTab] = useState<Tab>("assess");
  const [editing, setEditing] = useState<{ a: InitiativeAssessment; init: Initiative } | null>(null);
  const [reviewing, setReviewing] = useState<InitiativeAssessment | null>(null);

  useEffect(() => {
    setCfg(loadStrategy());
    setOrgNodes(loadOrgNodes());
    setAssessments(loadAssessments());
    setUsers(loadUsers());
  }, []);

  const persistAssessments = (next: InitiativeAssessment[]) => {
    setAssessments(next);
    saveAssessments(next);
  };

  const isGlobalViewer = can.viewAllScopes(activeUser.role);
  const userScopeNodeIds = useMemo(() => {
    if (!activeUser.orgNodeId) return new Set<string>();
    return new Set(getOrgDescendantChain(orgNodes, activeUser.orgNodeId).map(n => n.id));
  }, [orgNodes, activeUser.orgNodeId]);

  // Flat list of initiatives the current user can SEE (for self-assessment & reports).
  const visibleRows = useMemo(() => {
    const list: { pillarName: string; objectiveTitle: string; objectiveId: string; pillarId: string; objLinkedOrgNodeIds: string[]; init: Initiative }[] = [];
    cfg.pillars.forEach(p => {
      cfg.objectives.filter(o => o.pillarId === p.id).forEach(o => {
        if (!isGlobalViewer) {
          if (userScopeNodeIds.size === 0) return;
          if (!o.linkedOrgNodeIds.some(nid => userScopeNodeIds.has(nid))) return;
        }
        o.initiatives.forEach(init => {
          list.push({ pillarName: p.name, objectiveTitle: o.title, objectiveId: o.id, pillarId: p.id, objLinkedOrgNodeIds: o.linkedOrgNodeIds, init });
        });
      });
    });
    return list;
  }, [cfg, isGlobalViewer, userScopeNodeIds]);

  const findAssessment = (initId: string) => assessments.find(a => a.initiativeId === initId);

  const ensureAssessment = (initId: string, objectiveId: string, pillarId: string, initiativeStatus: InitiativeStatus): InitiativeAssessment => {
    const existing = findAssessment(initId);
    if (existing) return existing;
    const a = newAssessment({ initiativeId: initId, objectiveId, pillarId, createdByUserId: activeUser.id, initiativeStatus });
    const next = [...assessments, a];
    persistAssessments(next);
    return a;
  };

  // ─── Approver eligibility ──────────────────────────────────────────────────
  // Only the eligible approvers for THIS submission see it in their queue.
  // Eligibility is computed from the org hierarchy (strict ancestors with an approver role).
  // Admins are included only when no in-chain approver exists — so submissions don't
  // skip the immediate approver and pile up on the admin's desk.
  const canApproveAssessment = (a: InitiativeAssessment): boolean => {
    if (!can.approve(activeUser.role)) return false;
    if (a.status !== "submitted" && a.status !== "in_review") return false;
    const submitter = users.find(u => u.id === a.createdByUserId);
    const eligible = getEligibleApprovers(submitter, users, orgNodes, a.delegatedToUserId);
    return eligible.some(u => u.id === activeUser.id);
  };

  // Approvals queue: submitted assessments where the current user qualifies.
  const approvalQueue = useMemo(
    () => assessments.filter(canApproveAssessment),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assessments, activeUser, orgNodes, users],
  );

  // Stats
  const stats = useMemo(() => ({
    total: visibleRows.length,
    draft: assessments.filter(a => a.status === "draft").length,
    submitted: assessments.filter(a => a.status === "submitted" || a.status === "in_review").length,
    approved: assessments.filter(a => a.status === "approved").length,
    rejected: assessments.filter(a => a.status === "rejected").length,
  }), [visibleRows, assessments]);

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const updateAssessment = (id: string, mutate: (a: InitiativeAssessment) => InitiativeAssessment) => {
    persistAssessments(assessments.map(a => {
      if (a.id !== id) return a;
      const next = mutate(a);
      next.updatedAt = new Date().toISOString();
      return next;
    }));
  };

  const submitForApproval = (a: InitiativeAssessment) => {
    if (a.kpiAssessments.length === 0) {
      toast.error("Score at least one KPI before submitting.");
      return;
    }
    updateAssessment(a.id, prev => ({
      ...prev,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    }));
    toast.success("Submitted for approval");
    setEditing(null);
  };

  const approve = (a: InitiativeAssessment, comment: string) => {
    updateAssessment(a.id, prev => ({
      ...prev,
      status: "approved",
      comments: comment.trim() ? [...prev.comments, newAssessmentComment(activeUser.id, activeUser.name, ROLE_LABELS[activeUser.role], `✓ Approved: ${comment.trim()}`)] : prev.comments,
    }));
    toast.success("Assessment approved");
    setReviewing(null);
  };

  const reject = (a: InitiativeAssessment, comment: string) => {
    if (!comment.trim()) { toast.error("Add rejection remarks"); return; }
    updateAssessment(a.id, prev => ({
      ...prev,
      status: "rejected",
      comments: [...prev.comments, newAssessmentComment(activeUser.id, activeUser.name, ROLE_LABELS[activeUser.role], `✗ Rejected: ${comment.trim()}`)],
    }));
    toast.success("Assessment rejected");
    setReviewing(null);
  };

  const sendBack = (a: InitiativeAssessment, comment: string) => {
    if (!comment.trim()) { toast.error("Add a comment so the input user knows what to fix"); return; }
    updateAssessment(a.id, prev => ({
      ...prev,
      status: "draft",
      submittedAt: undefined,
      comments: [...prev.comments, newAssessmentComment(activeUser.id, activeUser.name, ROLE_LABELS[activeUser.role], `↩ Returned for revision: ${comment.trim()}`)],
    }));
    toast.success("Sent back to input user");
    setReviewing(null);
  };

  const delegate = (a: InitiativeAssessment, toUserId: string, comment: string) => {
    const target = users.find(u => u.id === toUserId);
    if (!target) { toast.error("Pick a user to delegate to"); return; }
    if (target.id === activeUser.id) { toast.error("You can't delegate to yourself"); return; }
    if (!can.approve(target.role)) { toast.error(`${target.name} doesn't have an approver role`); return; }
    const note = comment.trim()
      ? `↗ Delegated upward to ${target.name} (${ROLE_LABELS[target.role]}): ${comment.trim()}`
      : `↗ Delegated upward to ${target.name} (${ROLE_LABELS[target.role]}).`;
    updateAssessment(a.id, prev => ({
      ...prev,
      delegatedToUserId: target.id,
      comments: [...prev.comments, newAssessmentComment(activeUser.id, activeUser.name, ROLE_LABELS[activeUser.role], note)],
    }));
    toast.success(`Delegated to ${target.name}`);
    setReviewing(null);
  };

  return (
    <>
      <Helmet>
        <title>Strategy Performance Assessment · Rsolve GRC Platform</title>
        <meta name="description" content="Self-assess strategic initiatives, score KPIs and route assessments through hierarchical approvals." />
        <link rel="canonical" href="/governance/strategy-assessment" />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        <TopNav />

        <main className="flex-1 px-5 md:px-10 py-8 md:py-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/governance" className="hover:text-foreground transition-colors">Governance Management</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Strategy Performance Assessment</span>
          </nav>

          <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[28px] md:text-[32px] font-semibold tracking-tight text-foreground leading-none">
                Performance Assessment
              </h1>
              <p className="text-[13.5px] text-muted-foreground mt-2 max-w-2xl">
                Self-assess each initiative's KPIs (score % + RAG), then submit for approval.
                Approvals route up the org hierarchy automatically.
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Viewing as <strong className="text-foreground">{activeUser.name}</strong> ({ROLE_LABELS[activeUser.role]})
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/governance">
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
              </Link>
            </Button>
          </header>

          <Card className="p-3 mb-5 bg-muted/30 border-border">
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {isGlobalViewer
                ? <span><strong className="text-foreground">{ROLE_LABELS[activeUser.role]} view —</strong> seeing the entire performance picture across all units.</span>
                : activeUser.orgNodeId
                  ? <span><strong className="text-foreground">Scoped view —</strong> you self-assess initiatives in your unit or a unit below it. Approvals you receive must come from above.</span>
                  : <span className="text-warn"><strong>No org unit linked —</strong> ask an Administrator to assign you in User Management.</span>
              }
            </p>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatCard icon={<Rocket className="w-4 h-4" />}        label="Initiatives"      value={stats.total} />
            <StatCard icon={<ClipboardCheck className="w-4 h-4" />} label="Draft"            value={stats.draft}     color="215 16% 47%" />
            <StatCard icon={<Send className="w-4 h-4" />}           label="Awaiting approval" value={stats.submitted} color="210 61% 49%" />
            <StatCard icon={<Check className="w-4 h-4" />}          label="Approved"         value={stats.approved}  color="158 53% 49%" />
            <StatCard icon={<X className="w-4 h-4" />}              label="Rejected"         value={stats.rejected}  color="352 70% 61%" />
          </div>

          {/* Tabs */}
          <div className="border-b border-border flex items-center gap-1 mb-5 overflow-x-auto">
            <TabBtn current={tab} id="assess"    label="Self-Assessment" icon={<ClipboardCheck className="w-3.5 h-3.5" />} onClick={setTab} />
            <TabBtn current={tab} id="approvals" label={`Approvals${approvalQueue.length > 0 ? ` (${approvalQueue.length})` : ""}`} icon={<ShieldCheck className="w-3.5 h-3.5" />} onClick={setTab} />
            <TabBtn current={tab} id="reports"   label="Reports & Analytics" icon={<TrendingUp className="w-3.5 h-3.5" />} onClick={setTab} />
          </div>

          {tab === "assess" && (
            <SelfAssessmentView
              rows={visibleRows}
              assessments={assessments}
              users={users}
              orgNodes={orgNodes}
              currentUserId={activeUser.id}
              canSelfAssess={can.submitAssessment(activeUser.role)}
              onOpen={(init, objId, pillarId) => {
                const a = ensureAssessment(init.id, objId, pillarId, init.status);
                setEditing({ a, init });
              }}
            />
          )}

          {tab === "approvals" && (
            <ApprovalsView
              queue={approvalQueue}
              cfg={cfg}
              users={users}
              orgNodes={orgNodes}
              activeUser={activeUser}
              allAssessments={assessments}
              onReview={setReviewing}
            />
          )}

          {tab === "reports" && (
            <ReportsView rows={visibleRows} assessments={assessments} cfg={cfg} orgNodes={orgNodes} />
          )}
        </main>
      </div>

      {/* Self-assessment editor */}
      {editing && (
        <AssessmentEditor
          assessment={editing.a}
          init={editing.init}
          currentUserId={activeUser.id}
          currentUserName={activeUser.name}
          onClose={() => { setEditing(null); setAssessments(loadAssessments()); }}
          onUpdate={(mut) => {
            updateAssessment(editing.a.id, mut);
            // Re-pull updated assessment so the dialog reflects changes immediately
            setEditing(prev => prev ? { ...prev, a: { ...mut(prev.a), updatedAt: new Date().toISOString() } } : prev);
          }}
          onSubmit={() => submitForApproval(editing.a)}
        />
      )}

      {/* Approver review */}
      {reviewing && (
        <ReviewDialog
          assessment={reviewing}
          init={visibleRows.find(r => r.init.id === reviewing.initiativeId)?.init}
          submitter={users.find(u => u.id === reviewing.createdByUserId)}
          users={users}
          activeUser={activeUser}
          onClose={() => setReviewing(null)}
          onApprove={(c) => approve(reviewing, c)}
          onReject={(c) => reject(reviewing, c)}
          onSendBack={(c) => sendBack(reviewing, c)}
          onDelegate={(uid, c) => delegate(reviewing, uid, c)}
        />
      )}
    </>
  );
};

export default StrategyAssessment;

// ═══════════════════════════ Sub-components ═══════════════════════════

const TabBtn = ({ current, id, label, icon, onClick }: { current: Tab; id: Tab; label: string; icon: React.ReactNode; onClick: (t: Tab) => void }) => (
  <button
    onClick={() => onClick(id)}
    className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
      current === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
    }`}
  >
    {icon}{label}
  </button>
);

const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color?: string }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
      {color && <span className="w-2 h-2 rounded-full" style={{ background: `hsl(${color})` }} />}
      {icon}<span>{label}</span>
    </div>
    <p className="text-2xl font-semibold text-foreground leading-none">{value}</p>
  </Card>
);

// ─────────────── Self-Assessment view ───────────────
const SelfAssessmentView = ({ rows, assessments, users, orgNodes, currentUserId, canSelfAssess, onOpen }: {
  rows: { pillarName: string; objectiveTitle: string; objectiveId: string; pillarId: string; init: Initiative }[];
  assessments: InitiativeAssessment[];
  users: AppUser[];
  orgNodes: OrgNode[];
  currentUserId: string;
  canSelfAssess: boolean;
  onOpen: (init: Initiative, objId: string, pillarId: string) => void;
}) => {
  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center border-dashed">
        <Compass className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No initiatives to assess</p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Build your strategy first.
        </p>
        <Button asChild size="sm"><Link to="/governance/strategy-formulation">Go to Strategy Formulation</Link></Button>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold">Initiative</th>
              <th className="text-left px-3 py-2.5 font-semibold">Pillar / Objective</th>
              <th className="text-left px-3 py-2.5 font-semibold">KPIs</th>
              <th className="text-left px-3 py-2.5 font-semibold">Score</th>
              <th className="text-left px-3 py-2.5 font-semibold">RAG</th>
              <th className="text-left px-3 py-2.5 font-semibold">Status</th>
              <th className="text-right px-3 py-2.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(r => {
              const a = assessments.find(x => x.initiativeId === r.init.id);
              const score = a ? assessmentScore(a) : 0;
              const rag = a ? ragFromPercent(score) : "amber";
              const status = a?.status ?? "draft";
              const pending = a
                ? getPendingActor(a, users, orgNodes)
                : { statusLabel: ASSESSMENT_STATUS_LABELS.draft, actorShort: "—", actorLabel: "", combined: ASSESSMENT_STATUS_LABELS.draft };
              return (
                <tr key={r.init.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{r.init.name}</p>
                    {r.init.owner && <p className="text-[10px] text-muted-foreground">Owner: {r.init.owner}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <p className="text-[10px]">{r.pillarName}</p>
                    <p>{r.objectiveTitle}</p>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px]">{r.init.kpis.length}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] font-semibold">
                    {a && a.kpiAssessments.length > 0 ? `${score}%` : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {a && a.kpiAssessments.length > 0 ? (
                      <Badge variant="outline" className="text-[10px]" style={{
                        background: `hsl(${RAG_COLORS[rag]} / 0.12)`,
                        borderColor: `hsl(${RAG_COLORS[rag]} / 0.4)`,
                        color: `hsl(${RAG_COLORS[rag]})`,
                      }}>
                        <span className="w-1.5 h-1.5 rounded-full mr-1" style={{ background: `hsl(${RAG_COLORS[rag]})` }} />
                        {RAG_LABELS[rag]}
                      </Badge>
                    ) : <span className="text-muted-foreground text-[10px]">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-[10px]" style={{
                      background: `hsl(${ASSESSMENT_STATUS_COLORS[status]} / 0.12)`,
                      borderColor: `hsl(${ASSESSMENT_STATUS_COLORS[status]} / 0.4)`,
                      color: `hsl(${ASSESSMENT_STATUS_COLORS[status]})`,
                    }}>
                      {pending.statusLabel}
                    </Badge>
                    {pending.actorShort !== "—" && (
                      <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[180px]" title={pending.actorLabel}>
                        {pending.actorShort}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button size="sm" variant={a ? "outline" : "default"} className="h-7 text-[11px]" onClick={() => onOpen(r.init, r.objectiveId, r.pillarId)} disabled={!canSelfAssess && !a}>
                      {a ? "Open" : <><Plus className="w-3 h-3 mr-1" /> Start</>}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ─────────────── Approvals view ───────────────
const ApprovalsView = ({ queue, cfg, users, orgNodes, activeUser, allAssessments, onReview }: {
  queue: InitiativeAssessment[];
  cfg: StrategyConfig;
  users: AppUser[];
  orgNodes: OrgNode[];
  activeUser: AppUser;
  allAssessments: InitiativeAssessment[];
  onReview: (a: InitiativeAssessment) => void;
}) => {
  const initMap = useMemo(() => {
    const m = new Map<string, { init: Initiative; pillarName: string; objTitle: string }>();
    cfg.pillars.forEach(p => cfg.objectives.filter(o => o.pillarId === p.id).forEach(o => o.initiatives.forEach(i =>
      m.set(i.id, { init: i, pillarName: p.name, objTitle: o.title }),
    )));
    return m;
  }, [cfg]);
  const orgNodeMap = useMemo(() => new Map(orgNodes.map(n => [n.id, n])), [orgNodes]);

  if (queue.length === 0) {
    // Explain WHY nothing is pending — with concrete reasons.
    const submittedCount = allAssessments.filter(a => a.status === "submitted" || a.status === "in_review").length;
    const userHasOrgUnit = !!activeUser.orgNodeId;
    const canApproveRole = can.approve(activeUser.role);

    const reasons: string[] = [];
    if (!canApproveRole) reasons.push(`Your role (${ROLE_LABELS[activeUser.role]}) cannot approve assessments.`);
    if (canApproveRole && activeUser.role !== "admin" && !userHasOrgUnit) {
      reasons.push("You aren't linked to an org unit, so the system can't tell which submissions sit below you.");
    }
    if (submittedCount === 0) reasons.push("No one has submitted an assessment yet.");
    if (submittedCount > 0 && canApproveRole && (activeUser.role === "admin" || userHasOrgUnit)) {
      reasons.push(`${submittedCount} assessment${submittedCount === 1 ? " is" : "s are"} pending — but the submitter${submittedCount === 1 ? " sits" : "s sit"} outside your branch of the hierarchy.`);
    }

    return (
      <Card className="p-10 text-center border-dashed">
        <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No assessments awaiting your approval</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Approvals appear here when someone in a unit <em>below yours</em> submits an assessment.
        </p>
        {reasons.length > 0 && (
          <ul className="mt-4 text-[11px] text-muted-foreground max-w-md mx-auto text-left space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{r}</span></li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold">Initiative</th>
              <th className="text-left px-3 py-2.5 font-semibold">Score</th>
              <th className="text-left px-3 py-2.5 font-semibold">Submitted by</th>
              <th className="text-left px-3 py-2.5 font-semibold">From unit</th>
              <th className="text-left px-3 py-2.5 font-semibold">Submitted</th>
              <th className="text-right px-3 py-2.5 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {queue.map(a => {
              const meta = initMap.get(a.initiativeId);
              const submitter = users.find(u => u.id === a.createdByUserId);
              const unit = submitter?.orgNodeId ? orgNodeMap.get(submitter.orgNodeId) : null;
              const score = assessmentScore(a);
              const rag = ragFromPercent(score);
              return (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{meta?.init.name ?? "(deleted)"}</p>
                    <p className="text-[10px] text-muted-foreground">{meta?.pillarName} · {meta?.objTitle}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold">
                      {score}%
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${RAG_COLORS[rag]})` }} />
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-foreground">{submitter?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{unit?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button size="sm" className="h-7 text-[11px]" onClick={() => onReview(a)}>Review</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ─────────────── Reports view ───────────────
const ReportsView = ({ rows, assessments, cfg, orgNodes }: {
  rows: { pillarId: string; pillarName: string; init: Initiative }[];
  assessments: InitiativeAssessment[];
  cfg: StrategyConfig;
  orgNodes: OrgNode[];
}) => {
  const pillarPerf = useMemo(() => {
    const map = new Map<string, { name: string; scores: number[] }>();
    cfg.pillars.forEach(p => map.set(p.id, { name: p.name, scores: [] }));
    rows.forEach(r => {
      const a = assessments.find(x => x.initiativeId === r.init.id);
      if (!a || a.kpiAssessments.length === 0) return;
      map.get(r.pillarId)?.scores.push(assessmentScore(a));
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, name: v.name, avg: v.scores.length === 0 ? 0 : Math.round(v.scores.reduce((s, n) => s + n, 0) / v.scores.length), count: v.scores.length }));
  }, [rows, assessments, cfg]);

  const overall = pillarPerf.length === 0 ? 0
    : Math.round(pillarPerf.filter(p => p.count > 0).reduce((s, p) => s + p.avg, 0) / Math.max(1, pillarPerf.filter(p => p.count > 0).length));
  const overallRag = ragFromPercent(overall);

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-5 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-base font-semibold text-foreground">Performance by Pillar</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Average % achievement across all assessed initiatives in each pillar.</p>
          </div>
        </div>
        {pillarPerf.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No pillars defined.</p>
        ) : (
          <div className="space-y-4">
            {pillarPerf.map(p => {
              const rag = ragFromPercent(p.avg);
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-foreground">{p.name}</span>
                    <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                      {p.count > 0 ? `${p.avg}%` : "no data"}
                      <span className="ml-1.5 text-[10px]">({p.count} assessed)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${p.avg}%`, background: `hsl(${RAG_COLORS[rag]})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-base font-semibold text-foreground mb-2">Overall Score</p>
        <div className="flex flex-col items-center py-4">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
              <path className="text-muted" stroke="currentColor" strokeWidth="3.5" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path stroke={`hsl(${RAG_COLORS[overallRag]})`} strokeWidth="3.5" fill="none" strokeLinecap="round"
                strokeDasharray={`${overall}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-semibold text-foreground">{overall}%</span>
            </div>
          </div>
          <Badge variant="outline" className="mt-3" style={{
            background: `hsl(${RAG_COLORS[overallRag]} / 0.12)`,
            borderColor: `hsl(${RAG_COLORS[overallRag]} / 0.4)`,
            color: `hsl(${RAG_COLORS[overallRag]})`,
          }}>
            {RAG_LABELS[overallRag]} · {overall >= 75 ? "On Track" : overall >= 50 ? "At Risk" : "Off Track"}
          </Badge>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            {pillarPerf.filter(p => p.count > 0).length} of {pillarPerf.length} pillars assessed
          </p>
        </div>
      </Card>
    </div>
    <AssessmentInsights cfg={cfg} orgNodes={orgNodes} assessments={assessments} />
    </div>
  );
};

// ─────────────── Self-assessment editor (modal) ───────────────
const AssessmentEditor = ({ assessment, init, currentUserId, currentUserName, onClose, onUpdate, onSubmit }: {
  assessment: InitiativeAssessment;
  init: Initiative;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onUpdate: (mut: (a: InitiativeAssessment) => InitiativeAssessment) => void;
  onSubmit: () => void;
}) => {
  const locked = assessment.status === "submitted" || assessment.status === "in_review" || assessment.status === "approved";
  const isOwner = assessment.createdByUserId === currentUserId;

  const setKpi = (kpiId: string, patch: Partial<KpiAssessment>) => {
    onUpdate(a => {
      const existing = a.kpiAssessments.find(x => x.kpiId === kpiId);
      if (existing) {
        return { ...a, kpiAssessments: a.kpiAssessments.map(x => x.kpiId === kpiId ? { ...x, ...patch } : x) };
      }
      return { ...a, kpiAssessments: [...a.kpiAssessments, { kpiId, status: "not-started", ...patch }] };
    });
  };
  const getKpi = (kpiId: string): KpiAssessment => {
    return assessment.kpiAssessments.find(x => x.kpiId === kpiId) ?? { kpiId, status: "not-started" };
  };

  const handlePctChange = (kpi: Kpi, value: string) => {
    const pct = value === "" ? undefined : Math.max(0, Math.min(100, parseInt(value) || 0));
    setKpi(kpi.id, { percentAchievement: pct, rag: pct == null ? undefined : ragFromPercent(pct) });
  };

  // ── Evidence attachments (only the assessment owner can manage while unlocked) ──
  const canEditEvidence = !locked && isOwner;
  const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024; // 4 MB per file (localStorage budget)

  const handleEvidenceUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newOnes: EvidenceFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_EVIDENCE_BYTES) {
        toast.error(`"${file.name}" exceeds the 4 MB limit and was skipped.`);
        continue;
      }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        newOnes.push({
          id: uid("ev"),
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          dataUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy: currentUserName,
        });
      } catch {
        toast.error(`Could not read "${file.name}".`);
      }
    }
    if (newOnes.length > 0) {
      onUpdate(a => ({ ...a, evidence: [...a.evidence, ...newOnes] }));
      toast.success(`${newOnes.length} file${newOnes.length === 1 ? "" : "s"} attached.`);
    }
  };

  const removeEvidence = (id: string) => {
    onUpdate(a => ({ ...a, evidence: a.evidence.filter(e => e.id !== id) }));
  };

  const overallScore = assessmentScore(assessment);
  const overallRag = ragFromPercent(overallScore);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-[hsl(var(--stratos-purple))]" />
            {init.name}
          </DialogTitle>
          <DialogDescription>Self-assess each KPI: enter actual value, % achievement (auto-RAG), and notes.</DialogDescription>
        </DialogHeader>

        {locked && (
          <Card className="p-3 bg-muted/40 border-border">
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              {assessment.status === "approved" ? "Approved — locked." : "Submitted — read-only until decided by approver."}
            </p>
          </Card>
        )}

        {/* Overall score banner */}
        {assessment.kpiAssessments.length > 0 && (
          <Card className="p-4 bg-gradient-to-r from-muted/40 to-transparent border-border">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall score</p>
                <p className="text-3xl font-semibold text-foreground leading-none mt-1">{overallScore}%</p>
              </div>
              <Badge variant="outline" className="text-xs" style={{
                background: `hsl(${RAG_COLORS[overallRag]} / 0.12)`,
                borderColor: `hsl(${RAG_COLORS[overallRag]} / 0.4)`,
                color: `hsl(${RAG_COLORS[overallRag]})`,
              }}>
                {RAG_LABELS[overallRag]}
              </Badge>
            </div>
          </Card>
        )}

        {/* Initiative status + narrative */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wider">Initiative status</Label>
            <Select value={assessment.initiativeStatus} onValueChange={(v) => onUpdate(a => ({ ...a, initiativeStatus: v as InitiativeStatus }))} disabled={locked}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not-started">Not Started</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px] uppercase tracking-wider">Self-assessment narrative</Label>
            <Textarea rows={2} value={assessment.narrative ?? ""} onChange={e => onUpdate(a => ({ ...a, narrative: e.target.value }))} disabled={locked} placeholder="Summarise progress, blockers, key wins..." />
          </div>
        </div>

        {/* KPIs */}
        <div>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 inline-flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5" /> KPIs
          </p>
          {init.kpis.length === 0 ? (
            <Card className="p-4 text-center border-dashed">
              <p className="text-xs text-muted-foreground">No KPIs defined on this initiative. Add them in Strategy Formulation first.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {init.kpis.map(kpi => {
                const ka = getKpi(kpi.id);
                const rag = ka.rag ?? (typeof ka.percentAchievement === "number" ? ragFromPercent(ka.percentAchievement) : undefined);
                return (
                  <div key={kpi.id} className="border border-border rounded-md p-3 bg-card space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-foreground">{kpi.name || "(unnamed KPI)"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Target: <strong>{kpi.target ?? "—"}{kpi.unit ? ` ${kpi.unit}` : ""}</strong>
                          {" · "}<Badge variant="secondary" className="text-[9px] font-normal">{kpi.type}</Badge>
                        </p>
                      </div>
                      {rag && (
                        <Badge variant="outline" className="text-[10px]" style={{
                          background: `hsl(${RAG_COLORS[rag]} / 0.12)`,
                          borderColor: `hsl(${RAG_COLORS[rag]} / 0.4)`,
                          color: `hsl(${RAG_COLORS[rag]})`,
                        }}>{RAG_LABELS[rag]}</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Actual value</Label>
                        <Input className="h-8 text-xs" value={ka.actual ?? ""} onChange={e => setKpi(kpi.id, { actual: e.target.value })} disabled={locked} placeholder={kpi.unit || "value"} />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">% Achieved</Label>
                        <Input type="number" min={0} max={100} className="h-8 text-xs font-mono" value={ka.percentAchievement ?? ""} onChange={e => handlePctChange(kpi, e.target.value)} disabled={locked} placeholder="0" />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">RAG (override)</Label>
                        <Select value={ka.rag ?? "auto"} onValueChange={(v) => setKpi(kpi.id, { rag: v === "auto" ? undefined : v as RagStatus })} disabled={locked}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="green">Green</SelectItem>
                            <SelectItem value="amber">Amber</SelectItem>
                            <SelectItem value="red">Red</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note</Label>
                        <Input className="h-8 text-xs" value={ka.note ?? ""} onChange={e => setKpi(kpi.id, { note: e.target.value })} disabled={locked} placeholder="…" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Evidence attachments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" /> Evidence
              <span className="text-[10px] normal-case tracking-normal text-muted-foreground/80 font-normal">
                · attach proof of objective achievement
              </span>
            </p>
            {canEditEvidence && (
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => { handleEvidenceUpload(e.target.files); e.target.value = ""; }}
                />
                <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-input bg-background hover:bg-accent text-[11px] font-medium">
                  <Upload className="w-3 h-3" /> Upload files
                </span>
              </label>
            )}
          </div>
          {assessment.evidence.length === 0 ? (
            <Card className="p-3 border-dashed text-center">
              <p className="text-[11px] text-muted-foreground">
                {canEditEvidence
                  ? "No evidence attached yet. Upload reports, screenshots, certificates or any proof that supports your scoring."
                  : "No evidence attached."}
              </p>
            </Card>
          ) : (
            <div className="space-y-1.5">
              {assessment.evidence.map(ev => (
                <div key={ev.id} className="flex items-center gap-2 p-2 border border-border rounded-md bg-card">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{ev.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(ev.size / 1024).toFixed(1)} KB
                      {ev.uploadedBy ? ` · ${ev.uploadedBy}` : ""}
                      {" · "}{new Date(ev.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={ev.dataUrl}
                    download={ev.name}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  {canEditEvidence && (
                    <button
                      type="button"
                      onClick={() => removeEvidence(ev.id)}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments thread */}
        {assessment.comments.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Comments
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {assessment.comments.map(c => (
                <div key={c.id} className="text-[11px] bg-muted/40 rounded p-2">
                  <p className="font-semibold text-foreground">{c.authorName} <span className="text-muted-foreground font-normal">· {c.authorRole}</span></p>
                  <p className="text-muted-foreground mt-0.5">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!locked && isOwner && (
            <Button onClick={onSubmit}>
              <Send className="w-3.5 h-3.5 mr-1.5" /> Submit for approval
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─────────────── Approver review dialog ───────────────
const ReviewDialog = ({ assessment, init, submitter, users, activeUser, onClose, onApprove, onReject, onSendBack, onDelegate }: {
  assessment: InitiativeAssessment;
  init: Initiative | undefined;
  submitter: AppUser | undefined;
  users: AppUser[];
  activeUser: AppUser;
  onClose: () => void;
  onApprove: (comment: string) => void;
  onReject: (comment: string) => void;
  onSendBack: (comment: string) => void;
  onDelegate: (toUserId: string, comment: string) => void;
}) => {
  const [comment, setComment] = useState("");
  const [delegateTo, setDelegateTo] = useState<string>("");
  const score = assessmentScore(assessment);
  const rag = ragFromPercent(score);

  // Eligible delegation targets: anyone with an approver-capable role, excluding self & submitter.
  const delegationTargets = users.filter(u =>
    u.id !== activeUser.id &&
    u.id !== submitter?.id &&
    can.approve(u.role)
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review assessment</DialogTitle>
          <DialogDescription>
            Submitted by <strong>{submitter?.name ?? "(unknown)"}</strong> {submitter && `(${ROLE_LABELS[submitter.role]})`}.
          </DialogDescription>
        </DialogHeader>

        <Card className="p-4 bg-muted/30">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="font-semibold text-foreground">{init?.name ?? "(initiative deleted)"}</p>
            <Badge variant="outline" className="text-xs" style={{
              background: `hsl(${RAG_COLORS[rag]} / 0.12)`,
              borderColor: `hsl(${RAG_COLORS[rag]} / 0.4)`,
              color: `hsl(${RAG_COLORS[rag]})`,
            }}>{score}% · {RAG_LABELS[rag]}</Badge>
          </div>
          {assessment.narrative && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Narrative</p>
              <p className="text-xs text-foreground bg-background rounded p-2 border border-border">{assessment.narrative}</p>
            </div>
          )}

          {init && init.kpis.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">KPIs</p>
              <table className="w-full text-[11px]">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left pb-1 font-medium">KPI</th>
                    <th className="text-left pb-1 font-medium">Target</th>
                    <th className="text-left pb-1 font-medium">Actual</th>
                    <th className="text-right pb-1 font-medium">%</th>
                    <th className="text-right pb-1 font-medium">RAG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {init.kpis.map(k => {
                    const ka = assessment.kpiAssessments.find(x => x.kpiId === k.id);
                    const r = ka?.rag ?? (typeof ka?.percentAchievement === "number" ? ragFromPercent(ka.percentAchievement) : undefined);
                    return (
                      <tr key={k.id}>
                        <td className="py-1.5 text-foreground">{k.name}</td>
                        <td className="py-1.5 font-mono">{k.target} {k.unit}</td>
                        <td className="py-1.5 font-mono">{ka?.actual ?? "—"}</td>
                        <td className="py-1.5 text-right font-mono">{ka?.percentAchievement ?? "—"}</td>
                        <td className="py-1.5 text-right">
                          {r ? <span className="inline-block w-2 h-2 rounded-full" style={{ background: `hsl(${RAG_COLORS[r]})` }} /> : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {assessment.evidence.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" /> Evidence ({assessment.evidence.length})
            </p>
            <div className="space-y-1.5">
              {assessment.evidence.map(ev => (
                <div key={ev.id} className="flex items-center gap-2 p-2 border border-border rounded-md bg-card">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{ev.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(ev.size / 1024).toFixed(1)} KB
                      {ev.uploadedBy ? ` · ${ev.uploadedBy}` : ""}
                      {" · "}{new Date(ev.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={ev.dataUrl}
                    download={ev.name}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {assessment.comments.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Previous comments</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {assessment.comments.map(c => (
                <div key={c.id} className="text-[11px] bg-muted/40 rounded p-2">
                  <p className="font-semibold text-foreground">{c.authorName} <span className="text-muted-foreground font-normal">· {c.authorRole}</span></p>
                  <p className="text-muted-foreground mt-0.5">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">Approver remarks <span className="text-muted-foreground">(required for reject / send-back / delegate)</span></Label>
          <Textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Add your comments..." />
        </div>

        {/* Upward delegation — escalate to a more senior approver anywhere in the system */}
        <div className="rounded-md border border-dashed border-border p-3 bg-muted/20">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 inline-flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 rotate-[-90deg]" /> Delegate upward
            <span className="text-[10px] normal-case tracking-normal text-muted-foreground/80 font-normal">
              · escalate to any approver across the system
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Select value={delegateTo} onValueChange={setDelegateTo}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Select an approver to delegate to..." />
              </SelectTrigger>
              <SelectContent>
                {delegationTargets.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No eligible delegates</div>
                ) : delegationTargets.map(u => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">
                    {u.name} <span className="text-muted-foreground">· {ROLE_LABELS[u.role]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={!delegateTo}
              onClick={() => onDelegate(delegateTo, comment)}
            >
              Delegate
            </Button>
          </div>
          {assessment.delegatedToUserId && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Currently delegated to <strong className="text-foreground">{users.find(u => u.id === assessment.delegatedToUserId)?.name ?? "(unknown)"}</strong>.
              Delegating again will reassign.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => onSendBack(comment)}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Send back
          </Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => onReject(comment)}>
            <X className="w-3.5 h-3.5 mr-1.5" /> Reject
          </Button>
          <Button onClick={() => onApprove(comment)}>
            <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
