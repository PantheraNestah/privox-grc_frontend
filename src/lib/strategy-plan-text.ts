/**
 * Helpers for the JSON plan editor: parsing with a usable error location,
 * pretty-printing, and a starter plan. Kept free of React so it can be tested
 * directly.
 */

export interface PlanParseError {
  message: string;
  /** 1-based, when the parser reports where it failed. */
  line?: number;
  column?: number;
}

export type PlanParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: PlanParseError };

/** Browsers report the failure as "... at position N" (and sometimes "(line L column C)"). */
export function parsePlanText(text: string): PlanParseResult {
  if (!text.trim()) return { ok: false, error: { message: "Empty" } };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    const explicit = /line (\d+) column (\d+)/i.exec(message);
    if (explicit) {
      return {
        ok: false,
        error: { message: cleanMessage(message), line: Number(explicit[1]), column: Number(explicit[2]) },
      };
    }
    const position = /position (\d+)/i.exec(message);
    if (position) {
      const { line, column } = lineColumnAt(text, Number(position[1]));
      return { ok: false, error: { message: cleanMessage(message), line, column } };
    }
    // Some engines do not say where the error is. Find it ourselves.
    const found = findJsonError(text);
    if (found) {
      const { line, column } = lineColumnAt(text, found.offset);
      return { ok: false, error: { message: found.message, line, column } };
    }
    return { ok: false, error: { message: cleanMessage(message) } };
  }
}

/**
 * Locates the first syntax error in JSON text: the offset and a short
 * description of what was expected. Returns null when the text is valid.
 * A small scanner, so the location is the same in every browser.
 */
export function findJsonError(text: string): { offset: number; message: string } | null {
  let i = 0;
  const fail = (message: string): never => {
    throw { offset: i, message };
  };
  const skip = () => {
    while (i < text.length && " \t\n\r".includes(text[i])) i += 1;
  };
  const expectChar = (char: string, what: string) => {
    skip();
    if (text[i] !== char) fail(`Expected ${what}`);
    i += 1;
  };
  const value = (): void => {
    skip();
    const ch = text[i];
    if (ch === "{") return object();
    if (ch === "[") return array();
    if (ch === '"') return string();
    if (ch === "-" || (ch >= "0" && ch <= "9")) return number();
    for (const literal of ["true", "false", "null"]) {
      if (text.startsWith(literal, i)) {
        i += literal.length;
        return;
      }
    }
    fail(ch === undefined ? "Unexpected end of input" : `Unexpected '${ch}'`);
  };
  const string = () => {
    i += 1;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        i += 1;
        return;
      }
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "\n") fail("Line break inside a string");
      i += 1;
    }
    fail("Unclosed string");
  };
  const number = () => {
    const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!match) fail("Invalid number");
    i += match![0].length;
  };
  const object = () => {
    i += 1;
    skip();
    if (text[i] === "}") {
      i += 1;
      return;
    }
    for (;;) {
      skip();
      if (text[i] !== '"') fail("Expected a property name in double quotes");
      string();
      expectChar(":", "':' after the property name");
      value();
      skip();
      if (text[i] === ",") {
        i += 1;
        continue;
      }
      if (text[i] === "}") {
        i += 1;
        return;
      }
      fail("Expected ',' or '}'");
    }
  };
  const array = () => {
    i += 1;
    skip();
    if (text[i] === "]") {
      i += 1;
      return;
    }
    for (;;) {
      value();
      skip();
      if (text[i] === ",") {
        i += 1;
        continue;
      }
      if (text[i] === "]") {
        i += 1;
        return;
      }
      fail("Expected ',' or ']'");
    }
  };
  try {
    value();
    skip();
    if (i < text.length) fail("Unexpected text after the end of the plan");
    return null;
  } catch (error) {
    if (typeof error === "object" && error !== null && "offset" in error) {
      return error as { offset: number; message: string };
    }
    throw error;
  }
}

/** Drops the engine's position suffix so the message reads on its own. */
function cleanMessage(message: string): string {
  return message.replace(/\s*in JSON at position \d+.*$/i, "").replace(/\s*\(line \d+ column \d+\)$/i, "").trim();
}

/** 1-based line and column for a character offset. */
export function lineColumnAt(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, offset));
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/** Pretty-prints a valid plan with two-space indentation. */
export function formatPlanText(text: string): string | null {
  const parsed = parsePlanText(text);
  return parsed.ok ? JSON.stringify(parsed.value, null, 2) : null;
}

/**
 * A small plan to start from. "Head Office" is a placeholder: the check
 * reports it until you replace it with a unit in your organization.
 */
export const SAMPLE_PLAN = `{
  "name": "FY27 strategy",
  "elements": [
    {
      "type": "PILLAR",
      "code": "P1",
      "title": "Customer trust",
      "children": [
        {
          "type": "OBJECTIVE",
          "code": "P1.O1",
          "title": "Faster claims",
          "orgNode": "Head Office",
          "children": [
            {
              "type": "INITIATIVE",
              "code": "P1.O1.I1",
              "title": "Claims digital intake",
              "children": [
                {
                  "type": "KPI",
                  "code": "P1.O1.I1.K1",
                  "title": "Median days to settle",
                  "targetValue": 7,
                  "baselineValue": 21,
                  "unit": "days",
                  "direction": "LOWER_IS_BETTER"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
`;
