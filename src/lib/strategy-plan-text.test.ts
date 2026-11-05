import { SAMPLE_PLAN, findJsonError, formatPlanText, lineColumnAt, parsePlanText } from "./strategy-plan-text";

describe("parsePlanText", () => {
  it("returns the parsed value for valid JSON", () => {
    expect(parsePlanText('{"elements":[]}')).toEqual({ ok: true, value: { elements: [] } });
  });

  it("reports the line and column of a syntax error", () => {
    const result = parsePlanText('{\n  "elements": [\n    }\n  ]\n}');
    expect(result.ok).toBe(false);
    if (result.ok === true) return;
    expect(result.error.line).toBeGreaterThan(0);
    expect(result.error.column).toBeGreaterThan(0);
    expect(result.error.message).not.toMatch(/position \d+/);
  });

  it("treats blank text as empty, not as an error to show", () => {
    const result = parsePlanText("   ");
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error.message).toBe("Empty");
  });
});

describe("lineColumnAt", () => {
  it("converts an offset into a 1-based line and column", () => {
    expect(lineColumnAt("ab\ncd", 0)).toEqual({ line: 1, column: 1 });
    expect(lineColumnAt("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
  });
});

describe("formatPlanText", () => {
  it("pretty-prints with two-space indentation", () => {
    expect(formatPlanText('{"a":[1,2]}')).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
  });

  it("returns null for text that is not JSON, so pastes stay untouched", () => {
    expect(formatPlanText("not json")).toBeNull();
  });
});

describe("SAMPLE_PLAN", () => {
  it("is a valid plan with the pillar, objective and KPI levels", () => {
    const parsed = parsePlanText(SAMPLE_PLAN);
    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) return;
    const plan = parsed.value as { elements: Array<{ type: string; children?: Array<{ type: string }> }> };
    expect(plan.elements[0].type).toBe("PILLAR");
    expect(plan.elements[0].children?.[0].type).toBe("OBJECTIVE");
  });
});

describe("findJsonError", () => {
  it("returns null for valid JSON", () => {
    expect(findJsonError('{"a":[1,true,null,"x\\"y"]}')).toBeNull();
  });

  it("points at the character that breaks the document", () => {
    const text = '{\n  "a": 1\n  "b": 2\n}';
    const found = findJsonError(text);
    expect(found).not.toBeNull();
    expect(text[found!.offset]).toBe('"');
    expect(found!.message).toMatch(/','|'\\}'/);
  });

  it("reports an unclosed string at its opening position", () => {
    expect(findJsonError('{"a": "oops')!.message).toBe("Unclosed string");
  });
});
