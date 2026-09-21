import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { EvidenceFile } from "@/data/strategyStore";
import { readEvidenceFiles } from "./evidence";

interface EvidencePanelProps {
  evidence: EvidenceFile[];
  /** When set, files can be uploaded and removed. */
  editable?: boolean;
  uploadedBy?: string;
  onAdd?: (files: EvidenceFile[]) => void;
  onRemove?: (id: string) => void;
  /** Show the count in the heading (used by the approver view). */
  showCount?: boolean;
}

export function EvidencePanel({ evidence, editable, uploadedBy = "", onAdd, onRemove, showCount }: EvidencePanelProps) {
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const { added, skipped } = await readEvidenceFiles(Array.from(files), uploadedBy);
    skipped.forEach((s) =>
      toast.error(s.reason === "too-large" ? `"${s.name}" exceeds the 4 MB limit and was skipped.` : `Could not read "${s.name}".`),
    );
    if (added.length > 0) {
      onAdd?.(added);
      toast.success(`${added.length} file${added.length === 1 ? "" : "s"} attached.`);
    }
  };

  if (!editable && evidence.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" /> Evidence{showCount ? ` (${evidence.length})` : ""}
        </h3>
        {editable && (
          <Button asChild variant="outline" size="sm" className="h-8 cursor-pointer">
            <label>
              <input
                type="file"
                multiple
                className="hidden"
                aria-label="Upload evidence files"
                onChange={(e) => {
                  void handleUpload(e.target.files);
                  e.target.value = "";
                }}
              />
              <Upload /> Upload files
            </label>
          </Button>
        )}
      </div>

      {evidence.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="p-3 text-center text-xs text-muted-foreground">
            No evidence attached yet. Upload reports, screenshots, certificates or any proof that supports your scoring.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-1.5">
          {evidence.map((ev) => (
            <li key={ev.id} className="flex items-center gap-2 rounded-md border border-border p-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{ev.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(ev.size / 1024).toFixed(1)} KB
                  {ev.uploadedBy ? ` · ${ev.uploadedBy}` : ""}
                  {" · "}
                  {new Date(ev.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <a href={ev.dataUrl} download={ev.name} target="_blank" rel="noreferrer" aria-label={`Download ${ev.name}`}>
                  <Download />
                </a>
              </Button>
              {editable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${ev.name}`}
                  onClick={() => onRemove?.(ev.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
