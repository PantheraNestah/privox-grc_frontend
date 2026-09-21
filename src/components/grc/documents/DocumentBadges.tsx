import { type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DOCUMENT_STATUS_COLORS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_COLORS,
  DOCUMENT_TYPE_LABELS,
  DOC_APPROVAL_STATUS_COLORS,
  DOC_APPROVAL_STATUS_LABELS,
  type DocumentApprovalStatus,
  type DocumentStatus,
  type DocumentType,
} from "@/data/documentsStore";
import { cn } from "@/lib/utils";

/** Soft tinted badge driven by an "H S% L%" colour from the data store. */
export function ToneBadge({
  color,
  className,
  children,
}: {
  color: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("w-fit gap-1.5 whitespace-nowrap text-[11px] font-medium", className)}
      style={{
        background: `hsl(${color} / 0.1)`,
        borderColor: `hsl(${color} / 0.3)`,
        color: `hsl(${color})`,
      }}
    >
      {children}
    </Badge>
  );
}

export const DocumentTypeBadge = ({ type }: { type: DocumentType }) => (
  <ToneBadge color={DOCUMENT_TYPE_COLORS[type]}>{DOCUMENT_TYPE_LABELS[type]}</ToneBadge>
);

export const ApprovalStatusBadge = ({ status }: { status: DocumentApprovalStatus }) => (
  <ToneBadge color={DOC_APPROVAL_STATUS_COLORS[status]}>
    <ShieldCheck className="h-3 w-3" />
    {DOC_APPROVAL_STATUS_LABELS[status]}
  </ToneBadge>
);

export const CurrencyBadge = ({ status }: { status: DocumentStatus }) => (
  <ToneBadge color={DOCUMENT_STATUS_COLORS[status]}>
    <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${DOCUMENT_STATUS_COLORS[status]})` }} />
    {DOCUMENT_STATUS_LABELS[status]}
  </ToneBadge>
);
