import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Survey } from "@/data/surveyStore";

/** Stable per-recipient token for the prototype (no server issuing yet). */
export const externalToken = (surveyId: string, email: string) =>
  btoa(`${surveyId}:${email}`).replace(/=/g, "").slice(0, 12);

function LinkRow({ label, url }: { label: string; url: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="truncate text-sm text-foreground sm:w-48">{label}</span>
      <div className="flex min-w-0 flex-1 gap-2">
        <Input value={url} readOnly aria-label={`${label} link`} className="h-9 text-xs" />
        <Button type="button" size="icon" variant="outline" onClick={copy} aria-label={`Copy ${label} link`}>
          <Copy />
        </Button>
      </div>
    </div>
  );
}

export function ShareLinksDialog({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  const base = `${window.location.origin}/surveys/${survey.id}/respond`;
  const external = survey.audiences.find((a) => a.type === "external")?.values ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share survey</DialogTitle>
          <DialogDescription>{survey.title}</DialogDescription>
        </DialogHeader>

        <Card className="space-y-3 p-4 shadow-none">
          <div>
            <p className="text-sm font-semibold text-navy-deep">Internal link</p>
            <p className="text-xs text-muted-foreground">
              For signed-in system users targeted by role or org unit.
            </p>
          </div>
          <LinkRow label="Internal" url={base} />
        </Card>

        {external.length > 0 && (
          <Card className="space-y-3 p-4 shadow-none">
            <p className="text-sm font-semibold text-navy-deep">External party links</p>
            {external.map((email) => (
              <LinkRow
                key={email}
                label={email}
                url={`${base}?token=${externalToken(survey.id, email)}&email=${encodeURIComponent(email)}`}
              />
            ))}
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
