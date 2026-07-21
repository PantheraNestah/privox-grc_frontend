import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowLeft, ClipboardList, Lock } from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useActiveUser } from "@/hooks/use-active-user";
import {
  loadSurveys, loadResponses, saveResponses, newResponse,
  scoreResponse, SURVEY_CATEGORY_LABELS,
  type Survey, type SurveyAnswer, type SurveyResponse,
} from "@/data/surveyStore";

const SurveyRespond = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [params] = useSearchParams();
  const externalToken = params.get("token");
  const externalEmail = params.get("email");
  const activeUser = useActiveUser();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [response, setResponse] = useState<SurveyResponse | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [externalName, setExternalName] = useState("");

  const isExternal = !!externalToken && !!externalEmail;

  useEffect(() => {
    if (!surveyId) return;
    const all = loadSurveys();
    const s = all.find(x => x.id === surveyId) ?? null;
    setSurvey(s);
    if (!s) return;

    // find or create response
    const responses = loadResponses();
    const respondentRef = isExternal ? externalEmail! : activeUser.id;
    const existing = responses.find(r =>
      r.surveyId === s.id &&
      r.respondentRef === respondentRef &&
      (isExternal ? r.token === externalToken : r.channel === "internal_user")
    );
    if (existing) {
      setResponse(existing);
      if (existing.submittedAt) setSubmitted(true);
    } else if (s.status === "published") {
      const r = newResponse({
        surveyId: s.id,
        channel: isExternal ? "external" : "internal_user",
        respondentRef,
        respondentName: isExternal ? undefined : activeUser.name,
        token: isExternal ? externalToken! : undefined,
      });
      const next = [...responses, r];
      saveResponses(next);
      setResponse(r);
    }
  }, [surveyId, isExternal, externalEmail, externalToken, activeUser.id, activeUser.name]);

  const setAnswer = (questionId: string, value: SurveyAnswer["value"]) => {
    if (!response) return;
    const updated: SurveyResponse = {
      ...response,
      answers: (() => {
        const existing = response.answers.find(a => a.questionId === questionId);
        if (existing) return response.answers.map(a => a.questionId === questionId ? { ...a, value } : a);
        return [...response.answers, { questionId, value }];
      })(),
    };
    setResponse(updated);
    const all = loadResponses();
    saveResponses(all.map(r => r.id === updated.id ? updated : r));
  };

  const getAnswer = (questionId: string): SurveyAnswer["value"] => {
    return response?.answers.find(a => a.questionId === questionId)?.value ?? null;
  };

  const handleSubmit = () => {
    if (!survey || !response) return;
    if (isExternal && !externalName.trim()) {
      toast.error("Please enter your name to submit");
      return;
    }
    // validate required
    for (const q of survey.questions) {
      if (q.required) {
        const v = getAnswer(q.id);
        const isEmpty = v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
        if (isEmpty) {
          toast.error(`Please answer: "${q.text || "(untitled question)"}"`);
          return;
        }
      }
    }
    const finalResp: SurveyResponse = {
      ...response,
      respondentName: isExternal ? externalName.trim() : response.respondentName,
      submittedAt: new Date().toISOString(),
    };
    finalResp.score = scoreResponse(survey, finalResp);
    const all = loadResponses();
    saveResponses(all.map(r => r.id === finalResp.id ? finalResp : r));
    setResponse(finalResp);
    setSubmitted(true);
    toast.success("Response submitted. Thank you!");
  };

  if (!survey) {
    return (
      <div className="flex flex-col min-h-screen">
        {!isExternal && <TopNav />}
        <main className="flex-1 px-5 md:px-10 py-8">
          <Card className="p-8 text-center max-w-md mx-auto">
            <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">Survey not found</p>
            <p className="text-xs text-muted-foreground mt-1">The survey link may be invalid or removed.</p>
            {!isExternal && (
              <Button asChild size="sm" className="mt-4">
                <Link to="/governance/surveys">Back to surveys</Link>
              </Button>
            )}
          </Card>
        </main>
      </div>
    );
  }

  if (survey.status !== "published") {
    return (
      <div className="flex flex-col min-h-screen">
        {!isExternal && <TopNav />}
        <main className="flex-1 px-5 md:px-10 py-8">
          <Card className="p-8 text-center max-w-md mx-auto">
            <Lock className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">Survey is not open</p>
            <p className="text-xs text-muted-foreground mt-1">This survey is currently {survey.status}.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{survey.title} · Survey · Rsolve</title>
        <meta name="description" content={`Respond to the ${survey.title} questionnaire.`} />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        {!isExternal && <TopNav />}

        <main className="flex-1 px-5 md:px-10 py-8 md:py-9 max-w-3xl mx-auto w-full">
          {!isExternal && (
            <Button asChild variant="outline" size="sm" className="mb-4">
              <Link to="/governance/surveys"><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Link>
            </Button>
          )}

          <Card className="p-6">
            <div className="mb-5 pb-5 border-b border-border">
              <Badge variant="secondary" className="text-[10px] mb-2">{SURVEY_CATEGORY_LABELS[survey.category]}</Badge>
              <h1 className="text-xl font-semibold text-foreground">{survey.title}</h1>
              {survey.description && <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>}
              {isExternal && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Responding as external party: <strong>{externalEmail}</strong>
                </p>
              )}
            </div>

            {submitted ? (
              <div className="text-center py-10">
                <CheckCircle2 className="w-14 h-14 mx-auto text-[hsl(158_53%_49%)] mb-3" />
                <p className="text-base font-semibold text-foreground">Thank you!</p>
                <p className="text-xs text-muted-foreground mt-1">Your response has been recorded.</p>
                {response?.score !== undefined && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Your score: <strong className="text-foreground">
                      {survey.scoring === "maturity" ? `${response.score} / 5` : `${response.score}%`}
                    </strong>
                  </p>
                )}
              </div>
            ) : (
              <>
                {isExternal && (
                  <div className="mb-5 space-y-1.5">
                    <Label>Your name *</Label>
                    <Input value={externalName} onChange={e => setExternalName(e.target.value)} placeholder="Full name" />
                  </div>
                )}

                <ol className="space-y-5">
                  {survey.questions.map((q, idx) => (
                    <li key={q.id}>
                      <p className="text-sm font-medium text-foreground mb-2">
                        <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
                        {q.text || "(untitled question)"}
                        {q.required && <span className="text-destructive ml-1">*</span>}
                      </p>
                      {q.type === "text" && (
                        <Textarea
                          rows={3}
                          value={(getAnswer(q.id) as string) ?? ""}
                          onChange={e => setAnswer(q.id, e.target.value)}
                        />
                      )}
                      {(q.type === "single" || q.type === "yes_no") && (
                        <RadioGroup
                          value={(getAnswer(q.id) as string) ?? ""}
                          onValueChange={v => setAnswer(q.id, v)}
                        >
                          {q.options.map(o => (
                            <div key={o.id} className="flex items-center gap-2">
                              <RadioGroupItem value={o.id} id={`${q.id}-${o.id}`} />
                              <label htmlFor={`${q.id}-${o.id}`} className="text-sm text-foreground cursor-pointer">{o.label}</label>
                            </div>
                          ))}
                        </RadioGroup>
                      )}
                      {q.type === "multi" && (
                        <div className="space-y-1.5">
                          {q.options.map(o => {
                            const current = (getAnswer(q.id) as string[]) ?? [];
                            const checked = current.includes(o.id);
                            return (
                              <label key={o.id} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                <Checkbox checked={checked} onCheckedChange={v => {
                                  const next = v ? [...current, o.id] : current.filter(x => x !== o.id);
                                  setAnswer(q.id, next);
                                }} />
                                {o.label}
                              </label>
                            );
                          })}
                        </div>
                      )}
                      {q.type === "scale" && (
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map(n => {
                            const current = getAnswer(q.id);
                            const active = current === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setAnswer(q.id, n)}
                                className={`w-10 h-10 rounded-full border text-sm font-semibold transition-colors ${
                                  active
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-foreground border-border hover:bg-muted"
                                }`}
                              >
                                {n}
                              </button>
                            );
                          })}
                          <span className="text-[11px] text-muted-foreground ml-2">(1 = strongly disagree · 5 = strongly agree)</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>

                <div className="flex justify-end mt-6 pt-5 border-t border-border">
                  <Button size="lg" onClick={handleSubmit} className="bg-primary hover:bg-primary/90">
                    Submit response
                  </Button>
                </div>
              </>
            )}
          </Card>
        </main>
      </div>
    </>
  );
};

export default SurveyRespond;
