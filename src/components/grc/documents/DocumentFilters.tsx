import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  type DocumentStatus,
  type DocumentType,
} from "@/data/documentsStore";
import { ORG_TYPE_LABELS, type OrgNodeType } from "@/data/orgStore";
import { DOC_TYPES, ORG_LEVEL_FILTERS, type DocumentFilters } from "./document-logic";

interface DocumentFiltersBarProps {
  filters: DocumentFilters;
  onChange: (next: DocumentFilters) => void;
  shown: number;
  total: number;
}

const STATUSES: DocumentStatus[] = ["current", "expired", "draft"];

export function DocumentFiltersBar({ filters, onChange, shown, total }: DocumentFiltersBarProps) {
  const patch = (partial: Partial<DocumentFilters>) => onChange({ ...filters, ...partial });

  return (
    <Card className="mb-4 space-y-3 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="Search title or description…"
            aria-label="Search documents"
            className="pl-9 pr-9"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => patch({ search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Badge variant="secondary" className="hidden shrink-0 text-[11px] font-normal sm:inline-flex">
          {shown} of {total}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={filters.type} onValueChange={(v) => patch({ type: v as DocumentType | "all" })}>
          <SelectTrigger aria-label="Filter by type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(v) => patch({ status: v as DocumentStatus | "all" })}>
          <SelectTrigger aria-label="Filter by currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {DOCUMENT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.level} onValueChange={(v) => patch({ level: v as OrgNodeType | "all" })}>
          <SelectTrigger aria-label="Filter by organisation level">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All org levels</SelectItem>
            {ORG_LEVEL_FILTERS.map((t) => (
              <SelectItem key={t} value={t}>
                {ORG_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}
