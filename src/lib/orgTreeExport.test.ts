import { describe, expect, it } from "vitest";
import { flattenOrgTree, orgNodesToCsv, orgNodesToJson } from "./orgTreeExport";
import type { OrgNode } from "@/data/orgStore";

const node = (overrides: Partial<OrgNode> & Pick<OrgNode, "id" | "name" | "type">): OrgNode => ({
  parentId: null,
  objectiveIds: [],
  ...overrides,
});

const tree: OrgNode[] = [
  node({ id: "g", name: "Acme Group", type: "group", lineOfDefense: 1 }),
  node({ id: "c1", name: "Insurance Co", type: "company", parentId: "g" }),
  node({
    id: "d1",
    name: 'Finance, "Shared"',
    type: "department",
    parentId: "c1",
    lineOfDefense: 2,
    description: "Line one\nline two",
    offerings: [{ id: "o1", kind: "service", label: "Payroll" }],
  }),
  node({ id: "orphan", name: "Orphan Unit", type: "section", parentId: "missing" }),
];

describe("flattenOrgTree", () => {
  it("walks the forest depth-first and records hierarchy paths", () => {
    const rows = flattenOrgTree(tree);
    expect(rows.map((r) => r.path)).toEqual([
      "Acme Group",
      "Acme Group / Insurance Co",
      'Acme Group / Insurance Co / Finance, "Shared"',
      "Orphan Unit",
    ]);
    expect(rows.map((r) => r.level)).toEqual([1, 2, 3, 1]);
  });

  it("resolves inherited lines of defense and labels types", () => {
    const rows = flattenOrgTree(tree);
    expect(rows[1].lineOfDefense).toBe("Line 1: Business (Ownership)");
    expect(rows[2].lineOfDefense).toBe("Line 2: Oversight & Control");
    expect(rows[0].typeLabel).toBe("Group");
  });
});

describe("orgNodesToCsv", () => {
  it("emits a header and one row per unit", () => {
    const lines = orgNodesToCsv(tree).split("\r\n");
    expect(lines).toHaveLength(tree.length + 1);
    expect(lines[0]).toContain("Level,Path,Name,Type");
  });

  it("quotes values containing commas, quotes or newlines", () => {
    const csv = orgNodesToCsv(tree);
    expect(csv).toContain('"Finance, ""Shared"""');
    expect(csv).toContain('"Acme Group / Insurance Co / Finance, ""Shared"""');
    expect(csv).toContain('"Line one\nline two"');
  });

  it("includes offering kind labels", () => {
    expect(orgNodesToCsv(tree)).toContain("Service: Payroll");
  });
});

describe("orgNodesToJson", () => {
  it("preserves the nested tree and attaches metadata", () => {
    const payload = JSON.parse(orgNodesToJson(tree, { organizationName: "Acme" }));
    expect(payload.organizationName).toBe("Acme");
    expect(payload.nodeCount).toBe(4);
    expect(payload.tree).toHaveLength(2); // group + orphan root
    expect(payload.tree[0].children[0].children[0].name).toBe('Finance, "Shared"');
    expect(payload.tree[0].children[0].children[0].offerings).toBe("Service: Payroll");
    expect(payload.tree[0].children[0].children[0].children).toEqual([]);
  });
});
