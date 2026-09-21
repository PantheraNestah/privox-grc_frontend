import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ClipboardList, Lock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo, BrandName } from "@/components/grc/Logo";
import { QuestionField } from "@/components/grc/surveys/QuestionField";
import {
  firstMissingRequired,
  formatScore,
  getAnswer,
  isAnswerEmpty,
  upsertAnswer,
} from "@/components/grc/surveys/survey-logic";
import { useActiveUser } from "@/hooks/use-active-user";
import {
  SURVEY_CATEGORY_LABELS,
  loadResponses,
  loadSurveys,
  newResponse,
  saveResponses,
  scoreResponse,
  type SurveyAnswer,
  type SurveyResponse,
} from "@/data/surveyStore";

/** Standalone respondent chrome: no workspace sidebar, so external parties see only the survey. */
const RespondShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background">
    <header className="flex h-14 items-center gap-2.5 bg-navy-deep px-4 text-white sm:px-6">
      <Logo size={24} />
      <BrandName className="text-base font-semibold tracking-tight" />
    </header>
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">{children}</main>
  </div>
);

const Notice = ({ icon: Icon, title, text, action }: { icon: typeof Lock; title: string; text: string; action?: ReactNode }) => (
  <RespondShell>
    <Card className="flex flex-col items-center px-6 py-12 text-center shadow-none">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
        <Icon className="h-6 w-6" strokeWidth={1.6} />
      </span>
      <p className="mt-4 text-sm font-semibold text-navy-deep">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  </RespondShell>
);

const SurveyRespond = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [params] = useSearchParams();
  const externalToken = params.get("token");
  const externalEmail = params.get("email");
  const isExternal = !!externalToken && !!externalEmail;
  const activeUser = useActiveUser();

  const survey = useMemo(() => loadSurveys().find((s) => s.id === surveyId) ?? null, [surveyId]);
  const [response, setResponse] = useState<SurveyResponse | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [externalName, setExternalName] = useState("");

  // Resume an existing response for this respondent, or start one for a published survey.
  useEffect(() => {
    if (!survey) return;
    const responses = loadResponses();
    const respondentRef = isExternal ? externalEmail! : activeUser.id;
    const existing = responses.find(
      (r) =>
        r.surveyId === survey.id &&
        r.respondentRef === respondentRef &&
        (isExternal ? r.token === externalToken : r.channel === "internal_user"),
    );
    if (existing) {
      setResponse(existing);
      setSubmitted(!!existing.submittedAt);
    } else if (survey.status === "published") {
      const created = newResponse({
        surveyId: survey.id,
        channel: isExternal ? "external" : "internal_user",
        respondentRef,
        respondentName: isExternal ? undefined : activeUser.name,
        token: isExternal ? externalToken! : undefined,
      });
      saveResponses([...responses, created]);
      setResponse(created);
    }
  }, [survey, isExternal, externalEmail, externalToken, activeUser.id, activeUser.name]);

  const persist = (next: SurveyResponse) => {
    setResponse(next);
    saveResponses(loadResponses().map((r) => (r.id === next.id ? next : r)));
  };

  const setAnswer = (questionId: string, value: SurveyAnswer["value"]) => {
    if (response) persist(upsertAnswer(response, questionId, value));
  };

  const handleSubmit = () => {
    if (!survey || !response) return;
    if (isExternal && !externalName.trim()) {
      toast.error("Please enter your name to submit");
      return;
    }
    const missing = firstMissingRequired(survey, response);
    if (missing) {
      toast.error(`Please answer: "${missing.text || "(untitled question)"}"`);
      return;
    }
    const final: SurveyResponse = {
      ...response,
      respondentName: isExternal ? externalName.trim() : response.respondentName,
      submittedAt: new Date().toISOString(),
    };
    final.score = scoreResponse(survey, final);
    persist(final);
    setSubmitted(true);
    toast.success("Response submitted. Thank you!");
  };

  if (!survey) {
    return (
      <Notice
        icon={ClipboardList}
        title="Survey not found"
        text="The survey link may be invalid or removed."
        action={
          !isExternal && (
            <Button asChild size="sm" variant="outline">
              <Link to="/governance/surveys">Back to surveys</Link>
            </Button>
          )
        }
      />
    );
  }

  if (survey.status !== "published") {
    return <Notice icon={Lock} title="Survey is not open" text={`This survey is currently ${survey.status}.`} />;
  }

  const answered = survey.questions.filter((q) => !isAnswerEmpty(getAnswer(response, q.id))).length;

  return (
    <>
      <Helmet>
        <title>{survey.title} · Survey · Rsolve</title>
        <meta name="description" content={`Respond to the ${survey.title} questionnaire.`} />
      </Helmet>

      <RespondShell>
        {!isExternal && (
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground">
            <Link to="/governance/surveys">
              <ArrowLeft /> Back to surveys
            </Link>
          </Button>
        )}

        <Card>
          <CardHeader className="space-y-2">
            <Badge variant="secondary" className="w-fit text-[11px] font-normal">
              {SURVEY_CATEGORY_LABELS[survey.category]}
            </Badge>
            <CardTitle className="text-xl text-navy-deep">{survey.title}</CardTitle>
            {survey.description && <CardDescription>{survey.description}</CardDescription>}
            {isExternal && (
              <p className="text-xs text-muted-foreground">
                Responding as external party: <strong className="text-foreground">{externalEmail}</strong>
              </p>
            )}
          </CardHeader>

          {submitted ? (
            <CardContent className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" strokeWidth={1.5} />
              <p className="mt-3 text-base font-semibold text-navy-deep">Thank you!</p>
              <p className="mt-1 text-sm text-muted-foreground">Your response has been recorded.</p>
              {response?.score !== undefined && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Your score:{" "}
                  <strong className="text-foreground">{formatScore(survey.scoring, response.score)}</strong>
                </p>
              )}
            </CardContent>
          ) : (
            <>
              <CardContent className="space-y-6">
                {isExternal && (
                  <div className="space-y-1.5">
                    <Label htmlFor="respondent-name">Your name *</Label>
                    <Input
                      id="respondent-name"
                      value={externalName}
                      onChange={(e) => setExternalName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                )}

                <ol className="space-y-7">
                  {survey.questions.map((q, idx) => (
                    <li key={q.id}>
                      <QuestionField
                        question={q}
                        index={idx}
                        value={getAnswer(response, q.id)}
                        onChange={(value) => setAnswer(q.id, value)}
                      />
                    </li>
                  ))}
                </ol>
              </CardContent>

              <CardFooter className="flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {answered} of {survey.questions.length} answered
                </p>
                <Button variant="brand" size="lg" className="w-full sm:w-auto" onClick={handleSubmit}>
                  Submit response
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </RespondShell>
    </>
  );
};

export default SurveyRespond;
