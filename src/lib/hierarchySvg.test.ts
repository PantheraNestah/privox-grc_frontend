import { describe, expect, it } from "vitest";
import { buildHierarchySvg, type HierarchySvgBox } from "./hierarchySvg";

const boxes: HierarchySvgBox[] = [
  {
    id: "a",
    x: 0,
    y: 0,
    width: 210,
    height: 108,
    accent: "210 61% 49%",
    typeLabel: "group",
    title: "Acme & Sons",
    description: "Holding entity",
    chips: ["Payroll", "Jane Doe"],
  },
  {
    id: "b",
    x: 40,
    y: 200,
    width: 210,
    height: 108,
    accent: "158 53% 49%",
    typeLabel: "company",
    title: "Insurance Co",
  },
];

const edges = [{ source: "a", target: "b" }];

describe("buildHierarchySvg", () => {
  it("produces a self-contained SVG with a padded viewBox", () => {
    const svg = buildHierarchySvg(boxes, edges);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="-32 -32 314 372"');
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("renders one rect and label per box plus a connector per edge", () => {
    const svg = buildHierarchySvg(boxes, edges);
    expect((svg.match(/<rect /g) ?? []).length).toBeGreaterThanOrEqual(1 + boxes.length);
    expect((svg.match(/rx="8"/g) ?? []).length).toBe(boxes.length); // one card rect each
    expect((svg.match(/<path /g) ?? []).length).toBe(1);
    expect(svg).toContain("Acme &amp; Sons");
    expect(svg).toContain("GROUP");
    expect(svg).toContain("COMPANY");
    expect(svg).toContain("Payroll");
  });

  it("routes edges top-to-bottom or left-to-right based on direction", () => {
    const tb = buildHierarchySvg(boxes, edges, [], { direction: "TB" });
    const lr = buildHierarchySvg(boxes, edges, [], { direction: "LR" });
    // TB starts at the bottom-centre of the source (105,108); LR at the right edge (210,54).
    expect(tb).toContain("M 105 108 C");
    expect(lr).toContain("M 210 54 C");
  });

  it("draws lane groups behind the cards and escapes their labels", () => {
    const svg = buildHierarchySvg(
      boxes,
      edges,
      [{ x: -24, y: -10, width: 300, height: 340, label: "Line 1 <Business>", color: "210 61% 49%" }],
    );
    expect(svg).toContain("LINE 1 &lt;BUSINESS&gt;");
    // Group rect is emitted before the first card rect.
    expect(svg.indexOf('rx="10"')).toBeLessThan(svg.indexOf('rx="8"'));
  });

  it("skips edges whose endpoints are not in the layout", () => {
    const svg = buildHierarchySvg(boxes, [...edges, { source: "a", target: "missing" }]);
    expect((svg.match(/<path /g) ?? []).length).toBe(1);
  });

  it("handles an empty graph without throwing", () => {
    const svg = buildHierarchySvg([], []);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("is well-formed XML", () => {
    const svg = buildHierarchySvg(
      boxes,
      edges,
      [{ x: -24, y: -10, width: 300, height: 340, label: "Line 1 <Business>", color: "210 61% 49%" }],
      { direction: "LR" },
    );
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.tagName.toLowerCase()).toBe("svg");
  });
});
