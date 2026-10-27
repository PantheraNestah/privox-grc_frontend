import { describe, expect, it } from "vitest";
import type { OrgNode } from "@/data/orgStore";
import {
  HIERARCHY_LEGEND,
  HIERARCHY_TONES,
  hierarchyCardSize,
  hierarchyRole,
} from "./org-hierarchy-style";

const node = (overrides: Partial<OrgNode> & { id: string }): OrgNode => ({
  name: overrides.id,
  type: "company",
  parentId: null,
  objectiveIds: [],
  ...overrides,
});

const mapOf = (...nodes: OrgNode[]) => new Map(nodes.map((n) => [n.id, n]));

describe("hierarchyRole", () => {
  it("makes a parentless unit the navy root", () => {
    const root = node({ id: "group", type: "group" });
    expect(hierarchyRole(root, mapOf(root))).toBe("root");
  });

  it("colours business units blue and group functions lavender", () => {
    const root = node({ id: "group", type: "group" });
    const company = node({ id: "life", type: "company", parentId: "group" });
    const department = node({ id: "hr", type: "department", parentId: "group" });
    const byId = mapOf(root, company, department);

    expect(hierarchyRole(company, byId)).toBe("business");
    expect(hierarchyRole(department, byId)).toBe("function");
  });

  it("gives the 2nd and 3rd lines green and red, overriding the unit type", () => {
    const root = node({ id: "group", type: "group" });
    const risk = node({ id: "risk", type: "department", parentId: "group", lineOfDefense: 2 });
    const audit = node({ id: "audit", type: "department", parentId: "group", lineOfDefense: 3 });
    const byId = mapOf(root, risk, audit);

    expect(hierarchyRole(risk, byId)).toBe("lod2");
    expect(hierarchyRole(audit, byId)).toBe("lod3");
  });

  it("inherits the line of defence so Internal Control matches its owner", () => {
    const root = node({ id: "group", type: "group" });
    const audit = node({ id: "audit", type: "department", parentId: "group", lineOfDefense: 3 });
    const control = node({ id: "control", type: "section", parentId: "audit" });
    const byId = mapOf(root, audit, control);

    expect(hierarchyRole(control, byId)).toBe("lod3");
  });
});

describe("hierarchyCardSize", () => {
  it("steps down from the group root to sub-units and clamps deep levels", () => {
    expect(hierarchyCardSize(0).width).toBeGreaterThan(hierarchyCardSize(1).width);
    expect(hierarchyCardSize(1).width).toBeGreaterThan(hierarchyCardSize(2).width);
    expect(hierarchyCardSize(9)).toEqual(hierarchyCardSize(2));
    expect(hierarchyCardSize(-1)).toEqual(hierarchyCardSize(0));
  });
});

describe("HIERARCHY_LEGEND", () => {
  it("documents the three client legend entries in order", () => {
    expect(HIERARCHY_LEGEND.map((entry) => entry.label)).toEqual([
      "2nd Line of Defence (Internal Control)",
      "3rd Line of Defence (Internal Control)",
      "Other Departments / Business Units",
    ]);
    // Green for 2nd line, red for 3rd line.
    expect(HIERARCHY_TONES.lod2.accent).toMatch(/^1[23]\d /);
    expect(HIERARCHY_TONES.lod3.accent).toMatch(/^35\d /);
  });
});
