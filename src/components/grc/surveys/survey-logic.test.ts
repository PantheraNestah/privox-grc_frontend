import { newQuestion, type Survey, type SurveyResponse } from "@/data/surveyStore";
import {
  averageScore,
  changeQuestionType,
  firstMissingRequired,
  formatScore,
  isAnswerEmpty,
  isValidEmail,
  moveById,
  setAudienceValues,
  toggleValue,
  upsertAnswer,
} from "./survey-logic";

const response = (answers: SurveyResponse["answers"] = []): SurveyResponse =>
  ({ id: "r", surveyId: "s", channel: "internal_user", respondentRef: "u", answers }) as SurveyResponse;

describe("survey-logic", () => {
  it("seeds and clears options when the question type changes", () => {
    const q = newQuestion();
    expect(changeQuestionType({ ...q, options: [] }, "single").options).toHaveLength(2);
    expect(changeQuestionType(q, "yes_no").options.map((o) => o.id)).toEqual(["yes", "no"]);
    expect(changeQuestionType(q, "text").options).toEqual([]);
    expect(changeQuestionType(q, "scale").options).toEqual([]);
  });

  it("moves items within bounds only", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(moveById(list, "b", -1).map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(moveById(list, "a", -1)).toBe(list);
    expect(moveById(list, "c", 1)).toBe(list);
  });

  it("replaces or removes an audience by type", () => {
    const base = [{ type: "roles" as const, values: ["admin"] }];
    expect(setAudienceValues(base, "external", ["a@b.co"])).toHaveLength(2);
    expect(setAudienceValues(base, "roles", [])).toEqual([]);
    expect(setAudienceValues(base, "roles", ["admin", "approver"])[0].values).toHaveLength(2);
  });

  it("toggles values without duplicating", () => {
    expect(toggleValue(["a"], "a", true)).toEqual(["a"]);
    expect(toggleValue(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleValue(["a", "b"], "a", false)).toEqual(["b"]);
  });

  it("treats blank strings, empty arrays and null as unanswered", () => {
    expect(isAnswerEmpty(null)).toBe(true);
    expect(isAnswerEmpty("  ")).toBe(true);
    expect(isAnswerEmpty([])).toBe(true);
    expect(isAnswerEmpty(0 as never)).toBe(false);
    expect(isAnswerEmpty("x")).toBe(false);
  });

  it("upserts answers immutably", () => {
    const r = response([{ questionId: "q1", value: "a" }]);
    expect(upsertAnswer(r, "q1", "b").answers).toEqual([{ questionId: "q1", value: "b" }]);
    expect(upsertAnswer(r, "q2", 3).answers).toHaveLength(2);
    expect(r.answers[0].value).toBe("a");
  });

  it("finds the first missing required question", () => {
    const required = { ...newQuestion(), id: "q1", required: true, text: "One" };
    const optional = { ...newQuestion(), id: "q2", required: false };
    const survey = { questions: [optional, required] } as Survey;
    expect(firstMissingRequired(survey, response())?.id).toBe("q1");
    expect(firstMissingRequired(survey, response([{ questionId: "q1", value: "x" }]))).toBeUndefined();
  });

  it("validates emails, formats and averages scores", () => {
    expect(isValidEmail(" a@b.co ")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(formatScore("maturity", 3.5)).toBe("3.5 / 5");
    expect(formatScore("weighted", 80)).toBe("80%");
    expect(averageScore([])).toBeNull();
    expect(averageScore([1, 2])).toBe(1.5);
  });
});
