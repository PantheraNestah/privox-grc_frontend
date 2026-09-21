import { Calendar, Download, MoreHorizontal, Paperclip, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { computeDocumentStatus, formatBytes, type PolicyDocument } from "@/data/documentsStore";
import { ORG_TYPE_LABELS, type OrgNode } from "@/data/orgStore";
import { cn } from "@/lib/utils";
import { ApprovalStatusBadge, CurrencyBadge, DocumentTypeBadge } from "./DocumentBadges";

// Shared by the header row and every data row so columns line up on desktop.
const DESKTOP_COLUMNS = "lg:grid-cols-[minmax(0,2.6fr)_10.5rem_11rem_8.5rem_2rem]";

interface DocumentListProps {
  docs: PolicyDocument[];
  orgNodeMap: ReadonlyMap<string, OrgNode>;
  canManage: boolean;
  onOpen: (doc: PolicyDocument) => void;
  onDelete: (doc: PolicyDocument) => void;
  onDownload: (doc: PolicyDocument) => void;
}

/** One DOM per document: stacked card on phones, aligned columns from `lg`. */
export function DocumentList({ docs, orgNodeMap, canManage, onOpen, onDelete, onDownload }: DocumentListProps) {
  return (
    <Card className="overflow-hidden">
      <div
        className={cn(
          "hidden grid-cols-1 items-center gap-x-4 border-b border-border bg-muted/50 px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid",
          DESKTOP_COLUMNS,
        )}
      >
        <span>Document</span>
        <span>Approval</span>
        <span>Currency</span>
        <span>Review</span>
        <span />
      </div>

      <ul className="divide-y divide-border">
        {docs.map((doc) => {
          const linked = doc.linkedOrgNodeIds
            .map((id) => orgNodeMap.get(id))
            .filter((n): n is OrgNode => !!n);
          const approvedSteps = doc.approvals.filter((s) => s.decision === "approved").length;

          return (
            <li
              key={doc.id}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 px-4 py-4 sm:px-5",
                DESKTOP_COLUMNS,
              )}
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-medium text-navy-deep">{doc.title || "Untitled document"}</p>
                  {doc.attachment && (
                    <span
                      className="inline-flex items-center text-muted-foreground"
                      title={`Attachment: ${doc.attachment.fileName} (${formatBytes(doc.attachment.sizeBytes)})`}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="sr-only">Has attachment</span>
                    </span>
                  )}
                </div>
                {doc.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{doc.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <DocumentTypeBadge type={doc.type} />
                  <span>v{doc.version}</span>
                  {doc.owner && <span>· {doc.owner}</span>}
                </div>
                {linked.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {linked.map((n) => (
                      <span
                        key={n.id}
                        className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-navy-dark"
                      >
                        <span className="uppercase tracking-wide text-muted-foreground">{ORG_TYPE_LABELS[n.type]}</span>
                        {n.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:order-last">
                <DocumentActions
                  doc={doc}
                  canManage={canManage}
                  onOpen={onOpen}
                  onDelete={onDelete}
                  onDownload={onDownload}
                />
              </div>

              <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-2 lg:contents">
                <div className="flex flex-col gap-1">
                  <ApprovalStatusBadge status={doc.approvalStatus} />
                  {doc.approvals.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {approvedSteps}/{doc.approvals.length} steps
                    </span>
                  )}
                </div>
                <CurrencyBadge status={computeDocumentStatus(doc)} />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 lg:hidden" />
                  <span>
                    <span className="lg:hidden">Review </span>
                    {doc.reviewDate || "—"}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function DocumentActions({
  doc,
  canManage,
  onOpen,
  onDelete,
  onDownload,
}: Pick<DocumentListProps, "canManage" | "onOpen" | "onDelete" | "onDownload"> & { doc: PolicyDocument }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${doc.title || "document"}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {canManage && (
          <DropdownMenuItem onSelect={() => onOpen(doc)}>
            <Pencil /> Edit / Approve
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onDownload(doc)}>
          <Download /> Download as text
        </DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              onSelect={() => onDelete(doc)}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
