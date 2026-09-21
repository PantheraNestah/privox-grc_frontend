import { Download, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_ATTACHMENT_BYTES, formatBytes, readFileAsDataUrl } from "@/data/documentsStore";
import { cn } from "@/lib/utils";
import type { DocumentTabProps } from "./document-logic";

interface DocumentAttachmentTabProps extends DocumentTabProps {
  userId: string;
}

export function DocumentAttachmentTab({ draft, patch, canEdit, userId }: DocumentAttachmentTabProps) {
  const attachment = draft.attachment;

  const handleAttach = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      patch((d) => ({
        ...d,
        attachment: {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          dataUrl,
          uploadedAt: new Date().toISOString(),
          uploadedByUserId: userId,
        },
      }));
      toast.success(`Attached ${file.name}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-4">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" /> Source file
          </p>
          <p className="text-sm text-muted-foreground">
            Attach the authoritative source file (PDF, Word, Excel, etc.) instead of, or as well as, authoring inline.
            Max {(MAX_ATTACHMENT_BYTES / 1024 / 1024).toFixed(1)} MB.
          </p>
        </div>

        {attachment ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-navy-deep">{attachment.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {attachment.mimeType || "file"} · {formatBytes(attachment.sizeBytes)} · uploaded{" "}
                {new Date(attachment.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button asChild variant="outline" size="sm">
                <a href={attachment.dataUrl} download={attachment.fileName}>
                  <Download /> Download
                </a>
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => patch((d) => ({ ...d, attachment: undefined }))}
                >
                  <Trash2 /> Remove
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No file attached.</p>
        )}

        {canEdit && (
          <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
            <Upload />
            {attachment ? "Replace file" : "Choose a file to upload"}
            <input
              type="file"
              className="sr-only"
              onChange={(e) => {
                void handleAttach(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </label>
        )}
      </CardContent>
    </Card>
  );
}
