import { Compass, Rocket, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ASSESSMENT_STATUS_LABELS,
  type InitiativeAssessment,
} from "@/data/assessmentStore";
import { INITIATIVE_STATUS_COLORS, INITIATIVE_STATUS_LABELS, type Initiative } from "@/data/strategyStore";
import { StatusBadge, TintedBadge } from "./badges";

export interface DrillRow {
  initiative: Initiative;
  pillarName: string;
  objectiveTitle: string;
  assessment?: InitiativeAssessment;
}

export interface Drill {
  title: string;
  subtitle: string;
  rows: DrillRow[];
}

/** Side panel listing the initiatives behind a clicked chart element. */
export const DrillSheet = ({ drill, onClose }: { drill: Drill | null; onClose: () => void }) => (
  <Sheet open={!!drill} onOpenChange={(open) => !open && onClose()}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-[520px]">
      <SheetHeader>
        <SheetTitle className="text-base">{drill?.title}</SheetTitle>
        <SheetDescription className="text-xs">{drill?.subtitle}</SheetDescription>
      </SheetHeader>
      <ul className="mt-4 space-y-2">
        {!drill || drill.rows.length === 0 ? (
          <li className="text-xs italic text-muted-foreground">No matching initiatives.</li>
        ) : (
          drill.rows.map((row) => {
            const status = row.assessment?.status;
            return (
              <li key={row.initiative.id}>
                <Card className="shadow-none">
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-start gap-2">
                      <Rocket className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-accent" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.initiative.name || "(unnamed initiative)"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          <Compass className="mr-1 inline h-3 w-3" />
                          {row.pillarName}
                          <span className="mx-1.5">·</span>
                          <Target className="mr-1 inline h-3 w-3" />
                          {row.objectiveTitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TintedBadge color={INITIATIVE_STATUS_COLORS[row.initiative.status]}>
                        {INITIATIVE_STATUS_LABELS[row.initiative.status]}
                      </TintedBadge>
                      {status ? (
                        <StatusBadge status={status}>{ASSESSMENT_STATUS_LABELS[status]}</StatusBadge>
                      ) : (
                        <TintedBadge color="215 16% 47%">Not started</TintedBadge>
                      )}
                      {row.assessment && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          Updated {new Date(row.assessment.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })
        )}
      </ul>
    </SheetContent>
  </Sheet>
);
