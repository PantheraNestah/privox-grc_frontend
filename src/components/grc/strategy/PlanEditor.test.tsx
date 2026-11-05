import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanEditor, PlanPreview } from "./PlanEditor";
import { parsePlanText } from "@/lib/strategy-plan-text";

function Harness({ initial = "" }: { initial?: string }) {
  const [text, setText] = useState(initial);
  return <PlanEditor value={text} onChange={setText} parsed={text.trim() ? parsePlanText(text) : null} />;
}

const area = () => screen.getByLabelText("Plan JSON") as HTMLTextAreaElement;

describe("PlanEditor keys", () => {
  it("Tab inserts two spaces instead of moving focus", () => {
    render(<Harness initial="{" />);
    area().setSelectionRange(1, 1);
    fireEvent.keyDown(area(), { key: "Tab" });
    expect(area().value).toBe("{  ");
  });

  it("Enter keeps the indent of the current line", () => {
    render(<Harness initial={'  "a": 1'} />);
    area().setSelectionRange(area().value.length, area().value.length);
    fireEvent.keyDown(area(), { key: "Enter" });
    expect(area().value).toBe('  "a": 1\n  ');
  });

  it("Enter between brackets opens an indented line and closes the bracket below", () => {
    render(<Harness initial="{}" />);
    area().setSelectionRange(1, 1);
    fireEvent.keyDown(area(), { key: "Enter" });
    expect(area().value).toBe("{\n  \n}");
  });

  it("pasting valid JSON inserts it formatted", () => {
    render(<Harness />);
    fireEvent.paste(area(), { clipboardData: { getData: () => '{"a":1}' } });
    expect(area().value).toBe('{\n  "a": 1\n}');
  });

  it("pasting text that is not JSON is left to the browser", () => {
    render(<Harness />);
    fireEvent.paste(area(), { clipboardData: { getData: () => "hello" } });
    expect(area().value).toBe("");
  });
});

describe("PlanEditor feedback", () => {
  it("numbers the lines and names the line of a syntax error", () => {
    render(<Harness initial={'{\n  "a": \n}'} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toMatch(/Line \d+/);
  });

  it("shows a valid state for a correct plan", () => {
    render(<Harness initial='{"elements":[]}' />);
    expect(screen.getByText("Valid JSON")).toBeInTheDocument();
  });
});

describe("PlanPreview", () => {
  it("counts elements by type, including nested children", () => {
    const parsed = parsePlanText(
      JSON.stringify({
        name: "FY27",
        elements: [{ type: "PILLAR", code: "P1", title: "Trust", children: [{ type: "OBJECTIVE", code: "P1.O1", title: "Claims" }] }],
      }),
    );
    render(<PlanPreview parsed={parsed} />);
    expect(screen.getByText("FY27")).toBeInTheDocument();
    expect(screen.getByText("2 elements")).toBeInTheDocument();
    expect(screen.getByText("Claims")).toBeInTheDocument();
  });

  it("asks for an elements list when the JSON has none", () => {
    render(<PlanPreview parsed={parsePlanText('{"name":"x"}')} />);
    expect(screen.getByText(/needs an/)).toBeInTheDocument();
  });
});
