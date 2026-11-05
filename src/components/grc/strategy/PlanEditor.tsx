import { useEffect, useMemo, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { CheckCircle2, Eraser, Sparkles, WandSparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SAMPLE_PLAN,
  formatPlanText,
  parsePlanText,
  type PlanParseError,
  type PlanParseResult,
} from "@/lib/strategy-plan-text";
import { cn } from "@/lib/utils";

const LINE_HEIGHT = "1.5rem";
const INDENT = "  ";

/* ---------- Editor ---------- */

export function PlanEditor({
  value,
  onChange,
  disabled,
  parsed,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  parsed: PlanParseResult | null;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  // Where the caret should land after a programmatic edit (applied after render).
  const pendingCaret = useRef<number | null>(null);

  useEffect(() => {
    if (pendingCaret.current === null || !areaRef.current) return;
    areaRef.current.selectionStart = pendingCaret.current;
    areaRef.current.selectionEnd = pendingCaret.current;
    pendingCaret.current = null;
  });

  const lineCount = useMemo(() => value.split("\n").length, [value]);
  const failure = parsed?.ok === false ? parsed.error : null;
  const errorLine = failure?.line;
  const error = failure;

  const replace = (start: number, end: number, insert: string, caret = start + insert.length) => {
    onChange(value.slice(0, start) + insert + value.slice(end));
    pendingCaret.current = caret;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;

    if (event.key === "Tab") {
      event.preventDefault();
      if (!event.shiftKey) {
        replace(start, end, INDENT);
        return;
      }
      // Shift+Tab outdents the current line by up to one indent.
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const leading = /^ {1,2}/.exec(value.slice(lineStart))?.[0].length ?? 0;
      if (leading > 0) {
        onChange(value.slice(0, lineStart) + value.slice(lineStart + leading));
        pendingCaret.current = Math.max(lineStart, start - leading);
      }
      return;
    }

    if (event.key === "Enter" && start === end) {
      event.preventDefault();
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const indent = /^ */.exec(value.slice(lineStart))?.[0] ?? "";
      const opener = value[start - 1];
      const closer = value[start];
      const extra = opener === "{" || opener === "[" ? INDENT : "";
      if ((opener === "{" && closer === "}") || (opener === "[" && closer === "]")) {
        // Put the closing bracket on its own line, with the caret on the indented blank line.
        const insert = `\n${indent}${extra}\n${indent}`;
        replace(start, end, insert, start + 1 + indent.length + extra.length);
        return;
      }
      replace(start, end, `\n${indent}${extra}`);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData("text");
    const pretty = formatPlanText(pasted);
    // Pasting JSON from an API response or another file lands formatted.
    if (pretty === null) return;
    event.preventDefault();
    const el = event.currentTarget;
    replace(el.selectionStart, el.selectionEnd, pretty);
  };

  const syncScroll = () => {
    if (gutterRef.current && areaRef.current) {
      gutterRef.current.scrollTop = areaRef.current.scrollTop;
    }
  };

  return (
    <div className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || parsed?.ok !== true}
          onClick={() => {
            const pretty = formatPlanText(value);
            if (pretty !== null) onChange(pretty);
          }}
        >
          <WandSparkles className="h-4 w-4" /> Format
        </Button>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(SAMPLE_PLAN)}>
          <Sparkles className="h-4 w-4" /> Sample
        </Button>
        <Button variant="ghost" size="sm" disabled={disabled || !value} onClick={() => onChange("")}>
          <Eraser className="h-4 w-4" /> Clear
        </Button>
        <div className="ml-auto">
          <StatusPill parsed={parsed} />
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 font-mono text-[13px]" style={{ lineHeight: LINE_HEIGHT }}>
        <div
          ref={gutterRef}
          aria-hidden
          className="w-12 shrink-0 select-none overflow-hidden border-r bg-muted/30 py-3 pr-2 text-right text-muted-foreground"
        >
          {Array.from({ length: lineCount }, (_, index) => (
            <div
              key={index}
              className={cn("px-1", errorLine === index + 1 && "rounded-sm bg-destructive/15 font-semibold text-destructive")}
            >
              {index + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={areaRef}
          id="bulk-json"
          aria-label="Plan JSON"
          aria-invalid={error ? true : undefined}
          spellCheck={false}
          wrap="off"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onScroll={syncScroll}
          placeholder="Paste or type a plan. Tab indents, and pasted JSON is formatted."
          className="min-h-0 flex-1 resize-none whitespace-pre overflow-auto bg-transparent px-3 py-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          style={{ lineHeight: LINE_HEIGHT, tabSize: 2 }}
        />
      </div>
    </div>
  );
}

function StatusPill({ parsed }: { parsed: PlanParseResult | null }) {
  if (!parsed) {
    return <span className="text-xs text-muted-foreground">Empty</span>;
  }
  if (parsed.ok === true) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> Valid JSON
      </span>
    );
  }
  return <ErrorPill error={parsed.error} />;
}

function ErrorPill({ error }: { error: PlanParseError }) {
  const where = error.line !== undefined ? `Line ${error.line}${error.column ? `, column ${error.column}` : ""}: ` : "";
  return (
    <span role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
      <XCircle className="h-3.5 w-3.5 shrink-0" /> {where}
      {error.message}
    </span>
  );
}

/* ---------- Preview ---------- */

interface PreviewElement {
  type?: unknown;
  code?: unknown;
  title?: unknown;
  orgNode?: unknown;
  children?: unknown;
}

function asElements(value: unknown): PreviewElement[] | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as { elements?: unknown }).elements)) {
    return null;
  }
  return (value as { elements: PreviewElement[] }).elements;
}

function countByType(elements: PreviewElement[], counts: Record<string, number> = {}): Record<string, number> {
  for (const element of elements) {
    const type = typeof element.type === "string" ? element.type : "UNKNOWN";
    counts[type] = (counts[type] ?? 0) + 1;
    if (Array.isArray(element.children)) countByType(element.children as PreviewElement[], counts);
  }
  return counts;
}

const TYPE_ORDER = ["PILLAR", "OBJECTIVE", "INITIATIVE", "ACTIVITY", "KPI"];

export function PlanPreview({ parsed }: { parsed: PlanParseResult | null }) {
  if (!parsed || parsed.ok === false) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        {parsed ? "Fix the JSON to see the preview." : "The preview appears here."}
      </div>
    );
  }
  const elements = asElements(parsed.value);
  if (!elements) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        A plan needs an <code className="mx-1 font-mono">elements</code> list.
      </div>
    );
  }

  const counts = countByType(elements);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const name = typeof (parsed.value as { name?: unknown }).name === "string" ? (parsed.value as { name: string }).name : null;
  const types = [...TYPE_ORDER, ...Object.keys(counts).filter((type) => !TYPE_ORDER.includes(type))].filter(
    (type) => counts[type],
  );

  return (
    <div className="flex min-h-[420px] flex-col gap-3 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="truncate text-sm font-semibold">{name ?? "Untitled plan"}</p>
        <p className="text-xs text-muted-foreground">{total} elements</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {types.map((type) => (
          <Badge key={type} variant="outline" className="font-mono text-[10px]">
            {type} {counts[type]}
          </Badge>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md bg-muted/30 p-2">
        <PreviewTree elements={elements} />
      </div>
    </div>
  );
}

function PreviewTree({ elements, depth = 0 }: { elements: PreviewElement[]; depth?: number }) {
  return (
    <ul className="space-y-0.5">
      {elements.map((element, index) => {
        const children = Array.isArray(element.children) ? (element.children as PreviewElement[]) : [];
        const orgNode = typeof element.orgNode === "string" ? element.orgNode : null;
        return (
          <li key={`${String(element.code ?? index)}-${index}`}>
            <div className="flex items-center gap-2 py-0.5 text-sm" style={{ paddingLeft: depth * 14 }}>
              <span className="font-mono text-[10px] uppercase text-brand-accent">{String(element.type ?? "?")}</span>
              <span className="truncate">{String(element.title ?? element.code ?? "Untitled")}</span>
              {element.code !== undefined && (
                <span className="font-mono text-[11px] text-muted-foreground">{String(element.code)}</span>
              )}
              {orgNode && <span className="truncate text-[11px] text-muted-foreground">@ {orgNode}</span>}
            </div>
            {children.length > 0 && <PreviewTree elements={children} depth={depth + 1} />}
          </li>
        );
      })}
    </ul>
  );
}
