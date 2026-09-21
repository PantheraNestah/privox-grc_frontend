import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { BarChart3, ClipboardList, Edit3, Link2, Lock, MoreHorizontal, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { EmptyState } from "@/components/grc/common/states";
import { ResultsDialog } from "@/components/grc/surveys/ResultsDialog";
import { ShareLinksDialog } from "@/components/grc/surveys/ShareLinksDialog";
import { StatCard } from "@/components/grc/surveys/StatCard";
import { SurveyDesigner } from "@/components/grc/surveys/SurveyDesigner";
import { SurveyStatusBadge } from "@/components/grc/surveys/SurveyStatusBadge";
import { averageScore, formatScore } from "@/components/grc/surveys/survey-logic";
import { useActiveUser } from "@/hooks/use-active-user";
import { can, loadUsers, ROLE_LABELS } from "@/data/userStore";
import { loadOrgNodes } from "@/data/orgStore";
import {
  SCORING_LABELS,
  SURVEY_CATEGORY_LABELS,
  expectedRespondentCount,
  loadAdStaff,
  loadResponses,
  loadSurveys,
  newSurvey,
  saveSurveys,
  scoreResponse,
  type Survey,
} from "@/data/surveyStore";

const SurveyManagement = () => {
  const activeUser = useActiveUser();
  const allowed = can.manageSurveys(activeUser.role);

  const [surveys, setSurveys] = useState<Survey[]>(loadSurveys);
  const [responses] = useState(loadResponses);
  const [users] = useState(loadUsers);
  const [orgNodes] = useState(loadOrgNodes);
  const adStaff = useMemo(loadAdStaff, []);

  const [editing, setEditing] = useState<Survey | null>(null);
  const [resultsOf, setResultsOf] = useState<Survey | null>(null);
  const [linksOf, setLinksOf] = useState<Survey | null>(null);
  const [toDelete, setToDelete] = useState<Survey | null>(null);

  const persist = (next: Survey[]) => {
    setSurveys(next);
    saveSurveys(next);
  };

  const stats = useMemo(
    () => ({
      total: surveys.length,
      draft: surveys.filter((s) => s.status === "draft").length,
      published: surveys.filter((s) => s.status === "published").length,
      closed: surveys.filter((s) => s.status === "closed").length,
    }),
    [surveys],
  );

  const createSurvey = () => setEditing({ ...newSurvey(activeUser.id), title: "Untitled survey" });

  const saveSurvey = (survey: Survey) => {
    const exists = surveys.some((s) => s.id === survey.id);
    persist(exists ? surveys.map((s) => (s.id === survey.id ? survey : s)) : [...surveys, survey]);
    setEditing(null);
    toast.success("Survey saved");
  };

  const transition = (id: string, patch: Partial<Survey>, message: string) => {
    persist(surveys.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    toast.success(message);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    persist(surveys.filter((s) => s.id !== toDelete.id));
    setToDelete(null);
    toast.success("Survey deleted");
  };

  return (
    <>
      <Helmet>
        <title>Questionnaires & Surveys · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Design and publish risk culture, governance and management surveys to internal users, all staff or external parties."
        />
        <link rel="canonical" href="/governance/surveys" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Governance", to: "/governance" }, { label: "Surveys" }]}
        title="Questionnaires & Surveys"
        description={`Design surveys and publish them to system users, all staff via Active Directory, or external parties via email. Viewing as ${activeUser.name} (${ROLE_LABELS[activeUser.role]}).`}
        actions={
          allowed && (
            <Button variant="brand" onClick={createSurvey}>
              <Plus /> New survey
            </Button>
          )
        }
      />

      {!allowed && (
        <Alert className="mb-6">
          <Lock className="h-4 w-4" />
          <AlertTitle>Read-only view</AlertTitle>
          <AlertDescription>
            Only Administrators and Risk Managers can design or publish surveys. You can still view published
            surveys and respond to those targeted at your role.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Draft" value={stats.draft} />
        <StatCard label="Published" value={stats.published} />
        <StatCard label="Closed" value={stats.closed} />
      </div>

      {surveys.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No surveys yet"
          description={
            allowed
              ? "Create your first questionnaire to assess risk culture, governance maturity or vendor controls."
              : "No surveys have been published yet."
          }
          action={
            allowed && (
              <Button variant="brand" size="sm" onClick={createSurvey}>
                <Plus /> New survey
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {surveys.map((s) => {
              const submitted = responses.filter((r) => r.surveyId === s.id && r.submittedAt);
              const expected = expectedRespondentCount(s, users, adStaff);
              const completion = expected > 0 ? Math.round((submitted.length / expected) * 100) : 0;
              const average = averageScore(
                submitted.map((r) => scoreResponse(s, r)).filter((v): v is number => typeof v === "number"),
              );

              return (
                <li
                  key={s.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5 lg:grid-cols-[minmax(0,2fr)_10rem_7rem_7rem_auto]"
                >
                  <div className="min-w-0 lg:order-1">
                    <p className="truncate text-sm font-medium text-navy-deep">{s.title || "(untitled)"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {SURVEY_CATEGORY_LABELS[s.category]} · {s.questions.length} question
                      {s.questions.length === 1 ? "" : "s"} · {SCORING_LABELS[s.scoring]}
                    </p>
                  </div>

                  <div className="col-span-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground lg:contents">
                    <span className="lg:order-4">
                      <SurveyStatusBadge status={s.status} />
                    </span>
                    <span className="lg:order-2">
                      <span className="lg:hidden">Completion </span>
                      <span className="font-medium text-foreground">
                        {submitted.length}/{expected || "—"} ({completion}%)
                      </span>
                    </span>
                    <span className="lg:order-3">
                      <span className="lg:hidden">Avg score </span>
                      <span className="font-medium text-foreground">
                        {average === null ? "—" : formatScore(s.scoring, average)}
                      </span>
                    </span>
                  </div>

                  <div className="col-start-2 row-start-1 lg:order-5 lg:col-start-auto lg:row-start-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${s.title || "survey"}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => setResultsOf(s)}>
                          <BarChart3 /> View results
                        </DropdownMenuItem>
                        {s.status === "published" && (
                          <DropdownMenuItem onSelect={() => setLinksOf(s)}>
                            <Link2 /> Share links
                          </DropdownMenuItem>
                        )}
                        {allowed && s.status === "draft" && (
                          <>
                            <DropdownMenuItem onSelect={() => setEditing(s)}>
                              <Edit3 /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                transition(s.id, { status: "published", publishedAt: new Date().toISOString() }, "Survey published")
                              }
                            >
                              <Send /> Publish
                            </DropdownMenuItem>
                          </>
                        )}
                        {allowed && s.status === "published" && (
                          <DropdownMenuItem
                            onSelect={() => transition(s.id, { status: "closed", closedAt: new Date().toISOString() }, "Survey closed")}
                          >
                            <Lock /> Close survey
                          </DropdownMenuItem>
                        )}
                        {allowed && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                              onSelect={() => setToDelete(s)}
                            >
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {editing && (
        <SurveyDesigner
          survey={editing}
          isNew={!surveys.some((s) => s.id === editing.id)}
          orgNodes={orgNodes}
          onClose={() => setEditing(null)}
          onSave={saveSurvey}
        />
      )}

      {resultsOf && (
        <ResultsDialog
          survey={resultsOf}
          responses={responses.filter((r) => r.surveyId === resultsOf.id)}
          users={users}
          onClose={() => setResultsOf(null)}
        />
      )}

      {linksOf && <ShareLinksDialog survey={linksOf} onClose={() => setLinksOf(null)} />}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete survey?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title || "Untitled"}" and its responses will be removed from this browser's prototype
              store. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SurveyManagement;
