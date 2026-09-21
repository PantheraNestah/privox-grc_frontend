import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, CheckCircle2, FileEdit, FileText, Link2, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { EmptyState } from "@/components/grc/common/states";
import { DocumentDialog, type DocumentDialogState } from "@/components/grc/documents/DocumentDialog";
import { DocumentFiltersBar } from "@/components/grc/documents/DocumentFilters";
import { DocumentHierarchy } from "@/components/grc/documents/DocumentHierarchy";
import { DocumentList } from "@/components/grc/documents/DocumentList";
import {
  DEFAULT_FILTERS,
  computeUserScopeNodeIds,
  countDocuments,
  decideStep,
  documentFileName,
  documentToText,
  filterDocuments,
  filterVisibleDocuments,
  resetToDraft,
  sendBack,
  submitDocument,
} from "@/components/grc/documents/document-logic";
import { useDocumentStore } from "@/components/grc/documents/useDocumentStore";
import { newDocument, type ApprovalDecision, type PolicyDocument } from "@/data/documentsStore";
import { can } from "@/data/userStore";
import { useActiveUser } from "@/hooks/use-active-user";
import { cn } from "@/lib/utils";

const StatCard = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) => (
  <Card className="p-4">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}>{icon}</span>
    </div>
    <p className="mt-2 text-2xl font-semibold tracking-tight text-navy-deep">{value}</p>
  </Card>
);

function downloadDocument(d: PolicyDocument) {
  const blob = new Blob([documentToText(d)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = documentFileName(d);
  a.click();
  URL.revokeObjectURL(url);
}

const DocumentManagement = () => {
  const activeUser = useActiveUser();
  const canManage = can.manageDocuments(activeUser.role);
  const isGlobalViewer = can.viewAllScopes(activeUser.role);
  const actor = { id: activeUser.id, name: activeUser.name };

  const { docs, orgNodes, persist } = useDocumentStore();
  const [dialog, setDialog] = useState<DocumentDialogState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PolicyDocument | null>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [view, setView] = useState<"list" | "hierarchy">("list");

  const orgNodeMap = useMemo(() => new Map(orgNodes.map((n) => [n.id, n])), [orgNodes]);
  const userScopeNodeIds = useMemo(
    () => computeUserScopeNodeIds(orgNodes, activeUser.orgNodeId),
    [orgNodes, activeUser.orgNodeId],
  );
  const visibleDocs = useMemo(
    () => filterVisibleDocuments(docs, { isGlobalViewer, userOrgNodeId: activeUser.orgNodeId, scope: userScopeNodeIds }),
    [docs, isGlobalViewer, activeUser.orgNodeId, userScopeNodeIds],
  );
  const filtered = useMemo(() => filterDocuments(visibleDocs, filters, orgNodeMap), [visibleDocs, filters, orgNodeMap]);
  const counts = useMemo(() => countDocuments(visibleDocs), [visibleDocs]);

  const startNew = () => setDialog({ doc: newDocument(), isNew: true });
  const open = (doc: PolicyDocument) => setDialog({ doc, isNew: false });

  /** Persist a workflow change and keep the dialog on the updated document. */
  const applyWorkflow = (next: PolicyDocument, message: string) => {
    persist(docs.map((x) => (x.id === next.id ? next : x)));
    setDialog({ doc: next, isNew: false });
    toast.success(message);
  };

  const handleSave = (d: PolicyDocument, isNew: boolean) => {
    if (!d.title.trim()) {
      toast.error("Title required");
      return;
    }
    const stamped: PolicyDocument = {
      ...d,
      updatedAt: new Date().toISOString(),
      createdByUserId: d.createdByUserId ?? activeUser.id,
    };
    persist(isNew ? [...docs, stamped] : docs.map((x) => (x.id === d.id ? stamped : x)));
    setDialog(null);
    toast.success(isNew ? "Document created" : "Document updated");
  };

  const handleDelete = (d: PolicyDocument) => {
    persist(docs.filter((x) => x.id !== d.id));
    setConfirmDelete(null);
    toast.success("Document removed");
  };

  const handleSubmit = (d: PolicyDocument) =>
    applyWorkflow(submitDocument(d, actor), "Document submitted for approval");

  const handleDecide = (d: PolicyDocument, stepId: string, decision: ApprovalDecision, comment?: string) =>
    applyWorkflow(decideStep(d, stepId, decision, actor, comment), `Step ${decision}`);

  const handleResetToDraft = (d: PolicyDocument) =>
    applyWorkflow(resetToDraft(d), "Reset to draft — author can now edit and resubmit.");

  const handleSendBack = (d: PolicyDocument, fromStepId: string, message: string) => {
    if (!message.trim()) {
      toast.error("Add a comment explaining what needs to change.");
      return;
    }
    applyWorkflow(sendBack(d, fromStepId, message, actor), "Sent back to the author for revision.");
  };

  const scopeNote = isGlobalViewer
    ? "You have a global view across all units."
    : activeUser.orgNodeId
      ? "You're seeing documents linked to your organisation unit, its parents and any unit beneath it."
      : "Your profile isn't linked to an organisation unit yet — ask an Administrator to link you so documents become visible.";

  return (
    <>
      <Helmet>
        <title>Document Management · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Repository of policies, standards, procedures and guidelines linked to the risk governance hierarchy."
        />
        <link rel="canonical" href="/governance/documents" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Governance", to: "/governance" }, { label: "Documents" }]}
        title="Document Management"
        description={
          <>
            Central repository for policies, standards, procedures and guidelines, linked to the risk governance
            hierarchy and flagged when due for review.
            <span className="mt-1 block text-xs">{scopeNote}</span>
          </>
        }
        actions={
          canManage && (
            <Button variant="brand" onClick={startNew}>
              <Plus /> New document
            </Button>
          )
        }
      />

      {!canManage && (
        <Alert className="mb-5">
          <Lock className="h-4 w-4" />
          <AlertTitle>Read-only view</AlertTitle>
          <AlertDescription>
            Only Administrators, Risk Managers and Input Users can author or edit documents.
          </AlertDescription>
        </Alert>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<FileText className="h-4 w-4 text-brand-accent" />} tone="bg-brand-accent/10" label="All documents" value={counts.total} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-success" />} tone="bg-success/12" label="Current" value={counts.current} />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-destructive" />} tone="bg-destructive/10" label="Due review" value={counts.expired} />
        <StatCard icon={<FileEdit className="h-4 w-4 text-muted-foreground" />} tone="bg-muted" label="Draft" value={counts.draft} />
      </section>

      <Tabs value={view} onValueChange={(v) => setView(v as "list" | "hierarchy")}>
        <TabsList className="mb-4">
          <TabsTrigger value="list" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> List
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> By hierarchy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-0">
          <DocumentFiltersBar
            filters={filters}
            onChange={setFilters}
            shown={filtered.length}
            total={visibleDocs.length}
          />
          {filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={visibleDocs.length === 0 ? "No documents yet" : "No documents match these filters"}
              description={
                visibleDocs.length === 0
                  ? "Documents linked to your organisation units will appear here."
                  : "Try a different search or clear a filter."
              }
              action={
                canManage && (
                  <Button variant="brand" size="sm" onClick={startNew}>
                    <Plus /> Create one
                  </Button>
                )
              }
            />
          ) : (
            <DocumentList
              docs={filtered}
              orgNodeMap={orgNodeMap}
              canManage={canManage}
              onOpen={open}
              onDelete={setConfirmDelete}
              onDownload={downloadDocument}
            />
          )}
        </TabsContent>

        <TabsContent value="hierarchy" className="mt-0">
          <DocumentHierarchy orgNodes={orgNodes} docs={visibleDocs} onOpen={canManage ? open : undefined} />
        </TabsContent>
      </Tabs>

      <DocumentDialog
        state={dialog}
        orgNodes={orgNodes}
        userRole={activeUser.role}
        userId={activeUser.id}
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
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DocumentManagement;
