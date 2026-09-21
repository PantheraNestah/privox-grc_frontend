import { BookOpen, ChevronDown, ChevronUp, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { newSection, type DocumentSection, type DocumentType } from "@/data/documentsStore";
import { moveItem, type DocumentTabProps } from "./document-logic";

interface DocumentBodyTabProps extends DocumentTabProps {
  onRequestTemplate: (type: DocumentType) => void;
}

export function DocumentBodyTab({ draft, patch, canEdit, onRequestTemplate }: DocumentBodyTabProps) {
  const updateSection = (id: string, change: Partial<DocumentSection>) =>
    patch((d) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...change } : s)) }));

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" /> Table of contents
            </p>
            {canEdit && (
              <Button type="button" size="sm" variant="outline" onClick={() => onRequestTemplate(draft.type)}>
                <Sparkles /> Reapply template
              </Button>
            )}
          </div>
          {draft.sections.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No sections yet. Reapply the template or add sections manually below.
            </p>
          ) : (
            <ol className="space-y-0.5 text-sm text-navy-deep">
              {draft.sections.map((s, i) => (
                <li key={s.id} className="flex gap-2">
                  <span className="w-6 tabular-nums text-muted-foreground">{i + 1}.</span>
                  <span className="truncate">{s.heading || <em className="text-muted-foreground">Untitled section</em>}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {draft.sections.map((s, idx) => (
          <Card key={s.id} className="shadow-none">
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center gap-1.5">
                <Input
                  value={s.heading}
                  onChange={(e) => updateSection(s.id, { heading: e.target.value })}
                  placeholder={`Section ${idx + 1} heading`}
                  aria-label={`Section ${idx + 1} heading`}
                  className="h-9 font-medium"
                  disabled={!canEdit}
                />
                {canEdit && (
                  <>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      disabled={idx === 0}
                      onClick={() => patch((d) => ({ ...d, sections: moveItem(d.sections, idx, -1) }))}
                      aria-label="Move section up"
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      disabled={idx === draft.sections.length - 1}
                      onClick={() => patch((d) => ({ ...d, sections: moveItem(d.sections, idx, 1) }))}
                      aria-label="Move section down"
                    >
                      <ChevronDown />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => patch((d) => ({ ...d, sections: d.sections.filter((x) => x.id !== s.id) }))}
                      aria-label="Remove section"
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </div>
              <Textarea
                value={s.body}
                rows={4}
                onChange={(e) => updateSection(s.id, { body: e.target.value })}
                placeholder="Section content…"
                aria-label={`Section ${idx + 1} content`}
                disabled={!canEdit}
              />
            </CardContent>
          </Card>
        ))}

        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              patch((d) => ({ ...d, sections: [...d.sections, newSection(`${d.sections.length + 1}. New section`)] }))
            }
          >
            <Plus /> Add section
          </Button>
        )}
      </div>
    </div>
  );
}
