import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Plus, Pencil, Trash2, FileText, Search, Filter,
  CheckCircle2, AlertTriangle, FileEdit, Lock, Download, Link2,
  Send, ShieldCheck, Check, X, RotateCcw, Paperclip, Upload, Sparkles,
  GripVertical, BookOpen,
} from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  loadDocuments, saveDocuments, newDocument, computeDocumentStatus,
  DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_COLORS,
  DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS,
  DOC_APPROVAL_STATUS_LABELS, DOC_APPROVAL_STATUS_COLORS,
  buildTwoStepApprovalChain, recomputeDocApprovalStatus,
  applyTemplate, newSection, newAbbreviation, newReference, newRevision,
  readFileAsDataUrl, formatBytes, MAX_ATTACHMENT_BYTES,
  type PolicyDocument, type DocumentType, type DocumentStatus, type DocumentApprovalStatus,
  type ApprovalDecision, type ApprovalRole,
  type DocumentSection, type DocumentAbbreviation, type DocumentReference, type DocumentRevision,
} from "@/data/documentsStore";
import { APPROVAL_DECISION_LABELS, APPROVAL_DECISION_COLORS, APPROVAL_ROLE_LABELS } from "@/data/strategyStore";
import { loadOrgNodes, ORG_TYPE_LABELS, getOrgAncestorChain, type OrgNode, type OrgNodeType } from "@/data/orgStore";
import { useActiveUser } from "@/hooks/use-active-user";
import { can } from "@/data/userStore";

const DOC_TYPES: DocumentType[] = ["policy", "standard", "procedure", "guideline"];
const ORG_LEVEL_FILTERS: OrgNodeType[] = ["group", "company", "department", "division", "section"];

const DocumentManagement = () => {
  const activeUser = useActiveUser();
  const canManage = can.manageDocuments(activeUser.role);
  const isGlobalViewer = can.viewAllScopes(activeUser.role);

  const [docs, setDocs] = useState<PolicyDocument[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [dialog, setDialog] = useState<{ doc: PolicyDocument; isNew: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PolicyDocument | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");
  const [levelFilter, setLevelFilter] = useState<OrgNodeType | "all">("all");
  const [view, setView] = useState<"list" | "hierarchy">("list");

  useEffect(() => {
    setDocs(loadDocuments());
    setOrgNodes(loadOrgNodes());
  }, []);

  const persist = (next: PolicyDocument[]) => {
    setDocs(next);
    saveDocuments(next);
  };

  const orgNodeMap = useMemo(() => new Map(orgNodes.map(n => [n.id, n])), [orgNodes]);

  /** Set of org node ids the active user is "in scope" for: their own node,
   *  every ancestor up to the root, and every descendant beneath them. A document
   *  is visible / actionable if any of its linked org nodes intersects this set. */
  const userScopeNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (!activeUser.orgNodeId) return set;
    // ancestors (incl. self)
    getOrgAncestorChain(orgNodes, activeUser.orgNodeId).forEach(n => set.add(n.id));
    // descendants
    const childrenOf = new Map<string | null, string[]>();
    orgNodes.forEach(n => {
      const arr = childrenOf.get(n.parentId) ?? [];
      arr.push(n.id);
      childrenOf.set(n.parentId, arr);
    });
    const stack = [activeUser.orgNodeId];
    while (stack.length) {
      const cur = stack.pop()!;
      const kids = childrenOf.get(cur) ?? [];
      kids.forEach(k => { if (!set.has(k)) { set.add(k); stack.push(k); } });
    }
    return set;
  }, [orgNodes, activeUser.orgNodeId]);

  // If user has no global view, restrict to documents linked to their org unit,
  // an ancestor of it, or any descendant beneath it.
  const visibleDocs = useMemo(() => {
    if (isGlobalViewer) return docs;
    if (!activeUser.orgNodeId) return [];
    return docs.filter(d => d.linkedOrgNodeIds.some(nid => userScopeNodeIds.has(nid)));
  }, [docs, isGlobalViewer, activeUser.orgNodeId, userScopeNodeIds]);

  const filtered = useMemo(() => {
    return visibleDocs.filter(d => {
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      const status = computeDocumentStatus(d);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (levelFilter !== "all") {
        const matches = d.linkedOrgNodeIds.some(nid => orgNodeMap.get(nid)?.type === levelFilter);
        if (!matches) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!d.title.toLowerCase().includes(q) && !(d.description ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [visibleDocs, typeFilter, statusFilter, levelFilter, search, orgNodeMap]);

  const counts = useMemo(() => {
    const c = { total: visibleDocs.length, current: 0, expired: 0, draft: 0 };
    visibleDocs.forEach(d => {
      const s = computeDocumentStatus(d);
      if (s === "current") c.current++;
      else if (s === "expired") c.expired++;
      else c.draft++;
    });
    return c;
  }, [visibleDocs]);

  const handleSave = (d: PolicyDocument, isNew: boolean) => {
    if (!d.title.trim()) { toast.error("Title required"); return; }
    const stamped: PolicyDocument = {
      ...d,
      updatedAt: new Date().toISOString(),
      createdByUserId: d.createdByUserId ?? activeUser.id,
    };
    const next = isNew ? [...docs, stamped] : docs.map(x => x.id === d.id ? stamped : x);
    persist(next);
    setDialog(null);
    toast.success(isNew ? "Document created" : "Document updated");
  };

  const handleDelete = (d: PolicyDocument) => {
    persist(docs.filter(x => x.id !== d.id));
    setConfirmDelete(null);
    toast.success("Document removed");
  };

  /** Submit a document to start the 2-step approval (Approver → Risk Manager). */
  const handleSubmit = (d: PolicyDocument) => {
    const next: PolicyDocument = {
      ...d,
      approvalStatus: "submitted",
      submittedAt: new Date().toISOString(),
      submittedByUserId: activeUser.id,
      approvals: d.approvals.length > 0 ? d.approvals : buildTwoStepApprovalChain(),
      updatedAt: new Date().toISOString(),
    };
    persist(docs.map(x => x.id === d.id ? next : x));
    setDialog({ doc: next, isNew: false });
    toast.success("Document submitted for approval");
  };

  /** Approver / Risk Manager decision on a step. */
  const handleDecide = (d: PolicyDocument, stepId: string, decision: ApprovalDecision, comment?: string) => {
    const updatedApprovals = d.approvals.map(s => s.id === stepId
      ? { ...s, decision, decidedAt: new Date().toISOString(), approverName: activeUser.name, approverUserId: activeUser.id, comment: comment ?? s.comment }
      : s);
    const draft = { ...d, approvals: updatedApprovals };
    const next: PolicyDocument = {
      ...draft,
      approvalStatus: recomputeDocApprovalStatus(draft),
      updatedAt: new Date().toISOString(),
    };
    persist(docs.map(x => x.id === d.id ? next : x));
    setDialog({ doc: next, isNew: false });
    toast.success(`Step ${decision}`);
  };

  /** Admin / Risk Manager can reset a document back to draft so author can edit. */
  const handleResetToDraft = (d: PolicyDocument) => {
    const next: PolicyDocument = {
      ...d,
      approvalStatus: "draft",
      submittedAt: undefined,
      approvals: d.approvals.map(s => ({
        ...s,
        decision: "pending",
        decidedAt: undefined,
        approverName: undefined,
        approverUserId: undefined,
        comment: undefined,
      })),
      updatedAt: new Date().toISOString(),
    };
    persist(docs.map(x => x.id === d.id ? next : x));
    setDialog({ doc: next, isNew: false });
    toast.success("Reset to draft — author can now edit and resubmit.");
  };

  /** Approver/Risk Manager sends a document back to the author with a mandatory comment.
   *  Workflow restarts: status returns to draft, decisions cleared, the message is preserved on
   *  the returning step so the author can see the requested changes. */
  const handleSendBack = (d: PolicyDocument, fromStepId: string, message: string) => {
    if (!message.trim()) {
      toast.error("Add a comment explaining what needs to change.");
      return;
    }
    const next: PolicyDocument = {
      ...d,
      approvalStatus: "draft",
      submittedAt: undefined,
      approvals: d.approvals.map(s => ({
        ...s,
        decision: "pending",
        decidedAt: undefined,
        approverName: s.id === fromStepId ? activeUser.name : undefined,
        approverUserId: s.id === fromStepId ? activeUser.id : undefined,
        comment: s.id === fromStepId ? `↩ Returned to author: ${message.trim()}` : undefined,
      })),
      updatedAt: new Date().toISOString(),
    };
    persist(docs.map(x => x.id === d.id ? next : x));
    setDialog({ doc: next, isNew: false });
    toast.success("Sent back to the author for revision.");
  };

  return (
    <>
      <Helmet>
        <title>Document Management · Rsolve GRC Platform</title>
        <meta name="description" content="Repository of policies, standards, procedures and guidelines linked to the risk governance hierarchy." />
        <link rel="canonical" href="/governance/documents" />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        <TopNav />

        <main className="flex-1 px-5 md:px-10 py-8 md:py-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/governance" className="hover:text-foreground transition-colors">Governance Management</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Document Management</span>
          </nav>

          <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[25px] font-semibold tracking-tight text-foreground">Document Management</h1>
              <p className="text-[13.5px] text-muted-foreground mt-0.5 max-w-2xl">
                Central repository for policies, standards, procedures and guidelines. Documents are linked to the risk governance hierarchy and flagged when they're due for review.
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {isGlobalViewer
                  ? "You have a global view across all units."
                  : activeUser.orgNodeId
                    ? "You're seeing documents linked to your organisation unit, its parents and any unit beneath it."
                    : "Your profile isn't linked to an organisation unit yet — ask an Administrator to link you so documents become visible."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/governance">
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                </Link>
              </Button>
              {canManage && (
                <Button size="sm" onClick={() => setDialog({ doc: newDocument(), isNew: true })} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-1.5" /> New document
                </Button>
              )}
            </div>
          </header>

          {!canManage && (
            <Card className="p-4 mb-5 border-warn/40 bg-warn/5">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-warn mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Read-only view</p>
                  <p className="text-xs text-muted-foreground">
                    Only Administrators, Risk Managers and Input Users can author or edit documents.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard icon={<FileText className="w-4 h-4" />} label="All documents" value={counts.total} />
            <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Current" value={counts.current} color="158 53% 49%" />
            <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Due review / Expired" value={counts.expired} color="352 70% 61%" />
            <StatCard icon={<FileEdit className="w-4 h-4" />} label="Draft" value={counts.draft} color="215 16% 47%" />
          </div>

          <Tabs value={view} onValueChange={(v) => setView(v as "list" | "hierarchy")} className="mb-3">
            <TabsList>
              <TabsTrigger value="list"><FileText className="w-3.5 h-3.5 mr-1.5" /> List</TabsTrigger>
              <TabsTrigger value="hierarchy"><Link2 className="w-3.5 h-3.5 mr-1.5" /> By hierarchy</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-4">
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Filters</span>
                  <Badge variant="secondary" className="text-[10px]">{filtered.length} of {visibleDocs.length}</Badge>
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title…" className="h-8 pl-7 text-xs w-48" />
                    </div>
                    <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as DocumentType | "all")}>
                      <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DocumentStatus | "all")}>
                      <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="current">{DOCUMENT_STATUS_LABELS.current}</SelectItem>
                        <SelectItem value="expired">{DOCUMENT_STATUS_LABELS.expired}</SelectItem>
                        <SelectItem value="draft">{DOCUMENT_STATUS_LABELS.draft}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as OrgNodeType | "all")}>
                      <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All org levels</SelectItem>
                        {ORG_LEVEL_FILTERS.map(t => <SelectItem key={t} value={t}>{ORG_TYPE_LABELS[t]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">No documents match these filters</p>
                    {canManage && (
                      <Button size="sm" className="mt-3" onClick={() => setDialog({ doc: newDocument(), isNew: true })}>
                        <Plus className="w-4 h-4 mr-1.5" /> Create one
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[1100px]">
                      <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-2 font-semibold">Title</th>
                          <th className="text-left px-4 py-2 font-semibold">Type</th>
                          <th className="text-left px-4 py-2 font-semibold">Version</th>
                          <th className="text-left px-4 py-2 font-semibold">Owner</th>
                          <th className="text-left px-4 py-2 font-semibold">Linked units</th>
                          <th className="text-left px-4 py-2 font-semibold">Effective</th>
                          <th className="text-left px-4 py-2 font-semibold">Next review</th>
                          <th className="text-left px-4 py-2 font-semibold">Approval</th>
                          <th className="text-left px-4 py-2 font-semibold">Currency</th>
                          <th className="text-right px-4 py-2 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(d => {
                          const status = computeDocumentStatus(d);
                          const aStatus = d.approvalStatus;
                          return (
                            <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/20 align-top">
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-foreground inline-flex items-center gap-1.5">
                                  {d.title}
                                  {d.attachment && (
                                    <span title={`Attachment: ${d.attachment.fileName} (${formatBytes(d.attachment.sizeBytes)})`}
                                      className="inline-flex items-center text-[10px] gap-0.5 px-1 py-0.5 rounded bg-primary/10 text-primary">
                                      <Paperclip className="w-2.5 h-2.5" />
                                    </span>
                                  )}
                                </p>
                                {d.description && <p className="text-[11px] text-muted-foreground">{d.description}</p>}
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge variant="outline" className="text-[10px]"
                                  style={{
                                    background: `hsl(${DOCUMENT_TYPE_COLORS[d.type]} / 0.12)`,
                                    borderColor: `hsl(${DOCUMENT_TYPE_COLORS[d.type]} / 0.4)`,
                                    color: `hsl(${DOCUMENT_TYPE_COLORS[d.type]})`,
                                  }}>
                                  {DOCUMENT_TYPE_LABELS[d.type]}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">v{d.version}</td>
                              <td className="px-4 py-2.5 text-xs text-foreground">{d.owner || <span className="text-muted-foreground italic">—</span>}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {d.linkedOrgNodeIds.length === 0 && <span className="text-[11px] text-muted-foreground italic">—</span>}
                                  {d.linkedOrgNodeIds.map(nid => {
                                    const n = orgNodeMap.get(nid);
                                    if (!n) return null;
                                    return (
                                      <span key={nid} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground">
                                        <span className="text-muted-foreground uppercase tracking-wider">{ORG_TYPE_LABELS[n.type]}</span>
                                        {n.name}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{d.effectiveDate || "—"}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{d.reviewDate || "—"}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className="text-[10px] w-fit"
                                    style={{
                                      background: `hsl(${DOC_APPROVAL_STATUS_COLORS[aStatus]} / 0.12)`,
                                      borderColor: `hsl(${DOC_APPROVAL_STATUS_COLORS[aStatus]} / 0.4)`,
                                      color: `hsl(${DOC_APPROVAL_STATUS_COLORS[aStatus]})`,
                                    }}>
                                    <ShieldCheck className="w-3 h-3 mr-1" />
                                    {DOC_APPROVAL_STATUS_LABELS[aStatus]}
                                  </Badge>
                                  {d.approvals.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {d.approvals.filter(s => s.decision === "approved").length}/{d.approvals.length} steps
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge variant="outline" className="text-[10px] gap-1"
                                  style={{
                                    background: `hsl(${DOCUMENT_STATUS_COLORS[status]} / 0.12)`,
                                    borderColor: `hsl(${DOCUMENT_STATUS_COLORS[status]} / 0.4)`,
                                    color: `hsl(${DOCUMENT_STATUS_COLORS[status]})`,
                                  }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${DOCUMENT_STATUS_COLORS[status]})` }} />
                                  {DOCUMENT_STATUS_LABELS[status]}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Download as text"
                                  onClick={() => downloadDocument(d)} aria-label="Download">
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                                {canManage && (
                                  <>
                                    <Button size="icon" variant="ghost" className="h-7 w-7"
                                      onClick={() => setDialog({ doc: d, isNew: false })} aria-label="Edit / Approve">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                      onClick={() => setConfirmDelete(d)} aria-label="Delete">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="hierarchy" className="mt-4">
              <HierarchyView orgNodes={orgNodes} docs={visibleDocs} onEdit={canManage ? (d) => setDialog({ doc: d, isNew: false }) : undefined} />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <DocumentDialog
        state={dialog}
        orgNodes={orgNodes}
        activeUserRole={activeUser.role}
        activeUserId={activeUser.id}
        userScopeNodeIds={userScopeNodeIds}
        isGlobalViewer={isGlobalViewer}
        onClose={() => setDialog(null)}
        onSave={handleSave}
        onSubmit={handleSubmit}
        onDecide={handleDecide}
        onResetToDraft={handleResetToDraft}
        onSendBack={handleSendBack}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{confirmDelete?.title}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color?: string }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
      {color && <span className="w-2 h-2 rounded-full" style={{ background: `hsl(${color})` }} />}
      {icon}<span>{label}</span>
    </div>
    <p className="text-2xl font-semibold text-foreground">{value}</p>
  </Card>
);

// ============= Hierarchy view =============
const HierarchyView = ({ orgNodes, docs, onEdit }: {
  orgNodes: OrgNode[];
  docs: PolicyDocument[];
  onEdit?: (d: PolicyDocument) => void;
}) => {
  // Group documents by linked org node
  const docsByNode = useMemo(() => {
    const map = new Map<string, PolicyDocument[]>();
    docs.forEach(d => {
      d.linkedOrgNodeIds.forEach(nid => {
        const arr = map.get(nid) ?? [];
        arr.push(d);
        map.set(nid, arr);
      });
    });
    return map;
  }, [docs]);

  // Build tree (root nodes first)
  const childrenOf = useMemo(() => {
    const m = new Map<string | null, OrgNode[]>();
    orgNodes.forEach(n => {
      const arr = m.get(n.parentId) ?? [];
      arr.push(n);
      m.set(n.parentId, arr);
    });
    return m;
  }, [orgNodes]);

  const roots = childrenOf.get(null) ?? [];

  if (orgNodes.length === 0) {
    return (
      <Card className="p-10 text-center">
        <Link2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No organisation hierarchy yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Define your org structure in <Link to="/governance/risk-governance" className="text-primary underline">Risk Governance</Link> to link documents.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-1">
      {roots.map(r => <NodeRow key={r.id} node={r} depth={0} childrenOf={childrenOf} docsByNode={docsByNode} onEdit={onEdit} />)}
      {/* Unlinked documents */}
      <UnlinkedSection docs={docs} onEdit={onEdit} />
    </Card>
  );
};

const NodeRow = ({ node, depth, childrenOf, docsByNode, onEdit }: {
  node: OrgNode;
  depth: number;
  childrenOf: Map<string | null, OrgNode[]>;
  docsByNode: Map<string, PolicyDocument[]>;
  onEdit?: (d: PolicyDocument) => void;
}) => {
  const linked = docsByNode.get(node.id) ?? [];
  const kids = childrenOf.get(node.id) ?? [];
  return (
    <div>
      <div className="flex items-start gap-2 py-1.5" style={{ paddingLeft: depth * 18 }}>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16 shrink-0 mt-0.5">{ORG_TYPE_LABELS[node.type]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{node.name}</p>
          {linked.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {linked.map(d => {
                const status = computeDocumentStatus(d);
                return (
                  <button
                    key={d.id}
                    onClick={() => onEdit?.(d)}
                    disabled={!onEdit}
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border hover:bg-muted/50 transition-colors disabled:cursor-default"
                    style={{
                      background: `hsl(${DOCUMENT_TYPE_COLORS[d.type]} / 0.08)`,
                      borderColor: `hsl(${DOCUMENT_TYPE_COLORS[d.type]} / 0.3)`,
                    }}
                    title={`${DOCUMENT_TYPE_LABELS[d.type]} · v${d.version} · ${DOCUMENT_STATUS_LABELS[status]}`}
                  >
                    <span className="uppercase tracking-wider text-muted-foreground">{DOCUMENT_TYPE_LABELS[d.type]}</span>
                    <span className="text-foreground">{d.title}</span>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${DOCUMENT_STATUS_COLORS[status]})` }} />
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">No documents linked</span>
          )}
        </div>
      </div>
      {kids.map(k => <NodeRow key={k.id} node={k} depth={depth + 1} childrenOf={childrenOf} docsByNode={docsByNode} onEdit={onEdit} />)}
    </div>
  );
};

const UnlinkedSection = ({ docs, onEdit }: { docs: PolicyDocument[]; onEdit?: (d: PolicyDocument) => void }) => {
  const unlinked = docs.filter(d => d.linkedOrgNodeIds.length === 0);
  if (unlinked.length === 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Unlinked documents</p>
      <div className="flex flex-wrap gap-1">
        {unlinked.map(d => {
          const status = computeDocumentStatus(d);
          return (
            <button key={d.id} onClick={() => onEdit?.(d)} disabled={!onEdit}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-muted/40 hover:bg-muted/70">
              <span className="uppercase tracking-wider text-muted-foreground">{DOCUMENT_TYPE_LABELS[d.type]}</span>
              <span className="text-foreground">{d.title}</span>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${DOCUMENT_STATUS_COLORS[status]})` }} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============= Document dialog =============
const DocumentDialog = ({
  state, orgNodes, activeUserRole, activeUserId, userScopeNodeIds, isGlobalViewer,
  onClose, onSave, onSubmit, onDecide, onResetToDraft, onSendBack,
}: {
  state: { doc: PolicyDocument; isNew: boolean } | null;
  orgNodes: OrgNode[];
  activeUserRole: import("@/data/userStore").UserRole;
  activeUserId: string;
  userScopeNodeIds: Set<string>;
  isGlobalViewer: boolean;
  onClose: () => void;
  onSave: (d: PolicyDocument, isNew: boolean) => void;
  onSubmit: (d: PolicyDocument) => void;
  onDecide: (d: PolicyDocument, stepId: string, decision: ApprovalDecision, comment?: string) => void;
  onResetToDraft: (d: PolicyDocument) => void;
  onSendBack: (d: PolicyDocument, stepId: string, message: string) => void;
}) => {
  const [draft, setDraft] = useState<PolicyDocument | null>(null);
  useEffect(() => { setDraft(state?.doc ?? null); }, [state]);
  if (!draft || !state) return null;

  const aStatus = draft.approvalStatus;
  const isAuthor = !draft.createdByUserId || draft.createdByUserId === activeUserId;

  /** Whether the active user's org scope intersects the doc's linked units.
   *  Admin / Risk Manager / Executive (global viewers) always pass; others must
   *  belong to a unit that is the same as, an ancestor of, or a descendant of a linked unit. */
  const inDocScope = isGlobalViewer
    || draft.linkedOrgNodeIds.length === 0  // unlinked drafts visible to authors
    || draft.linkedOrgNodeIds.some(nid => userScopeNodeIds.has(nid));

  // Editable while in draft or rejected (so author can revise & resubmit).
  const canEditFields = (aStatus === "draft" || aStatus === "rejected") && can.manageDocuments(activeUserRole);
  const canSubmit = (aStatus === "draft" || aStatus === "rejected") && can.manageDocuments(activeUserRole) && !state.isNew;
  const canResetWorkflow = can.resetWorkflow(activeUserRole) && (aStatus === "submitted" || aStatus === "approved" || aStatus === "rejected");

  const toggleLink = (id: string) => {
    setDraft(d => d ? {
      ...d,
      linkedOrgNodeIds: d.linkedOrgNodeIds.includes(id)
        ? d.linkedOrgNodeIds.filter(x => x !== id)
        : [...d.linkedOrgNodeIds, id],
    } : d);
  };

  // Sequential approval: step decidable only when previous steps approved AND
  // the user belongs to the document's org scope (or is a global admin).
  const canDecideStep = (idx: number, role: ApprovalRole): boolean => {
    if (!inDocScope) return false;
    if (activeUserRole === "admin") {
      // admins can decide any pending step provided previous steps are approved
    } else if (activeUserRole !== role) {
      return false;
    }
    for (let i = 0; i < idx; i++) {
      if (draft.approvals[i]?.decision !== "approved") return false;
    }
    return draft.approvals[idx]?.decision === "pending";
  };

  // Apply template — wipes current sections; we wrap in a confirm if there's user content.
  const handleApplyTemplate = (type: DocumentType) => {
    const hasUserContent = draft.sections.some(s => s.body.trim().length > 0);
    if (hasUserContent && !confirm("Replace the current body with the standard template? Your edits to existing sections will be lost.")) return;
    setDraft(d => d ? applyTemplate(d, type) : d);
    toast.success(`${DOCUMENT_TYPE_LABELS[type]} template applied`);
  };

  const handleAttach = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setDraft(d => d ? {
        ...d,
        attachment: {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          dataUrl,
          uploadedAt: new Date().toISOString(),
          uploadedByUserId: activeUserId,
        },
      } : d);
      toast.success(`Attached ${file.name}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {state.isNew ? "Create document" : "Edit document"}
            <Badge variant="outline" className="text-[10px]"
              style={{
                background: `hsl(${DOCUMENT_TYPE_COLORS[draft.type]} / 0.12)`,
                borderColor: `hsl(${DOCUMENT_TYPE_COLORS[draft.type]} / 0.4)`,
                color: `hsl(${DOCUMENT_TYPE_COLORS[draft.type]})`,
              }}>
              {DOCUMENT_TYPE_LABELS[draft.type]}
            </Badge>
          </DialogTitle>
          <DialogDescription>Use the tabs below to structure your {DOCUMENT_TYPE_LABELS[draft.type].toLowerCase()} like a real governance document, attach the source file, and route it through Approver → Risk Manager.</DialogDescription>
        </DialogHeader>

        {!state.isNew && (
          <div className="flex items-center gap-2 -mt-1 mb-1 flex-wrap">
            <Badge variant="outline" className="text-[10px]"
              style={{
                background: `hsl(${DOC_APPROVAL_STATUS_COLORS[aStatus]} / 0.12)`,
                borderColor: `hsl(${DOC_APPROVAL_STATUS_COLORS[aStatus]} / 0.4)`,
                color: `hsl(${DOC_APPROVAL_STATUS_COLORS[aStatus]})`,
              }}>
              <ShieldCheck className="w-3 h-3 mr-1" />
              {DOC_APPROVAL_STATUS_LABELS[aStatus]}
            </Badge>
            {!canEditFields && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="w-3 h-3" />
                {aStatus === "submitted" ? "In approval — read-only until decided." :
                 aStatus === "approved" ? "Approved — locked. Reset to draft to edit." : ""}
              </span>
            )}
          </div>
        )}

        {!state.isNew && !inDocScope && aStatus === "submitted" && (
          <div className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-[11px] text-foreground flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-warn mt-0.5 shrink-0" />
            <span>You can view this document, but only Approvers and the Risk Manager linked to its organisation unit (or its parents/children) can take a decision.</span>
          </div>
        )}

        <Tabs defaultValue="metadata" className="mt-2">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="metadata" className="text-xs"><FileEdit className="w-3 h-3 mr-1" /> Metadata</TabsTrigger>
            <TabsTrigger value="body" className="text-xs"><BookOpen className="w-3 h-3 mr-1" /> Body & TOC</TabsTrigger>
            <TabsTrigger value="terms" className="text-xs"><FileText className="w-3 h-3 mr-1" /> Terms & Refs</TabsTrigger>
            <TabsTrigger value="attachment" className="text-xs"><Paperclip className="w-3 h-3 mr-1" /> Attachment</TabsTrigger>
            <TabsTrigger value="approval" className="text-xs"><ShieldCheck className="w-3 h-3 mr-1" /> Approval</TabsTrigger>
          </TabsList>

          {/* === Metadata tab === */}
          <TabsContent value="metadata" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="d-title">Document title (policy name) *</Label>
                <Input id="d-title" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Information Security Policy" disabled={!canEditFields} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-type">Type *</Label>
                <Select value={draft.type} onValueChange={(v) => canEditFields && handleApplyTemplate(v as DocumentType)} disabled={!canEditFields}>
                  <SelectTrigger id="d-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Changing type re-applies the standard template.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-version">Version</Label>
                <Input id="d-version" value={draft.version} onChange={e => setDraft({ ...draft, version: e.target.value })} placeholder="1.0" disabled={!canEditFields} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-effective">Effective date</Label>
                <Input id="d-effective" type="date" value={draft.effectiveDate ?? ""} onChange={e => setDraft({ ...draft, effectiveDate: e.target.value })} disabled={!canEditFields} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-review">Next review date</Label>
                <Input id="d-review" type="date" value={draft.reviewDate ?? ""} onChange={e => setDraft({ ...draft, reviewDate: e.target.value })} disabled={!canEditFields} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="d-owner">Owner</Label>
                <Input id="d-owner" value={draft.owner ?? ""} onChange={e => setDraft({ ...draft, owner: e.target.value })} placeholder="e.g. CISO" disabled={!canEditFields} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="d-desc">Description / abstract</Label>
                <Textarea id="d-desc" rows={2} value={draft.description ?? ""} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="One-line summary of what this document covers." disabled={!canEditFields} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Linked organisation units</Label>
              <p className="text-[11px] text-muted-foreground">Pick the parts of the org tree this document applies to.</p>
              {orgNodes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic border border-dashed border-border rounded p-3">
                  No org structure defined. Add units in <Link to="/governance/risk-governance" className="underline">Risk Governance</Link> first.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                  {orgNodes.map(n => (
                    <label key={n.id} className="flex items-center gap-2 text-xs px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={draft.linkedOrgNodeIds.includes(n.id)} onCheckedChange={() => toggleLink(n.id)} disabled={!canEditFields} />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{ORG_TYPE_LABELS[n.type]}</span>
                      <span className="text-foreground">{n.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* === Body & Table of Contents === */}
          <TabsContent value="body" className="space-y-3 mt-3">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" /> Table of Contents
                </p>
                {canEditFields && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => handleApplyTemplate(draft.type)}>
                    <Sparkles className="w-3 h-3 mr-1" /> Reapply template
                  </Button>
                )}
              </div>
              {draft.sections.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No sections yet. Apply the template above or add sections manually below.</p>
              ) : (
                <ol className="text-xs text-foreground space-y-0.5 list-none">
                  {draft.sections.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className="text-muted-foreground tabular-nums w-6">{i + 1}.</span>
                      <span className="truncate">{s.heading || <em className="text-muted-foreground">Untitled section</em>}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="space-y-2">
              {draft.sections.map((s, idx) => (
                <div key={s.id} className="border border-border rounded-md p-2.5 bg-background space-y-1.5">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <Input
                      value={s.heading}
                      onChange={e => setDraft(d => d ? { ...d, sections: d.sections.map(x => x.id === s.id ? { ...x, heading: e.target.value } : x) } : d)}
                      placeholder={`Section ${idx + 1} heading`}
                      className="h-8 text-sm font-medium"
                      disabled={!canEditFields}
                    />
                    {canEditFields && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0}
                          onClick={() => setDraft(d => {
                            if (!d) return d;
                            const arr = [...d.sections];
                            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                            return { ...d, sections: arr };
                          })}
                          title="Move up">↑</Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === draft.sections.length - 1}
                          onClick={() => setDraft(d => {
                            if (!d) return d;
                            const arr = [...d.sections];
                            [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
                            return { ...d, sections: arr };
                          })}
                          title="Move down">↓</Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                          onClick={() => setDraft(d => d ? { ...d, sections: d.sections.filter(x => x.id !== s.id) } : d)}
                          title="Remove section">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                  <Textarea
                    value={s.body}
                    rows={4}
                    onChange={e => setDraft(d => d ? { ...d, sections: d.sections.map(x => x.id === s.id ? { ...x, body: e.target.value } : x) } : d)}
                    placeholder="Section content…"
                    disabled={!canEditFields}
                  />
                </div>
              ))}
              {canEditFields && (
                <Button size="sm" variant="outline" className="text-xs"
                  onClick={() => setDraft(d => d ? { ...d, sections: [...d.sections, newSection(`${d.sections.length + 1}. New section`)] } : d)}>
                  <Plus className="w-3 h-3 mr-1" /> Add section
                </Button>
              )}
            </div>
          </TabsContent>

          {/* === Abbreviations / References / Revision history === */}
          <TabsContent value="terms" className="space-y-4 mt-3">
            {/* Abbreviations */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Abbreviations & defined terms</Label>
                {canEditFields && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setDraft(d => d ? { ...d, abbreviations: [...d.abbreviations, newAbbreviation()] } : d)}>
                    <Plus className="w-3 h-3 mr-1" /> Add term
                  </Button>
                )}
              </div>
              {draft.abbreviations.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No defined terms yet.</p>
              ) : (
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-2 py-1.5 w-1/4">Term</th>
                        <th className="text-left px-2 py-1.5">Definition</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.abbreviations.map(a => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-2 py-1">
                            <Input value={a.term} onChange={e => setDraft(d => d ? { ...d, abbreviations: d.abbreviations.map(x => x.id === a.id ? { ...x, term: e.target.value } : x) } : d)} placeholder="e.g. ISMS" className="h-7 text-xs" disabled={!canEditFields} />
                          </td>
                          <td className="px-2 py-1">
                            <Input value={a.meaning} onChange={e => setDraft(d => d ? { ...d, abbreviations: d.abbreviations.map(x => x.id === a.id ? { ...x, meaning: e.target.value } : x) } : d)} placeholder="Information Security Management System" className="h-7 text-xs" disabled={!canEditFields} />
                          </td>
                          <td className="px-1">
                            {canEditFields && (
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                                onClick={() => setDraft(d => d ? { ...d, abbreviations: d.abbreviations.filter(x => x.id !== a.id) } : d)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* References */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>References & related documents</Label>
                {canEditFields && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setDraft(d => d ? { ...d, references: [...d.references, newReference()] } : d)}>
                    <Plus className="w-3 h-3 mr-1" /> Add reference
                  </Button>
                )}
              </div>
              {draft.references.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No references yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {draft.references.map(r => (
                    <div key={r.id} className="grid grid-cols-12 gap-1.5 items-center">
                      <Input className="col-span-4 h-7 text-xs" placeholder="Label (e.g. ISO 27001)" value={r.label} onChange={e => setDraft(d => d ? { ...d, references: d.references.map(x => x.id === r.id ? { ...x, label: e.target.value } : x) } : d)} disabled={!canEditFields} />
                      <Input className="col-span-4 h-7 text-xs" placeholder="Source / clause" value={r.source ?? ""} onChange={e => setDraft(d => d ? { ...d, references: d.references.map(x => x.id === r.id ? { ...x, source: e.target.value } : x) } : d)} disabled={!canEditFields} />
                      <Input className="col-span-3 h-7 text-xs" placeholder="https://…" value={r.url ?? ""} onChange={e => setDraft(d => d ? { ...d, references: d.references.map(x => x.id === r.id ? { ...x, url: e.target.value } : x) } : d)} disabled={!canEditFields} />
                      <div className="col-span-1 flex justify-end">
                        {canEditFields && (
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                            onClick={() => setDraft(d => d ? { ...d, references: d.references.filter(x => x.id !== r.id) } : d)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Revision history */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Revision history</Label>
                {canEditFields && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setDraft(d => d ? { ...d, revisionHistory: [...d.revisionHistory, newRevision(d.version, d.owner ?? "Author")] } : d)}>
                    <Plus className="w-3 h-3 mr-1" /> Add entry
                  </Button>
                )}
              </div>
              {draft.revisionHistory.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No version history recorded yet.</p>
              ) : (
                <div className="border border-border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="text-left px-2 py-1.5">Version</th>
                        <th className="text-left px-2 py-1.5">Date</th>
                        <th className="text-left px-2 py-1.5">Author</th>
                        <th className="text-left px-2 py-1.5">Summary of changes</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.revisionHistory.map(r => (
                        <tr key={r.id} className="border-t border-border">
                          <td className="px-2 py-1"><Input value={r.version} onChange={e => setDraft(d => d ? { ...d, revisionHistory: d.revisionHistory.map(x => x.id === r.id ? { ...x, version: e.target.value } : x) } : d)} className="h-7 text-xs w-20" disabled={!canEditFields} /></td>
                          <td className="px-2 py-1"><Input type="date" value={r.date} onChange={e => setDraft(d => d ? { ...d, revisionHistory: d.revisionHistory.map(x => x.id === r.id ? { ...x, date: e.target.value } : x) } : d)} className="h-7 text-xs w-36" disabled={!canEditFields} /></td>
                          <td className="px-2 py-1"><Input value={r.author} onChange={e => setDraft(d => d ? { ...d, revisionHistory: d.revisionHistory.map(x => x.id === r.id ? { ...x, author: e.target.value } : x) } : d)} className="h-7 text-xs" disabled={!canEditFields} /></td>
                          <td className="px-2 py-1"><Input value={r.summary} onChange={e => setDraft(d => d ? { ...d, revisionHistory: d.revisionHistory.map(x => x.id === r.id ? { ...x, summary: e.target.value } : x) } : d)} className="h-7 text-xs" disabled={!canEditFields} /></td>
                          <td className="px-1">
                            {canEditFields && (
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                                onClick={() => setDraft(d => d ? { ...d, revisionHistory: d.revisionHistory.filter(x => x.id !== r.id) } : d)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* === Attachment === */}
          <TabsContent value="attachment" className="space-y-3 mt-3">
            <div className="rounded-md border border-border p-4 bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5 mb-1">
                <Paperclip className="w-3.5 h-3.5" /> Source file
              </p>
              <p className="text-[12px] text-muted-foreground mb-3">
                Attach the authoritative source file (PDF, Word, Excel, etc.) for this document instead of (or in addition to) authoring it inline. Max {(MAX_ATTACHMENT_BYTES / 1024 / 1024).toFixed(1)} MB.
              </p>

              {draft.attachment ? (
                <div className="border border-border rounded-md p-3 bg-background flex items-center gap-3 flex-wrap">
                  <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{draft.attachment.fileName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {draft.attachment.mimeType || "file"} · {formatBytes(draft.attachment.sizeBytes)} · uploaded {new Date(draft.attachment.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={draft.attachment.dataUrl} download={draft.attachment.fileName}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted/60">
                      <Download className="w-3 h-3" /> Download
                    </a>
                    {canEditFields && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                        onClick={() => setDraft(d => d ? { ...d, attachment: undefined } : d)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground italic">No file attached.</p>
              )}

              {canEditFields && (
                <div className="mt-3">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border cursor-pointer hover:bg-muted/40 text-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{draft.attachment ? "Replace file" : "Choose a file to upload"}</span>
                    <input
                      type="file"
                      className="sr-only"
                      onChange={e => { handleAttach(e.target.files?.[0]); e.currentTarget.value = ""; }}
                    />
                  </label>
                </div>
              )}
            </div>
          </TabsContent>

          {/* === Approval workflow === */}
          <TabsContent value="approval" className="mt-3">
            {state.isNew ? (
              <p className="text-xs text-muted-foreground italic p-3">Save the document first, then submit it for approval.</p>
            ) : (
              <div className="border border-border rounded-md p-3 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Approval workflow (Approver → Risk Manager)
                  </p>
                  <div className="flex items-center gap-1">
                    {canResetWorkflow && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onResetToDraft(draft)}>
                        Reset to draft
                      </Button>
                    )}
                    {canSubmit && (
                      <Button size="sm" className="h-7 px-2 text-xs bg-primary hover:bg-primary/90" onClick={() => onSubmit(draft)}>
                        <Send className="w-3 h-3 mr-1" /> Submit for approval
                      </Button>
                    )}
                  </div>
                </div>
                {draft.approvals.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">Submit this document to start the 2-step approval chain.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {draft.approvals.map((s, idx) => {
                      const allowed = canDecideStep(idx, s.role);
                      return (
                        <li key={s.id} className="bg-background p-2 rounded border border-border">
                          <div className="grid grid-cols-12 gap-2 items-center">
                            <span className="col-span-1 w-6 h-6 rounded-full bg-muted text-[11px] font-semibold flex items-center justify-center text-foreground">{idx + 1}</span>
                            <div className="col-span-3 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate inline-flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-muted-foreground" />
                                {APPROVAL_ROLE_LABELS[s.role]}
                              </p>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{idx === 0 ? "First level" : "Final level"}</p>
                            </div>
                            <div className="col-span-3 text-xs text-muted-foreground truncate">
                              {s.approverName ? <span className="text-foreground">{s.approverName}</span> : <em>Awaiting decision</em>}
                              {s.decidedAt && <p className="text-[10px]">{new Date(s.decidedAt).toLocaleString()}</p>}
                            </div>
                            <div className="col-span-3 text-[11px] text-muted-foreground truncate" title={s.comment}>{s.comment || ""}</div>
                            <div className="col-span-2 flex items-center gap-1 justify-end">
                              <Badge variant="outline" className="text-[10px]"
                                style={{
                                  background: `hsl(${APPROVAL_DECISION_COLORS[s.decision]} / 0.12)`,
                                  borderColor: `hsl(${APPROVAL_DECISION_COLORS[s.decision]} / 0.4)`,
                                  color: `hsl(${APPROVAL_DECISION_COLORS[s.decision]})`,
                                }}>
                                {APPROVAL_DECISION_LABELS[s.decision]}
                              </Badge>
                              {allowed && (
                                <>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-[hsl(158_53%_49%)]"
                                    onClick={() => onDecide(draft, s.id, "approved")} aria-label="Approve" title="Approve">
                                    <Check className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-[hsl(34_89%_50%)]"
                                    onClick={() => onSendBack(draft, s.id, s.comment ?? "")} aria-label="Send back to author" title="Send back to author (comment required)">
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                    onClick={() => onDecide(draft, s.id, "rejected")} aria-label="Reject" title="Reject">
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {allowed && (
                            <div className="mt-1.5 space-y-1">
                              <Input
                                className="h-7 text-xs"
                                placeholder="Comment (required when sending back, optional otherwise)…"
                                value={s.comment ?? ""}
                                onChange={(e) => setDraft(d => d ? {
                                  ...d,
                                  approvals: d.approvals.map(x => x.id === s.id ? { ...x, comment: e.target.value } : x),
                                } : d)}
                              />
                              <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                                <RotateCcw className="w-2.5 h-2.5" /> Use <strong>Send back</strong> to return the document to the author for revision.
                              </p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {canEditFields && (
            <Button onClick={() => onSave(draft, state.isNew)} className="bg-primary hover:bg-primary/90">Save</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Build a printable .txt rendering of the structured document. */
function downloadDocument(d: PolicyDocument) {
  const lines: string[] = [];
  lines.push(d.title || "Untitled document");
  lines.push("=".repeat(Math.max(20, (d.title || "Untitled document").length)));
  lines.push(`${DOCUMENT_TYPE_LABELS[d.type]} · v${d.version}`);
  if (d.owner) lines.push(`Owner: ${d.owner}`);
  if (d.effectiveDate) lines.push(`Effective: ${d.effectiveDate}`);
  if (d.reviewDate) lines.push(`Next review: ${d.reviewDate}`);
  lines.push("");
  if (d.description) {
    lines.push("ABSTRACT");
    lines.push(d.description);
    lines.push("");
  }
  if (d.sections.length > 0) {
    lines.push("TABLE OF CONTENTS");
    d.sections.forEach((s, i) => lines.push(`  ${i + 1}. ${s.heading}`));
    lines.push("");
  }
  if (d.abbreviations.length > 0) {
    lines.push("ABBREVIATIONS & DEFINED TERMS");
    d.abbreviations.forEach(a => lines.push(`  ${a.term.padEnd(12)} ${a.meaning}`));
    lines.push("");
  }
  d.sections.forEach(s => {
    lines.push(s.heading);
    lines.push("-".repeat(Math.max(8, s.heading.length)));
    lines.push(s.body || "");
    lines.push("");
  });
  if (d.references.length > 0) {
    lines.push("REFERENCES");
    d.references.forEach(r => lines.push(`  • ${r.label}${r.source ? ` — ${r.source}` : ""}${r.url ? ` (${r.url})` : ""}`));
    lines.push("");
  }
  if (d.revisionHistory.length > 0) {
    lines.push("REVISION HISTORY");
    d.revisionHistory.forEach(r => lines.push(`  v${r.version} · ${r.date} · ${r.author} — ${r.summary}`));
    lines.push("");
  }
  // Legacy free-form content (only if no structured sections were authored).
  if (d.sections.length === 0 && d.content) {
    lines.push(d.content);
  }

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(d.title || "document").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default DocumentManagement;
