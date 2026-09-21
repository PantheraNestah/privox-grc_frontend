import {
  newOption,
  type Question,
  type QuestionType,
  type Survey,
  type SurveyAnswer,
  type SurveyAudience,
  type AudienceType,
  type SurveyResponse,
} from "@/data/surveyStore";

type AnswerValue = SurveyAnswer["value"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string) => EMAIL.test(value.trim());

/** Switching type resets options the new type can't use and seeds the ones it needs. */
export function changeQuestionType(question: Question, type: QuestionType): Question {
  let options = question.options;
  if (type === "text" || type === "scale") options = [];
  if (type === "yes_no") {
    options = [
      { id: "yes", label: "Yes", score: 1 },
      { id: "no", label: "No", score: 0 },
    ];
  }
  if ((type === "single" || type === "multi") && options.length === 0) {
    options = [newOption(), newOption()];
  }
  return { ...question, type, options };
}

/** Swaps an item with its neighbour; returns the same array when the move is out of range. */
export function moveById<T extends { id: string }>(items: T[], id: string, direction: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Sets (or, when `values` is empty, removes) one audience type. */
export function setAudienceValues(
  audiences: SurveyAudience[],
  type: AudienceType,
  values: string[],
): SurveyAudience[] {
  const others = audiences.filter((audience) => audience.type !== type);
  return values.length === 0 ? others : [...others, { type, values }];
}

export const toggleValue = (values: string[], value: string, on: boolean) =>
  on ? (values.includes(value) ? values : [...values, value]) : values.filter((v) => v !== value);

export function isAnswerEmpty(value: AnswerValue | undefined): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function getAnswer(response: SurveyResponse | null, questionId: string): AnswerValue {
  return response?.answers.find((a) => a.questionId === questionId)?.value ?? null;
}

export function upsertAnswer(
  response: SurveyResponse,
  questionId: string,
  value: AnswerValue,
): SurveyResponse {
  const exists = response.answers.some((a) => a.questionId === questionId);
  return {
    ...response,
    answers: exists
      ? response.answers.map((a) => (a.questionId === questionId ? { ...a, value } : a))
      : [...response.answers, { questionId, value }],
  };
}

/** First required question without an answer, or undefined when the response is complete. */
export function firstMissingRequired(survey: Survey, response: SurveyResponse): Question | undefined {
  return survey.questions.find((q) => q.required && isAnswerEmpty(getAnswer(response, q.id)));
}

export function formatScore(scoring: Survey["scoring"], score: number): string {
  return scoring === "maturity" ? `${score} / 5` : `${score}%`;
}

export function averageScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
}
