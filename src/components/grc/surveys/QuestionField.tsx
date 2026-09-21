import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { Question, SurveyAnswer } from "@/data/surveyStore";
import { cn } from "@/lib/utils";

type AnswerValue = SurveyAnswer["value"];

interface QuestionFieldProps {
  question: Question;
  index: number;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  /** Preview mode: renders inputs but ignores interaction. */
  readOnly?: boolean;
}

/** One survey question with its answer control; shared by the respondent page and the designer preview. */
export function QuestionField({ question: q, index, value, onChange, readOnly }: QuestionFieldProps) {
  const groupName = `${q.id}-group`;
  const selected = Array.isArray(value) ? value : [];

  return (
    <fieldset className="space-y-3" disabled={readOnly}>
      <legend className="text-sm font-medium text-foreground">
        <span className="mr-1.5 text-muted-foreground">{index + 1}.</span>
        {q.text || "(untitled question)"}
        {q.required && (
          <span className="ml-1 text-destructive" aria-label="required">
            *
          </span>
        )}
      </legend>

      {q.type === "text" && (
        <Textarea
          rows={3}
          aria-label={q.text || `Question ${index + 1}`}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {(q.type === "single" || q.type === "yes_no") && (
        <RadioGroup
          name={groupName}
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
          className="gap-2.5"
        >
          {q.options.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <RadioGroupItem value={o.id} id={`${q.id}-${o.id}`} />
              <Label htmlFor={`${q.id}-${o.id}`} className="cursor-pointer font-normal">
                {o.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {q.type === "multi" && (
        <div className="space-y-2.5">
          {q.options.map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <Checkbox
                id={`${q.id}-${o.id}`}
                checked={selected.includes(o.id)}
                onCheckedChange={(on) =>
                  onChange(on ? [...selected, o.id] : selected.filter((x) => x !== o.id))
                }
              />
              <Label htmlFor={`${q.id}-${o.id}`} className="cursor-pointer font-normal">
                {o.label}
              </Label>
            </div>
          ))}
        </div>
      )}

      {q.type === "scale" && (
        <div className="space-y-2">
          <div role="radiogroup" aria-label={q.text || `Question ${index + 1}`} className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                type="button"
                role="radio"
                aria-checked={value === n}
                size="icon"
                variant={value === n ? "default" : "outline"}
                className={cn("rounded-full", value !== n && "text-foreground")}
                onClick={() => onChange(n)}
              >
                {n}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">1 = strongly disagree · 5 = strongly agree</p>
        </div>
      )}
    </fieldset>
  );
}
