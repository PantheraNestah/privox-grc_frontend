import { type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  newAbbreviation,
  newReference,
  newRevision,
  type DocumentAbbreviation,
  type DocumentReference,
  type DocumentRevision,
} from "@/data/documentsStore";
import type { DocumentTabProps } from "./document-logic";

function Block({
  title,
  addLabel,
  canEdit,
  onAdd,
  empty,
  isEmpty,
  children,
}: {
  title: string;
  addLabel: string;
  canEdit: boolean;
  onAdd: () => void;
  empty: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{title}</Label>
        {canEdit && (
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            <Plus /> {addLabel}
          </Button>
        )}
      </div>
      {isEmpty ? <p className="text-xs text-muted-foreground">{empty}</p> : <div className="space-y-2">{children}</div>}
    </section>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-8 w-8 shrink-0 justify-self-end text-destructive hover:text-destructive"
      onClick={onClick}
      aria-label={label}
    >
      <Trash2 />
    </Button>
  );
}

export function DocumentTermsTab({ draft, patch, canEdit }: DocumentTabProps) {
  const updateTerm = (id: string, change: Partial<DocumentAbbreviation>) =>
    patch((d) => ({ ...d, abbreviations: d.abbreviations.map((x) => (x.id === id ? { ...x, ...change } : x)) }));
  const updateRef = (id: string, change: Partial<DocumentReference>) =>
    patch((d) => ({ ...d, references: d.references.map((x) => (x.id === id ? { ...x, ...change } : x)) }));
  const updateRevision = (id: string, change: Partial<DocumentRevision>) =>
    patch((d) => ({ ...d, revisionHistory: d.revisionHistory.map((x) => (x.id === id ? { ...x, ...change } : x)) }));

  return (
    <div className="space-y-6">
      <Block
        title="Abbreviations & defined terms"
        addLabel="Add term"
        canEdit={canEdit}
        onAdd={() => patch((d) => ({ ...d, abbreviations: [...d.abbreviations, newAbbreviation()] }))}
        empty="No defined terms yet."
        isEmpty={draft.abbreviations.length === 0}
      >
        {draft.abbreviations.map((a) => (
          <div key={a.id} className="grid items-center gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <Input
              value={a.term}
              onChange={(e) => updateTerm(a.id, { term: e.target.value })}
              placeholder="e.g. ISMS"
              aria-label="Term"
              disabled={!canEdit}
            />
            <Input
              value={a.meaning}
              onChange={(e) => updateTerm(a.id, { meaning: e.target.value })}
              placeholder="Information Security Management System"
              aria-label="Definition"
              disabled={!canEdit}
            />
            {canEdit && (
              <RemoveButton
                label="Remove term"
                onClick={() => patch((d) => ({ ...d, abbreviations: d.abbreviations.filter((x) => x.id !== a.id) }))}
              />
            )}
          </div>
        ))}
      </Block>

      <Block
        title="References & related documents"
        addLabel="Add reference"
        canEdit={canEdit}
        onAdd={() => patch((d) => ({ ...d, references: [...d.references, newReference()] }))}
        empty="No references yet."
        isEmpty={draft.references.length === 0}
      >
        {draft.references.map((r) => (
          <div key={r.id} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input
              placeholder="Label (e.g. ISO 27001)"
              aria-label="Reference label"
              value={r.label}
              onChange={(e) => updateRef(r.id, { label: e.target.value })}
              disabled={!canEdit}
            />
            <Input
              placeholder="Source / clause"
              aria-label="Reference source"
              value={r.source ?? ""}
              onChange={(e) => updateRef(r.id, { source: e.target.value })}
              disabled={!canEdit}
            />
            <Input
              placeholder="https://…"
              aria-label="Reference URL"
              value={r.url ?? ""}
              onChange={(e) => updateRef(r.id, { url: e.target.value })}
              disabled={!canEdit}
            />
            {canEdit && (
              <RemoveButton
                label="Remove reference"
                onClick={() => patch((d) => ({ ...d, references: d.references.filter((x) => x.id !== r.id) }))}
              />
            )}
          </div>
        ))}
      </Block>

      <Block
        title="Revision history"
        addLabel="Add entry"
        canEdit={canEdit}
        onAdd={() =>
          patch((d) => ({
            ...d,
            revisionHistory: [...d.revisionHistory, newRevision(d.version, d.owner ?? "Author")],
          }))
        }
        empty="No version history recorded yet."
        isEmpty={draft.revisionHistory.length === 0}
      >
        {draft.revisionHistory.map((r) => (
          <div key={r.id} className="grid items-center gap-2 sm:grid-cols-[5rem_9rem_1fr_2fr_auto]">
            <Input
              value={r.version}
              onChange={(e) => updateRevision(r.id, { version: e.target.value })}
              aria-label="Revision version"
              disabled={!canEdit}
            />
            <Input
              type="date"
              value={r.date}
              onChange={(e) => updateRevision(r.id, { date: e.target.value })}
              aria-label="Revision date"
              disabled={!canEdit}
            />
            <Input
              value={r.author}
              onChange={(e) => updateRevision(r.id, { author: e.target.value })}
              placeholder="Author"
              aria-label="Revision author"
              disabled={!canEdit}
            />
            <Input
              value={r.summary}
              onChange={(e) => updateRevision(r.id, { summary: e.target.value })}
              placeholder="Summary of changes"
              aria-label="Revision summary"
              disabled={!canEdit}
            />
            {canEdit && (
              <RemoveButton
                label="Remove revision"
                onClick={() =>
                  patch((d) => ({ ...d, revisionHistory: d.revisionHistory.filter((x) => x.id !== r.id) }))
                }
              />
            )}
          </div>
        ))}
      </Block>
    </div>
  );
}
