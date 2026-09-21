import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ORG_TYPE_LABELS, type OrgNode } from "@/data/orgStore";
import {
  AUDIENCE_LABELS,
  QUESTION_TYPE_LABELS,
  SCORING_LABELS,
  SURVEY_CATEGORY_LABELS,
  loadAdStaff,
  newOption,
  newQuestion,
  type AudienceType,
  type Question,
  type QuestionType,
  type ScoringModel,
  type Survey,
  type SurveyCategory,
} from "@/data/surveyStore";
import { ROLE_LABELS, type UserRole } from "@/data/userStore";
import { QuestionField } from "./QuestionField";
import {
  changeQuestionType,
  isValidEmail,
  moveById,
  setAudienceValues,
  toggleValue,
} from "./survey-logic";

const ROLES: UserRole[] = ["admin", "input_user", "approver", "risk_manager", "executive"];

interface SurveyDesignerProps {
  survey: Survey;
  isNew: boolean;
  orgNodes: OrgNode[];
  onClose: () => void;
  onSave: (survey: Survey) => void;
}

function QuestionEditor({
  question: q,
  index,
  total,
  weighted,
  onChange,
  onMove,
  onRemove,
}: {
  question: Question;
  index: number;
  total: number;
  weighted: boolean;
  onChange: (patch: Partial<Question>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const hasOptions = q.type === "single" || q.type === "multi" || q.type === "yes_no";
  const editableOptions = q.type !== "yes_no";

  return (
    <Card className="p-3 shadow-none">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-navy-deep">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <Input
            placeholder="Question text…"
            aria-label={`Question ${index + 1} text`}
            value={q.text}
            onChange={(e) => onChange({ text: e.target.value })}
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Select value={q.type} onValueChange={(v) => onChange(changeQuestionType(q, v as QuestionType))}>
              <SelectTrigger className="h-8 w-40 text-xs" aria-label={`Question ${index + 1} type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Checkbox
                id={`${q.id}-required`}
                checked={q.required}
                onCheckedChange={(v) => onChange({ required: v === true })}
              />
              <Label htmlFor={`${q.id}-required`} className="text-xs font-normal text-muted-foreground">
                Required
              </Label>
            </div>

            {weighted && (
              <div className="flex items-center gap-2">
                <Label htmlFor={`${q.id}-weight`} className="text-xs font-normal text-muted-foreground">
                  Weight
                </Label>
                <Input
                  id={`${q.id}-weight`}
                  type="number"
                  min={0}
                  step={0.5}
                  value={q.weight}
                  onChange={(e) => onChange({ weight: Number(e.target.value) || 0 })}
                  className="h-8 w-16 text-xs"
                />
              </div>
            )}

            <div className="ml-auto flex items-center">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Move question up" onClick={() => onMove(-1)} disabled={index === 0}>
                <ChevronUp />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Move question down" onClick={() => onMove(1)} disabled={index === total - 1}>
                <ChevronDown />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Remove question" onClick={onRemove}>
                <Trash2 />
              </Button>
            </div>
          </div>

          {hasOptions && q.options.length > 0 && (
            <div className="space-y-2">
              {q.options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <Input
                    placeholder="Option label"
                    aria-label="Option label"
                    value={opt.label}
                    disabled={!editableOptions}
                    onChange={(e) =>
                      onChange({ options: q.options.map((o) => (o.id === opt.id ? { ...o, label: e.target.value } : o)) })
                    }
                    className="h-8 flex-1 text-xs"
                  />
                  {weighted && (
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      aria-label="Option score"
                      value={opt.score ?? 0}
                      onChange={(e) =>
                        onChange({ options: q.options.map((o) => (o.id === opt.id ? { ...o, score: Number(e.target.value) } : o)) })
                      }
                      className="h-8 w-16 text-xs"
                    />
                  )}
                  {editableOptions && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label="Remove option"
                      onClick={() => onChange({ options: q.options.filter((o) => o.id !== opt.id) })}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              ))}
              {editableOptions && (
                <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onChange({ options: [...q.options, newOption()] })}>
                  <Plus /> Add option
                </Button>
              )}
            </div>
          )}

          {q.type === "scale" && (
            <p className="text-xs text-muted-foreground">Respondents pick 1–5 (1 = strongly disagree, 5 = strongly agree).</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function ExternalEmails({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const [input, setInput] = useState("");

  const add = () => {
    const email = input.trim();
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email");
      return;
    }
    if (!values.includes(email)) onChange([...values, email]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="email@example.com"
          aria-label="External email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-9 text-sm"
        />
        <Button type="button" variant="outline" onClick={add}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 text-[11px] font-normal">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipCheckbox({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="cursor-pointer text-xs font-normal">
        {children}
      </Label>
    </div>
  );
}

export function SurveyDesigner({ survey, isNew, orgNodes, onClose, onSave }: SurveyDesignerProps) {
  const [draft, setDraft] = useState<Survey>(survey);
  const update = (patch: Partial<Survey>) => setDraft((d) => ({ ...d, ...patch }));

  const updateQuestion = (id: string, patch: Partial<Question>) =>
    setDraft((d) => ({ ...d, questions: d.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }));

  const audience = (type: AudienceType) => draft.audiences.find((a) => a.type === type)?.values ?? [];
  const setAudience = (type: AudienceType, values: string[]) =>
    setDraft((d) => ({ ...d, audiences: setAudienceValues(d.audiences, type, values) }));

  const orgPickList = orgNodes.filter((n) => n.type !== "process" && n.type !== "subprocess");
  const weighted = draft.scoring === "weighted";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "New survey" : "Edit survey"}</DialogTitle>
          <DialogDescription>Design the questions, choose who receives it, then preview it as a respondent.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="questions">
          <TabsList>
            <TabsTrigger value="questions">Questions ({draft.questions.length})</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="mt-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="survey-title">Title</Label>
                <Input id="survey-title" value={draft.title} onChange={(e) => update({ title: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="survey-description">Description</Label>
                <Textarea id="survey-description" rows={2} value={draft.description ?? ""} onChange={(e) => update({ description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="survey-category">Category</Label>
                <Select value={draft.category} onValueChange={(v) => update({ category: v as SurveyCategory })}>
                  <SelectTrigger id="survey-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SURVEY_CATEGORY_LABELS) as SurveyCategory[]).map((c) => (
                      <SelectItem key={c} value={c}>{SURVEY_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="survey-scoring">Scoring model</Label>
                <Select value={draft.scoring} onValueChange={(v) => update({ scoring: v as ScoringModel })}>
                  <SelectTrigger id="survey-scoring"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SCORING_LABELS) as ScoringModel[]).map((s) => (
                      <SelectItem key={s} value={s}>{SCORING_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="survey-due">Due date (optional)</Label>
                <Input id="survey-due" type="date" value={draft.dueDate ?? ""} onChange={(e) => update({ dueDate: e.target.value })} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-navy-deep">Questions</h3>
                <Button type="button" size="sm" variant="outline" onClick={() => setDraft((d) => ({ ...d, questions: [...d.questions, newQuestion()] }))}>
                  <Plus /> Add question
                </Button>
              </div>
              {draft.questions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  No questions yet.
                </p>
              ) : (
                draft.questions.map((q, idx) => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    index={idx}
                    total={draft.questions.length}
                    weighted={weighted}
                    onChange={(patch) => updateQuestion(q.id, patch)}
                    onMove={(dir) => setDraft((d) => ({ ...d, questions: moveById(d.questions, q.id, dir) }))}
                    onRemove={() => setDraft((d) => ({ ...d, questions: d.questions.filter((x) => x.id !== q.id) }))}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="audience" className="mt-4 space-y-3">
            <Card className="space-y-3 p-4 shadow-none">
              <p className="text-sm font-semibold text-navy-deep">{AUDIENCE_LABELS.roles}</p>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <ChipCheckbox key={r} id={`aud-role-${r}`} checked={audience("roles").includes(r)} onChange={(on) => setAudience("roles", toggleValue(audience("roles"), r, on))}>
                    {ROLE_LABELS[r]}
                  </ChipCheckbox>
                ))}
              </div>
            </Card>

            <Card className="p-4 shadow-none">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="aud-ad"
                  checked={audience("ad_all_staff").length > 0}
                  onCheckedChange={(v) => setAudience("ad_all_staff", v === true ? ["all"] : [])}
                />
                <Label htmlFor="aud-ad" className="cursor-pointer text-sm font-semibold text-navy-deep">
                  {AUDIENCE_LABELS.ad_all_staff}
                </Label>
                <span className="text-xs text-muted-foreground">mock directory · {loadAdStaff().length} staff</span>
              </div>
            </Card>

            <Card className="space-y-3 p-4 shadow-none">
              <p className="text-sm font-semibold text-navy-deep">{AUDIENCE_LABELS.external}</p>
              <ExternalEmails values={audience("external")} onChange={(v) => setAudience("external", v)} />
            </Card>

            <Card className="space-y-3 p-4 shadow-none">
              <p className="text-sm font-semibold text-navy-deep">{AUDIENCE_LABELS.org_units}</p>
              {orgPickList.length === 0 ? (
                <p className="text-xs text-muted-foreground">No org units defined yet. Add them in Risk Governance.</p>
              ) : (
                <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                  {orgPickList.map((n) => (
                    <ChipCheckbox key={n.id} id={`aud-org-${n.id}`} checked={audience("org_units").includes(n.id)} onChange={(on) => setAudience("org_units", toggleValue(audience("org_units"), n.id, on))}>
                      <span className="text-muted-foreground">{ORG_TYPE_LABELS[n.type]}:</span> {n.name}
                    </ChipCheckbox>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            <Card className="space-y-5 p-5 shadow-none">
              <div>
                <h3 className="text-lg font-semibold text-navy-deep">{draft.title || "(untitled survey)"}</h3>
                {draft.description && <p className="mt-1 text-sm text-muted-foreground">{draft.description}</p>}
              </div>
              {draft.questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add questions to see the preview.</p>
              ) : (
                <ol className="space-y-6">
                  {draft.questions.map((q, idx) => (
                    <li key={q.id}>
                      <QuestionField question={q} index={idx} value={null} onChange={() => {}} readOnly />
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="brand" onClick={() => onSave(draft)}>Save survey</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
