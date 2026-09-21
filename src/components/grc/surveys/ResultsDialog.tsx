import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { scoreResponse, type Survey, type SurveyResponse } from "@/data/surveyStore";
import type { AppUser } from "@/data/userStore";
import { StatCard } from "./StatCard";
import { averageScore, formatScore } from "./survey-logic";

interface ResultsDialogProps {
  survey: Survey;
  responses: SurveyResponse[];
  users: AppUser[];
  onClose: () => void;
}

const CHANNEL_LABELS: Record<SurveyResponse["channel"], string> = {
  internal_user: "System user",
  ad_staff: "Staff (AD)",
  external: "External",
};

export function ResultsDialog({ survey, responses, users, onClose }: ResultsDialogProps) {
  const submitted = responses.filter((r) => r.submittedAt);
  const inProgress = responses.length - submitted.length;
  const scores = submitted.map((r) => scoreResponse(survey, r)).filter((v): v is number => typeof v === "number");
  const average = averageScore(scores);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Results</DialogTitle>
          <DialogDescription>{survey.title}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Submitted" value={submitted.length} />
          <StatCard label="In progress" value={inProgress} />
          <StatCard label="Avg score" value={average === null ? "—" : formatScore(survey.scoring, average)} />
        </div>

        {submitted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Respondent</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submitted.map((r) => {
                  const score = scoreResponse(survey, r);
                  const name =
                    r.respondentName ??
                    (r.channel === "internal_user"
                      ? (users.find((u) => u.id === r.respondentRef)?.name ?? r.respondentRef)
                      : r.respondentRef);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-foreground">{name}</TableCell>
                      <TableCell className="text-muted-foreground">{CHANNEL_LABELS[r.channel] ?? r.channel}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(r.submittedAt!).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {score === undefined ? "—" : formatScore(survey.scoring, score)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
