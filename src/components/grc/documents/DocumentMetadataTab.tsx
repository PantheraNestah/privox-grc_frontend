import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_TYPE_LABELS, type DocumentType, type PolicyDocument } from "@/data/documentsStore";
import { ORG_TYPE_LABELS, type OrgNode } from "@/data/orgStore";
import { DOC_TYPES, type DocumentTabProps } from "./document-logic";

interface DocumentMetadataTabProps extends DocumentTabProps {
  orgNodes: OrgNode[];
  onRequestTemplate: (type: DocumentType) => void;
}

export function DocumentMetadataTab({ draft, patch, canEdit, orgNodes, onRequestTemplate }: DocumentMetadataTabProps) {
  const set = <K extends keyof PolicyDocument>(key: K, value: PolicyDocument[K]) =>
    patch((d) => ({ ...d, [key]: value }));

  const toggleLink = (id: string) =>
    patch((d) => ({
      ...d,
      linkedOrgNodeIds: d.linkedOrgNodeIds.includes(id)
        ? d.linkedOrgNodeIds.filter((x) => x !== id)
        : [...d.linkedOrgNodeIds, id],
    }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="d-title">Document title (policy name) *</Label>
          <Input
            id="d-title"
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Information Security Policy"
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-type">Type *</Label>
          <Select
            value={draft.type}
            onValueChange={(v) => canEdit && onRequestTemplate(v as DocumentType)}
            disabled={!canEdit}
          >
            <SelectTrigger id="d-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Changing type re-applies the standard template.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-version">Version</Label>
          <Input
            id="d-version"
            value={draft.version}
            onChange={(e) => set("version", e.target.value)}
            placeholder="1.0"
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-effective">Effective date</Label>
          <Input
            id="d-effective"
            type="date"
            value={draft.effectiveDate ?? ""}
            onChange={(e) => set("effectiveDate", e.target.value)}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-review">Next review date</Label>
          <Input
            id="d-review"
            type="date"
            value={draft.reviewDate ?? ""}
            onChange={(e) => set("reviewDate", e.target.value)}
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="d-owner">Owner</Label>
          <Input
            id="d-owner"
            value={draft.owner ?? ""}
            onChange={(e) => set("owner", e.target.value)}
            placeholder="e.g. CISO"
            disabled={!canEdit}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="d-desc">Description / abstract</Label>
          <Textarea
            id="d-desc"
            rows={2}
            value={draft.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="One-line summary of what this document covers."
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Linked organisation units</Label>
        <p className="text-xs text-muted-foreground">Pick the parts of the org tree this document applies to.</p>
        {orgNodes.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            No org structure defined. Add units in{" "}
            <Link to="/governance/risk-governance" className="font-medium text-brand-accent hover:text-navy">
              Risk Governance
            </Link>{" "}
            first.
          </p>
        ) : (
          <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-border p-1.5">
            {orgNodes.map((n) => (
              <label
                key={n.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={draft.linkedOrgNodeIds.includes(n.id)}
                  onCheckedChange={() => toggleLink(n.id)}
                  disabled={!canEdit}
                />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {ORG_TYPE_LABELS[n.type]}
                </span>
                <span className="text-navy-deep">{n.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
