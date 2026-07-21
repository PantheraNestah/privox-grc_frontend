import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Plus, Trash2, ClipboardList, Send, Lock, Eye,
  Copy, BarChart3, Users, Mail, Building2, ChevronDown, ChevronUp, Edit3, Link2, X,
} from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useActiveUser } from "@/hooks/use-active-user";
import { can, ROLE_LABELS, loadUsers, type UserRole, type AppUser } from "@/data/userStore";
import { loadOrgNodes, ORG_TYPE_LABELS, type OrgNode, type OrgNodeType } from "@/data/orgStore";
import {
  loadSurveys, saveSurveys, newSurvey, newQuestion, newOption,
  loadResponses, loadAdStaff, expectedRespondentCount, scoreResponse, generateToken,
  SURVEY_CATEGORY_LABELS, SCORING_LABELS, SURVEY_STATUS_LABELS, SURVEY_STATUS_COLORS,
  QUESTION_TYPE_LABELS, AUDIENCE_LABELS,
  type Survey, type Question, type SurveyCategory, type ScoringModel, type QuestionType,
  type SurveyAudience, type AudienceType, type SurveyResponse,
} from "@/data/surveyStore";

const ORG_LEVELS: OrgNodeType[] = ["group", "company", "department", "division", "section"];
const ROLES: UserRole[] = ["admin", "input_user", "approver", "risk_manager", "executive"];

const SurveyManagement = () => {
  const activeUser = useActiveUser();
  const allowed = can.manageSurveys(activeUser.role);

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [editing, setEditing] = useState<Survey | null>(null);
  const [resultsOf, setResultsOf] = useState<Survey | null>(null);
  const [linksOf, setLinksOf] = useState<Survey | null>(null);

  useEffect(() => {
    setSurveys(loadSurveys());
    setResponses(loadResponses());
    setUsers(loadUsers());
    setOrgNodes(loadOrgNodes());
  }, []);

  const persist = (next: Survey[]) => { setSurveys(next); saveSurveys(next); };
  const adStaff = loadAdStaff();

  const stats = useMemo(() => ({
    total: surveys.length,
    published: surveys.filter(s => s.status === "published").length,
    draft: surveys.filter(s => s.status === "draft").length,
    closed: surveys.filter(s => s.status === "closed").length,
  }), [surveys]);

  const handleCreate = () => {
    const s = newSurvey(activeUser.id);
    s.title = "Untitled survey";
    setEditing(s);
  };

  const handleSaveSurvey = (s: Survey) => {
    const exists = surveys.find(x => x.id === s.id);
    persist(exists ? surveys.map(x => x.id === s.id ? s : x) : [...surveys, s]);
    setEditing(null);
    toast.success("Survey saved");
  };

  const handlePublish = (id: string) => {
    persist(surveys.map(s => s.id === id ? {
      ...s,
      status: "published",
      publishedAt: new Date().toISOString(),
    } : s));
    toast.success("Survey published");
  };

  const handleClose = (id: string) => {
    persist(surveys.map(s => s.id === id ? {
      ...s,
      status: "closed",
      closedAt: new Date().toISOString(),
    } : s));
    toast.success("Survey closed");
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this survey and all its responses (UI only)?")) return;
    persist(surveys.filter(s => s.id !== id));
  };

  return (
    <>
      <Helmet>
        <title>Questionnaires & Surveys · Rsolve GRC Platform</title>
        <meta name="description" content="Design and publish risk culture, governance and management surveys to internal users, all staff or external parties." />
        <link rel="canonical" href="/governance/surveys" />
      </Helmet>

      <div className="flex flex-col min-h-screen">
        <TopNav />

        <main className="flex-1 px-5 md:px-10 py-8 md:py-9">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/governance" className="hover:text-foreground">Governance Management</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">Questionnaires & Surveys</span>
          </nav>

          <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[25px] font-semibold tracking-tight text-foreground">Questionnaires & Surveys</h1>
              <p className="text-[13.5px] text-muted-foreground mt-0.5 max-w-2xl">
                Design surveys (risk culture, governance, vendor & data management, risk management) and publish to system users, all staff via Active Directory, or external parties via email.
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Viewing as <strong className="text-foreground">{activeUser.name}</strong> ({ROLE_LABELS[activeUser.role]})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/governance"><ArrowLeft className="w-4 h-4 mr-1.5" /> Back</Link>
              </Button>
              {allowed && (
                <Button size="sm" onClick={handleCreate} className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-1.5" /> New survey
                </Button>
              )}
            </div>
          </header>

          {!allowed && (
            <Card className="p-4 mb-6 border-l-4 border-l-[hsl(34_89%_61%)] bg-[hsl(34_89%_61%/0.06)]">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-[hsl(34_89%_61%)] mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Read-only view</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Only Administrators and Risk Managers can design or publish surveys. You can still view published surveys and respond to those targeted at your role.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label="Total" value={stats.total} />
            <Stat label="Draft" value={stats.draft} color="215 16% 47%" />
            <Stat label="Published" value={stats.published} color="158 53% 49%" />
            <Stat label="Closed" value={stats.closed} color="352 70% 61%" />
          </div>

          {surveys.length === 0 ? (
            <Card className="p-10 text-center">
              <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No surveys yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {allowed ? "Create your first questionnaire to assess risk culture, governance maturity or vendor controls." : "No surveys have been published yet."}
              </p>
              {allowed && (
                <Button size="sm" onClick={handleCreate}><Plus className="w-4 h-4 mr-1.5" /> New survey</Button>
              )}
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Surveys</h2>
                <Badge variant="secondary" className="text-[10px]">{surveys.length}</Badge>
              </div>
              <div className="divide-y divide-border">
                {surveys.map(s => {
                  const surveyResponses = responses.filter(r => r.surveyId === s.id && r.submittedAt);
                  const expected = expectedRespondentCount(s, users, adStaff);
                  const completion = expected > 0 ? Math.round((surveyResponses.length / expected) * 100) : 0;
                  const scores = surveyResponses.map(r => scoreResponse(s, r)).filter((v): v is number => typeof v === "number");
                  const avgScore = scores.length > 0
                    ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
                    : null;
                  return (
                    <div key={s.id} className="px-4 py-3 hover:bg-muted/20">
                      <div className="flex items-center gap-3">
                        <ClipboardList className="w-4 h-4 text-[hsl(265_88%_66%)] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{s.title || "(untitled)"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {SURVEY_CATEGORY_LABELS[s.category]} · {s.questions.length} question(s) · {SCORING_LABELS[s.scoring]}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-muted-foreground uppercase">Completion</p>
                          <p className="text-xs font-semibold text-foreground">{surveyResponses.length}/{expected || "—"} ({completion}%)</p>
                        </div>
                        {avgScore !== null && (
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-muted-foreground uppercase">Avg score</p>
                            <p className="text-xs font-semibold text-foreground">
                              {s.scoring === "maturity" ? `${avgScore} / 5` : `${avgScore}%`}
                            </p>
                          </div>
                        )}
                        <Badge variant="outline" className="text-[10px]"
                          style={{
                            background: `hsl(${SURVEY_STATUS_COLORS[s.status]} / 0.12)`,
                            borderColor: `hsl(${SURVEY_STATUS_COLORS[s.status]} / 0.4)`,
                            color: `hsl(${SURVEY_STATUS_COLORS[s.status]})`,
                          }}>
                          {SURVEY_STATUS_LABELS[s.status]}
                        </Badge>
                        <div className="flex items-center gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="View results"
                            onClick={() => setResultsOf(s)}>
                            <BarChart3 className="w-3.5 h-3.5" />
                          </Button>
                          {s.status === "published" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Share links"
                              onClick={() => setLinksOf(s)}>
                              <Link2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {allowed && s.status === "draft" && (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"
                                onClick={() => setEditing(s)}>
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-[hsl(158_53%_49%)]"
                                title="Publish"
                                onClick={() => handlePublish(s.id)}>
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {allowed && s.status === "published" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-[hsl(34_89%_61%)]" title="Close"
                              onClick={() => handleClose(s.id)}>
                              <Lock className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {allowed && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete"
                              onClick={() => handleDelete(s.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </main>
      </div>

      {/* Designer dialog */}
      {editing && (
        <SurveyDesigner
          survey={editing}
          orgNodes={orgNodes}
          onClose={() => setEditing(null)}
          onSave={handleSaveSurvey}
        />
      )}

      {/* Results dialog */}
      {resultsOf && (
        <ResultsDialog
          survey={resultsOf}
          responses={responses.filter(r => r.surveyId === resultsOf.id)}
          users={users}
          onClose={() => setResultsOf(null)}
        />
      )}

      {/* Share links dialog */}
      {linksOf && (
        <ShareLinksDialog survey={linksOf} onClose={() => setLinksOf(null)} />
      )}
    </>
  );
};

const Stat = ({ label, value, color }: { label: string; value: number; color?: string }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
      {color && <span className="w-2 h-2 rounded-full" style={{ background: `hsl(${color})` }} />}
      <span>{label}</span>
    </div>
    <p className="text-2xl font-semibold text-foreground">{value}</p>
  </Card>
);

// ============= Designer =============
interface DesignerProps {
  survey: Survey;
  orgNodes: OrgNode[];
  onClose: () => void;
  onSave: (s: Survey) => void;
}

const SurveyDesigner = ({ survey, orgNodes, onClose, onSave }: DesignerProps) => {
  const [draft, setDraft] = useState<Survey>(survey);
  const [openQ, setOpenQ] = useState<string | null>(null);

  const update = (patch: Partial<Survey>) => setDraft(d => ({ ...d, ...patch }));

  const addQuestion = () => {
    const q = newQuestion();
    setDraft(d => ({ ...d, questions: [...d.questions, q] }));
    setOpenQ(q.id);
  };

  const updateQuestion = (id: string, patch: Partial<Question>) =>
    setDraft(d => ({ ...d, questions: d.questions.map(q => q.id === id ? { ...q, ...patch } : q) }));

  const removeQuestion = (id: string) =>
    setDraft(d => ({ ...d, questions: d.questions.filter(q => q.id !== id) }));

  const moveQuestion = (id: string, dir: -1 | 1) => {
    const idx = draft.questions.findIndex(q => q.id === id);
    if (idx < 0) return;
    const next = [...draft.questions];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setDraft(d => ({ ...d, questions: next }));
  };

  // Audience helpers
  const findAudience = (type: AudienceType) => draft.audiences.find(a => a.type === type);
  const setAudience = (type: AudienceType, values: string[]) => {
    setDraft(d => {
      const others = d.audiences.filter(a => a.type !== type);
      if (values.length === 0) return { ...d, audiences: others };
      return { ...d, audiences: [...others, { type, values }] };
    });
  };

  const orgPickList = orgNodes.filter(n => n.type !== "process" && n.type !== "subprocess");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{survey.id ? "Edit survey" : "New survey"}</DialogTitle>
        </DialogHeader>

        {/* Meta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Title</Label>
            <Input value={draft.title} onChange={e => update({ title: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Description</Label>
            <Textarea rows={2} value={draft.description ?? ""} onChange={e => update({ description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={draft.category} onValueChange={v => update({ category: v as SurveyCategory })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SURVEY_CATEGORY_LABELS) as SurveyCategory[]).map(c => (
                  <SelectItem key={c} value={c}>{SURVEY_CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Scoring model</Label>
            <Select value={draft.scoring} onValueChange={v => update({ scoring: v as ScoringModel })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SCORING_LABELS) as ScoringModel[]).map(s => (
                  <SelectItem key={s} value={s}>{SCORING_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Due date (optional)</Label>
            <Input type="date" value={draft.dueDate ?? ""} onChange={e => update({ dueDate: e.target.value })} />
          </div>
        </div>

        {/* Questions */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Questions ({draft.questions.length})</h3>
            <Button size="sm" variant="outline" onClick={addQuestion}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add question
            </Button>
          </div>
          {draft.questions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-2 py-3">No questions yet.</p>
          ) : (
            <div className="space-y-2">
              {draft.questions.map((q, idx) => (
                <Card key={q.id} className="p-3">
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-muted text-[11px] font-semibold inline-flex items-center justify-center text-foreground shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Input
                        placeholder="Question text…"
                        value={q.text}
                        onChange={e => updateQuestion(q.id, { text: e.target.value })}
                        className="h-8 text-sm"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <Select value={q.type} onValueChange={v => {
                          const newType = v as QuestionType;
                          // reset options if switching to text/scale; ensure yes/no defaults
                          let options = q.options;
                          if (newType === "text" || newType === "scale") options = [];
                          if (newType === "yes_no") options = [
                            { id: "yes", label: "Yes", score: 1 },
                            { id: "no", label: "No", score: 0 },
                          ];
                          if ((newType === "single" || newType === "multi") && options.length === 0) {
                            options = [newOption(), newOption()];
                          }
                          updateQuestion(q.id, { type: newType, options });
                        }}>
                          <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(t => (
                              <SelectItem key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Checkbox checked={q.required} onCheckedChange={v => updateQuestion(q.id, { required: !!v })} />
                          Required
                        </label>
                        {draft.scoring === "weighted" && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            Weight
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={q.weight}
                              onChange={e => updateQuestion(q.id, { weight: Number(e.target.value) || 0 })}
                              className="h-7 w-16 text-xs"
                            />
                          </div>
                        )}
                        <div className="ml-auto flex items-center gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveQuestion(q.id, -1)} disabled={idx === 0}>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveQuestion(q.id, 1)} disabled={idx === draft.questions.length - 1}>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeQuestion(q.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {(q.type === "single" || q.type === "multi" || q.type === "yes_no") && q.options.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {q.options.map(opt => (
                            <div key={opt.id} className="flex items-center gap-1.5">
                              <Input
                                placeholder="Option label"
                                value={opt.label}
                                onChange={e => updateQuestion(q.id, {
                                  options: q.options.map(o => o.id === opt.id ? { ...o, label: e.target.value } : o),
                                })}
                                className="h-7 text-xs flex-1"
                                disabled={q.type === "yes_no"}
                              />
                              {draft.scoring === "weighted" && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  Score
                                  <Input
                                    type="number" min={0} max={1} step={0.1}
                                    value={opt.score ?? 0}
                                    onChange={e => updateQuestion(q.id, {
                                      options: q.options.map(o => o.id === opt.id ? { ...o, score: Number(e.target.value) } : o),
                                    })}
                                    className="h-7 w-16 text-xs"
                                  />
                                </div>
                              )}
                              {q.type !== "yes_no" && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                  onClick={() => updateQuestion(q.id, {
                                    options: q.options.filter(o => o.id !== opt.id),
                                  })}>
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {q.type !== "yes_no" && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                              onClick={() => updateQuestion(q.id, { options: [...q.options, newOption()] })}>
                              <Plus className="w-3 h-3 mr-1" /> Add option
                            </Button>
                          )}
                        </div>
                      )}

                      {q.type === "scale" && (
                        <p className="text-[10px] text-muted-foreground mt-2 italic">Respondents pick 1–5 (1 = strongly disagree, 5 = strongly agree).</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Audiences */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground mb-2 inline-flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Audiences
          </h3>
          <div className="space-y-3">
            {/* Roles */}
            <Card className="p-3">
              <p className="text-xs font-semibold text-foreground mb-2">{AUDIENCE_LABELS.roles}</p>
              <div className="flex flex-wrap gap-2">
                {ROLES.map(r => {
                  const aud = findAudience("roles");
                  const checked = aud?.values.includes(r) ?? false;
                  return (
                    <label key={r} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 border border-border rounded">
                      <Checkbox checked={checked} onCheckedChange={v => {
                        const current = aud?.values ?? [];
                        const next = v ? [...current, r] : current.filter(x => x !== r);
                        setAudience("roles", next);
                      }} />
                      {ROLE_LABELS[r]}
                    </label>
                  );
                })}
              </div>
            </Card>

            {/* AD all staff */}
            <Card className="p-3">
              <label className="inline-flex items-center gap-2 text-xs">
                <Checkbox
                  checked={!!findAudience("ad_all_staff")}
                  onCheckedChange={v => setAudience("ad_all_staff", v ? ["all"] : [])}
                />
                <span className="font-semibold text-foreground">{AUDIENCE_LABELS.ad_all_staff}</span>
                <span className="text-muted-foreground">(mock directory — {loadAdStaff().length} staff)</span>
              </label>
            </Card>

            {/* External emails */}
            <Card className="p-3">
              <p className="text-xs font-semibold text-foreground mb-2 inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {AUDIENCE_LABELS.external}
              </p>
              <ExternalEmailsEditor
                values={findAudience("external")?.values ?? []}
                onChange={v => setAudience("external", v)}
              />
            </Card>

            {/* Org units */}
            <Card className="p-3">
              <p className="text-xs font-semibold text-foreground mb-2 inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> {AUDIENCE_LABELS.org_units}
              </p>
              {orgPickList.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No org units defined yet. Add them in Risk Governance.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {orgPickList.map(n => {
                    const aud = findAudience("org_units");
                    const checked = aud?.values.includes(n.id) ?? false;
                    return (
                      <label key={n.id} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 border border-border rounded">
                        <Checkbox checked={checked} onCheckedChange={v => {
                          const current = aud?.values ?? [];
                          const next = v ? [...current, n.id] : current.filter(x => x !== n.id);
                          setAudience("org_units", next);
                        }} />
                        <span className="text-muted-foreground">{ORG_TYPE_LABELS[n.type]}:</span>
                        <span className="text-foreground">{n.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)} className="bg-primary hover:bg-primary/90">
            Save survey
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ExternalEmailsEditor = ({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) => {
  const [input, setInput] = useState("");
  const add = () => {
    const trimmed = input.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email");
      return;
    }
    if (values.includes(trimmed)) return;
    onChange([...values, trimmed]);
    setInput("");
  };
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Input placeholder="email@example.com" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="h-8 text-xs" />
        <Button size="sm" variant="outline" onClick={add}>Add</Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map(v => (
            <Badge key={v} variant="secondary" className="text-[11px] gap-1">
              {v}
              <button onClick={() => onChange(values.filter(x => x !== v))} aria-label="Remove">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

// ============= Results =============
const ResultsDialog = ({ survey, responses, users, onClose }: {
  survey: Survey; responses: SurveyResponse[]; users: AppUser[]; onClose: () => void;
}) => {
  const submitted = responses.filter(r => r.submittedAt);
  const inProgress = responses.filter(r => !r.submittedAt);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Results — {survey.title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Stat label="Submitted" value={submitted.length} color="158 53% 49%" />
          <Stat label="In progress" value={inProgress.length} color="34 89% 61%" />
          <Stat label="Avg score" value={
            submitted.length === 0 ? 0 : Number((
              submitted.map(r => scoreResponse(survey, r) ?? 0).reduce((a, b) => a + b, 0) / submitted.length
            ).toFixed(1))
          } />
        </div>
        {submitted.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-6">No submissions yet.</p>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Respondent</th>
                  <th className="text-left px-3 py-2 font-medium">Channel</th>
                  <th className="text-left px-3 py-2 font-medium">Submitted</th>
                  <th className="text-right px-3 py-2 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submitted.map(r => {
                  const score = scoreResponse(survey, r);
                  const name = r.respondentName ?? (r.channel === "internal_user"
                    ? users.find(u => u.id === r.respondentRef)?.name ?? r.respondentRef
                    : r.respondentRef);
                  return (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-3 py-2 text-foreground">{name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.channel}</td>
                      <td className="px-3 py-2 text-muted-foreground">{new Date(r.submittedAt!).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-medium text-foreground">
                        {score === undefined ? "—" : survey.scoring === "maturity" ? `${score} / 5` : `${score}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ============= Share Links =============
const ShareLinksDialog = ({ survey, onClose }: { survey: Survey; onClose: () => void }) => {
  const internalUrl = `${window.location.origin}/surveys/${survey.id}/respond`;
  const external = survey.audiences.find(a => a.type === "external")?.values ?? [];

  const externalLinks = external.map(email => {
    // generate stable token derived from email + survey id (for prototype)
    const token = btoa(`${survey.id}:${email}`).replace(/=/g, "").slice(0, 12);
    return {
      email,
      url: `${window.location.origin}/surveys/${survey.id}/respond?token=${token}&email=${encodeURIComponent(email)}`,
    };
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Link copied");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share — {survey.title}</DialogTitle>
        </DialogHeader>
        <Card className="p-3 mb-3">
          <p className="text-xs font-semibold text-foreground mb-1">Internal link</p>
          <p className="text-[11px] text-muted-foreground mb-2">For logged-in system users targeted by role or org unit.</p>
          <div className="flex gap-2">
            <Input value={internalUrl} readOnly className="h-8 text-xs" />
            <Button size="sm" variant="outline" onClick={() => copy(internalUrl)}>
              <Copy className="w-3.5 h-3.5 mr-1" /> Copy
            </Button>
          </div>
        </Card>

        {externalLinks.length > 0 && (
          <Card className="p-3">
            <p className="text-xs font-semibold text-foreground mb-2 inline-flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> External party links
            </p>
            <div className="space-y-1.5">
              {externalLinks.map(l => (
                <div key={l.email} className="flex items-center gap-2">
                  <span className="text-xs text-foreground w-48 truncate">{l.email}</span>
                  <Input value={l.url} readOnly className="h-7 text-[11px] flex-1" />
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copy(l.url)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SurveyManagement;
