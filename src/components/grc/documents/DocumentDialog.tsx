import { useEffect, useState } from "react";
import { BookOpen, FileEdit, FileText, Lock, Paperclip, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DOCUMENT_TYPE_LABELS,
  applyTemplate,
  type ApprovalDecision,
  type DocumentType,
  type PolicyDocument,
} from "@/data/documentsStore";
import type { OrgNode } from "@/data/orgStore";
import { can, type UserRole } from "@/data/userStore";
import { ApprovalStatusBadge, DocumentTypeBadge } from "./DocumentBadges";
import { DocumentApprovalTab } from "./DocumentApprovalTab";
import { DocumentAttachmentTab } from "./DocumentAttachmentTab";
import { DocumentBodyTab } from "./DocumentBodyTab";
import { DocumentMetadataTab } from "./DocumentMetadataTab";
import { DocumentTermsTab } from "./DocumentTermsTab";
import { isDocumentInScope } from "./document-logic";

export interface DocumentDialogState {
  doc: PolicyDocument;
  isNew: boolean;
}

interface DocumentDialogProps {
  state: DocumentDialogState | null;
  orgNodes: OrgNode[];
  userRole: UserRole;
  userId: string;
  userScopeNodeIds: ReadonlySet<string>;
  isGlobalViewer: boolean;
  onClose: () => void;
  onSave: (d: PolicyDocument, isNew: boolean) => void;
  onSubmit: (d: PolicyDocument) => void;
  onDecide: (d: PolicyDocument, stepId: string, decision: ApprovalDecision, comment?: string) => void;
  onResetToDraft: (d: PolicyDocument) => void;
  onSendBack: (d: PolicyDocument, stepId: string, message: string) => void;
}

export function DocumentDialog({
  state,
  orgNodes,
  userRole,
  userId,
  userScopeNodeIds,
  isGlobalViewer,
  onClose,
  onSave,
  onSubmit,
  onDecide,
  onResetToDraft,
  onSendBack,
}: DocumentDialogProps) {
  const [draft, setDraft] = useState<PolicyDocument | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<DocumentType | null>(null);

  useEffect(() => {
    setDraft(state?.doc ?? null);
  }, [state]);

  if (!draft || !state) return null;

  const status = draft.approvalStatus;
  const patch = (update: (d: PolicyDocument) => PolicyDocument) => setDraft((d) => (d ? update(d) : d));

  // Editable while in draft or rejected so the author can revise and resubmit.
  const editableStatus = status === "draft" || status === "rejected";
  const canEdit = editableStatus && can.manageDocuments(userRole);
  const canSubmit = canEdit && !state.isNew;
  const canReset = can.resetWorkflow(userRole) && (status === "submitted" || status === "approved" || status === "rejected");
  const inDocScope = isDocumentInScope(draft, isGlobalViewer, userScopeNodeIds);

  const applyNow = (type: DocumentType) => {
    setDraft((d) => (d ? applyTemplate(d, type) : d));
    toast.success(`${DOCUMENT_TYPE_LABELS[type]} template applied`);
  };

  // Replacing the body discards edits, so confirm only when there is content to lose.
  const requestTemplate = (type: DocumentType) => {
    if (draft.sections.some((s) => s.body.trim().length > 0)) setPendingTemplate(type);
    else applyNow(type);
  };

  const tabProps = { draft, patch, canEdit };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {state.isNew ? "Create document" : "Edit document"}
              <DocumentTypeBadge type={draft.type} />
              {!state.isNew && <ApprovalStatusBadge status={status} />}
            </DialogTitle>
            <DialogDescription>
              Structure your {DOCUMENT_TYPE_LABELS[draft.type].toLowerCase()} like a governance document, attach the
              source file, and route it through Approver → Risk Manager.
            </DialogDescription>
          </DialogHeader>

          {!state.isNew && !canEdit && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              {status === "submitted"
                ? "In approval — read-only until decided."
                : status === "approved"
                  ? "Approved — locked. Reset to draft to edit."
                  : "You don't have permission to edit this document."}
            </p>
          )}

          {!state.isNew && !inDocScope && status === "submitted" && (
            <Alert className="border-warn/40 bg-warn/5">
              <Lock className="h-4 w-4 text-warn" />
              <AlertDescription className="text-xs">
                You can view this document, but only Approvers and the Risk Manager linked to its organisation unit (or
                its parents/children) can take a decision.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="metadata">
            <TabsList className="h-auto w-full justify-start">
              <TabsTrigger value="metadata" className="gap-1.5 text-xs">
                <FileEdit className="h-3.5 w-3.5" /> Metadata
              </TabsTrigger>
              <TabsTrigger value="body" className="gap-1.5 text-xs">
                <BookOpen className="h-3.5 w-3.5" /> Body & TOC
              </TabsTrigger>
              <TabsTrigger value="terms" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> Terms & Refs
              </TabsTrigger>
              <TabsTrigger value="attachment" className="gap-1.5 text-xs">
                <Paperclip className="h-3.5 w-3.5" /> Attachment
              </TabsTrigger>
              <TabsTrigger value="approval" className="gap-1.5 text-xs">
                <ShieldCheck className="h-3.5 w-3.5" /> Approval
              </TabsTrigger>
            </TabsList>

            <TabsContent value="metadata" className="mt-4">
              <DocumentMetadataTab {...tabProps} orgNodes={orgNodes} onRequestTemplate={requestTemplate} />
            </TabsContent>
            <TabsContent value="body" className="mt-4">
              <DocumentBodyTab {...tabProps} onRequestTemplate={requestTemplate} />
            </TabsContent>
            <TabsContent value="terms" className="mt-4">
              <DocumentTermsTab {...tabProps} />
            </TabsContent>
            <TabsContent value="attachment" className="mt-4">
              <DocumentAttachmentTab {...tabProps} userId={userId} />
            </TabsContent>
            <TabsContent value="approval" className="mt-4">
              <DocumentApprovalTab
                {...tabProps}
                isNew={state.isNew}
                userRole={userRole}
                inDocScope={inDocScope}
                canSubmit={canSubmit}
                canReset={canReset}
                onSubmit={onSubmit}
                onDecide={onDecide}
                onResetToDraft={onResetToDraft}
                onSendBack={onSendBack}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {canEdit && (
              <Button variant="brand" onClick={() => onSave(draft, state.isNew)}>
                Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingTemplate} onOpenChange={(open) => !open && setPendingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the current body?</AlertDialogTitle>
            <AlertDialogDescription>
              Applying the {pendingTemplate ? DOCUMENT_TYPE_LABELS[pendingTemplate].toLowerCase() : ""} template
              replaces your sections. Edits to existing sections will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my edits</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (pendingTemplate) applyNow(pendingTemplate);
                setPendingTemplate(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
