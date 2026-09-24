/**
 * Standalone SVG export for the org-hierarchy visuals (the React Flow canvases
 * in `OrgMapGraph` and `OrgTreeGraph`).
 *
 * React Flow paints nodes as HTML and only the connectors as SVG, so the canvas
 * can't be serialised as-is. Instead the already-computed layout (box positions
 * and edges) is re-rendered into a clean, self-contained SVG of rects, text and
 * bezier connectors. That keeps the file viewable in any browser or vector tool
 * without depending on `foreignObject`/HTML embedding.
 */

import { downloadTextFile } from "./orgTreeExport";

export interface HierarchySvgGroup {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string | null;
  /** HSL triplet, e.g. "210 61% 49%". */
  color: string;
  dashed?: boolean;
}

export interface HierarchySvgBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** HSL triplet used for the type label, border and chips. */
  accent: string;
  typeLabel?: string;
  title: string;
  description?: string | null;
  chips?: string[];
}

export interface HierarchySvgEdge {
  source: string;
  target: string;
}

export interface BuildHierarchySvgOptions {
  /** Edge routing: `TB` (top→bottom) or `LR` (left→right). */
  direction?: "TB" | "LR";
  padding?: number;
  background?: string;
}

const FONT = "'Google Sans', 'Segoe UI', Arial, sans-serif";
const TEXT_DARK = "#0f172a";
const TEXT_MUTED = "#64748b";
const EDGE_STROKE = "#94a3b8";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Greedy word-wrap using an approximate glyph width for the given font size. */
function wrapText(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  const maxChars = Math.max(4, Math.floor(maxWidth / (fontSize * 0.58)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = `${last.slice(0, Math.max(1, last.length - 1))}…`;
  return kept;
}

/** Single row of pill chips, collapsing any overflow into a "+N" chip. */
function renderChips(chips: string[], box: HierarchySvgBox, y: number): string {
  const fontSize = 9;
  const gap = 4;
  const maxRight = box.x + box.width - 8;
  const parts: string[] = [];
  let x = box.x + 8;
  let shown = 0;

  const pill = (label: string, px: number) => {
    const width = label.length * 5.2 + 12;
    parts.push(
      `<rect x="${num(px)}" y="${num(y)}" width="${num(width)}" height="14" rx="7" fill="hsl(${box.accent} / 0.10)" stroke="hsl(${box.accent} / 0.35)" stroke-width="0.75"/>`,
      `<text x="${num(px + width / 2)}" y="${num(y + 10)}" text-anchor="middle" font-family="${FONT}" font-size="${fontSize}" fill="${TEXT_DARK}">${esc(label)}</text>`,
    );
    return width;
  };

  for (const chip of chips) {
    const width = chip.length * 5.2 + 12;
    if (x + width > maxRight) break;
    pill(chip, x);
    x += width + gap;
    shown += 1;
  }

  const remaining = chips.length - shown;
  if (remaining > 0) {
    const label = `+${remaining}`;
    const width = label.length * 5.2 + 12;
    if (x + width <= maxRight) pill(label, x);
  }

  return parts.join("");
}

export function buildHierarchySvg(
  boxes: HierarchySvgBox[],
  edges: HierarchySvgEdge[],
  groups: HierarchySvgGroup[] = [],
  options: BuildHierarchySvgOptions = {},
): string {
  const { direction = "TB", padding = 32, background = "#ffffff" } = options;

  const extents = [...boxes, ...groups];
  const xs = extents.flatMap((b) => [b.x, b.x + b.width]);
  const ys = extents.flatMap((b) => [b.y, b.y + b.height]);
  const minX = (xs.length ? Math.min(...xs) : 0) - padding;
  const minY = (ys.length ? Math.min(...ys) : 0) - padding;
  const width = (xs.length ? Math.max(...xs) : 0) + padding - minX;
  const height = (ys.length ? Math.max(...ys) : 0) + padding - minY;

  const byId = new Map(boxes.map((b) => [b.id, b]));

  const groupsSvg = groups
    .map((g) => {
      const dash = g.dashed ? ` stroke-dasharray="6 5"` : "";
      const label = g.label
        ? `<text x="${num(g.x + 12)}" y="${num(g.y + 20)}" font-family="${FONT}" font-size="10" font-weight="600" letter-spacing="0.8" fill="hsl(${g.color})">${esc(
            g.label.toUpperCase(),
          )}</text>`
        : "";
      return `<g><rect x="${num(g.x)}" y="${num(g.y)}" width="${num(g.width)}" height="${num(
        g.height,
      )}" rx="10" fill="hsl(${g.color} / 0.05)" stroke="hsl(${g.color} / 0.4)" stroke-width="1"${dash}/>${label}</g>`;
    })
    .join("");

  const edgesSvg = edges
    .map((e) => {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) return "";
      let d: string;
      if (direction === "LR") {
        const sx = s.x + s.width;
        const sy = s.y + s.height / 2;
        const tx = t.x;
        const ty = t.y + t.height / 2;
        const dx = (tx - sx) / 2;
        d = `M ${num(sx)} ${num(sy)} C ${num(sx + dx)} ${num(sy)}, ${num(tx - dx)} ${num(ty)}, ${num(
          tx,
        )} ${num(ty)}`;
      } else {
        const sx = s.x + s.width / 2;
        const sy = s.y + s.height;
        const tx = t.x + t.width / 2;
        const ty = t.y;
        const dy = (ty - sy) / 2;
        d = `M ${num(sx)} ${num(sy)} C ${num(sx)} ${num(sy + dy)}, ${num(tx)} ${num(ty - dy)}, ${num(
          tx,
        )} ${num(ty)}`;
      }
      return `<path d="${d}" fill="none" stroke="${EDGE_STROKE}" stroke-width="1.5"/>`;
    })
    .join("");

  const boxesSvg = boxes
    .map((b) => {
      const parts: string[] = [];
      parts.push(
        `<rect x="${num(b.x)}" y="${num(b.y)}" width="${num(b.width)}" height="${num(
          b.height,
        )}" rx="8" fill="#ffffff" stroke="hsl(${b.accent} / 0.45)" stroke-width="1.25"/>`,
      );

      let cursorY = b.y + 16;
      if (b.typeLabel) {
        parts.push(
          `<text x="${num(b.x + b.width / 2)}" y="${num(
            cursorY,
          )}" text-anchor="middle" font-family="${FONT}" font-size="9" font-weight="700" letter-spacing="1" fill="hsl(${
            b.accent
          })">${esc(b.typeLabel.toUpperCase())}</text>`,
        );
        cursorY += 15;
      }

      for (const line of wrapText(b.title, b.width - 20, 12, b.description ? 2 : 3)) {
        parts.push(
          `<text x="${num(b.x + b.width / 2)}" y="${num(
            cursorY,
          )}" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="600" fill="${TEXT_DARK}">${esc(
            line,
          )}</text>`,
        );
        cursorY += 14;
      }

      if (b.description) {
        for (const line of wrapText(b.description, b.width - 20, 10, 2)) {
          parts.push(
            `<text x="${num(b.x + b.width / 2)}" y="${num(
              cursorY,
            )}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="${TEXT_MUTED}">${esc(
              line,
            )}</text>`,
          );
          cursorY += 12;
        }
      }

      if (b.chips && b.chips.length > 0 && cursorY + 14 <= b.y + b.height - 4) {
        parts.push(renderChips(b.chips, b, cursorY + 2));
      }

      return `<g>${parts.join("")}</g>`;
    })
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(
      height,
    )}" viewBox="${num(minX)} ${num(minY)} ${num(width)} ${num(
      height,
    )}" font-family="${FONT}">`,
    `<rect x="${num(minX)}" y="${num(minY)}" width="${num(width)}" height="${num(
      height,
    )}" fill="${background}"/>`,
    groupsSvg,
    edgesSvg,
    boxesSvg,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Download an SVG string as a `.svg` file. */
export function downloadSvg(filename: string, svg: string): void {
  downloadTextFile(filename, svg, "image/svg+xml;charset=utf-8");
}
