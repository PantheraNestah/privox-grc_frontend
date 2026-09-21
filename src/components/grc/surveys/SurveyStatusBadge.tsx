import { Badge } from "@/components/ui/badge";
import { SURVEY_STATUS_LABELS, type SurveyStatus } from "@/data/surveyStore";
import { cn } from "@/lib/utils";

const STYLES: Record<SurveyStatus, { badge: string; dot: string }> = {
  draft: { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  published: { badge: "bg-success/12 text-success", dot: "bg-success" },
  closed: { badge: "bg-warn/15 text-warn", dot: "bg-warn" },
};

export function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  const style = STYLES[status];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 whitespace-nowrap border-transparent text-[11px] font-medium", style.badge)}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {SURVEY_STATUS_LABELS[status]}
    </Badge>
  );
}
