import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Survey } from "@/data/surveyStore";

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
              For signed-in system users targeted by role or org unit. This link only works in this browser —
              the survey is stored locally, not on the server.
            </p>
          </div>
          <LinkRow label="Internal" url={base} />
        </Card>

        {external.length > 0 && (
          <Card className="space-y-2 border-amber-500/30 bg-amber-500/10 p-4 shadow-none">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              External party links are not available yet
            </p>
            <p className="text-xs text-amber-800/90 dark:text-amber-200/90">
              This survey is stored only in this browser and the respondent page requires sign-in, so external
              links would not work for recipients. External distribution will be enabled once the backend survey
              module is available.
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80">
              Requested recipients: {external.join(", ")}
            </p>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
