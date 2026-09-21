import { newDocument, type PolicyDocument } from "@/data/documentsStore";
import type { OrgNode } from "@/data/orgStore";
import {
  DEFAULT_FILTERS,
  canDecideStep,
  computeUserScopeNodeIds,
  countDocuments,
  decideStep,
  documentFileName,
  documentToText,
  filterDocuments,
  filterVisibleDocuments,
  isDocumentInScope,
  moveItem,
  resetToDraft,
  sendBack,
  submitDocument,
} from "./document-logic";

const node = (id: string, parentId: string | null, type = "department"): OrgNode => ({
  id,
  name: id.toUpperCase(),
  type,
  parentId,
  objectiveIds: [],
});

// group ─ finance ─ treasury
//       └ ops
const orgNodes = [node("group", null, "group"), node("finance", "group"), node("treasury", "finance", "section"), node("ops", "group")];
const nodeMap = new Map(orgNodes.map((n) => [n.id, n]));

const doc = (overrides: Partial<PolicyDocument> = {}): PolicyDocument => ({
  ...newDocument("policy"),
  title: "Info Sec Policy",
  ...overrides,
});

const actor = { id: "u1", name: "Ada" };
const NOW = "2026-01-01T00:00:00.000Z";

describe("scope and visibility", () => {
  it("covers the user's ancestors, self and descendants but not siblings", () => {
    const scope = computeUserScopeNodeIds(orgNodes, "finance");
    expect([...scope].sort()).toEqual(["finance", "group", "treasury"]);
    expect(computeUserScopeNodeIds(orgNodes, undefined).size).toBe(0);
  });

  it("limits non-global viewers to documents touching their scope", () => {
    const scope = computeUserScopeNodeIds(orgNodes, "finance");
    const docs = [
      doc({ id: "a", linkedOrgNodeIds: ["treasury"] }),
      doc({ id: "b", linkedOrgNodeIds: ["ops"] }),
      doc({ id: "c", linkedOrgNodeIds: [] }),
    ];
    const visible = (isGlobalViewer: boolean, userOrgNodeId?: string) =>
      filterVisibleDocuments(docs, { isGlobalViewer, userOrgNodeId, scope }).map((d) => d.id);

    expect(visible(true)).toEqual(["a", "b", "c"]);
    expect(visible(false, "finance")).toEqual(["a"]);
    expect(visible(false, undefined)).toEqual([]);
  });

  it("treats unlinked drafts as in scope for everyone", () => {
    const scope = new Set(["finance"]);
    expect(isDocumentInScope(doc({ linkedOrgNodeIds: [] }), false, scope)).toBe(true);
    expect(isDocumentInScope(doc({ linkedOrgNodeIds: ["ops"] }), false, scope)).toBe(false);
    expect(isDocumentInScope(doc({ linkedOrgNodeIds: ["ops"] }), true, scope)).toBe(true);
  });
});

describe("filtering and counts", () => {
  const docs = [
    doc({ id: "p", title: "Password Policy", type: "policy", linkedOrgNodeIds: ["treasury"] }),
    doc({ id: "s", title: "Encryption Standard", type: "standard", description: "AES only", linkedOrgNodeIds: ["ops"] }),
    doc({
      id: "e",
      title: "Old Guideline",
      type: "guideline",
      approvalStatus: "approved",
      effectiveDate: "2020-01-01",
      reviewDate: "2021-01-01",
    }),
  ];

  it("filters by type, computed status, org level and text", () => {
    const run = (f: Partial<typeof DEFAULT_FILTERS>) =>
      filterDocuments(docs, { ...DEFAULT_FILTERS, ...f }, nodeMap).map((d) => d.id);

    expect(run({})).toEqual(["p", "s", "e"]);
    expect(run({ type: "standard" })).toEqual(["s"]);
    expect(run({ status: "expired" })).toEqual(["e"]);
    expect(run({ level: "section" })).toEqual(["p"]);
    expect(run({ search: "aes" })).toEqual(["s"]);
    expect(run({ search: "  PASSWORD " })).toEqual(["p"]);
  });

  it("counts documents by currency", () => {
    expect(countDocuments(docs)).toEqual({ total: 3, current: 0, expired: 1, draft: 2 });
  });
});

describe("editing helpers", () => {
  it("moves items and ignores out-of-range moves", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    const list = ["a", "b"];
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 1, 1)).toBe(list);
  });

  it("names the export file from the title", () => {
    expect(documentFileName(doc({ title: "Info Sec: Policy v2!" }))).toBe("info-sec-policy-v2-.txt");
    expect(documentFileName(doc({ title: "" }))).toBe("document.txt");
  });

  it("renders structured content into the text export", () => {
    const text = documentToText(
      doc({
        owner: "CISO",
        description: "Keeps data safe",
        sections: [{ id: "s1", heading: "1. Purpose", body: "Protect data." }],
        abbreviations: [{ id: "a1", term: "ISMS", meaning: "Management System" }],
        references: [{ id: "r1", label: "ISO 27001", source: "A.5.1", url: "https://iso.org" }],
        revisionHistory: [{ id: "v1", version: "1.0", date: "2026-01-01", author: "Ada", summary: "Initial" }],
      }),
    );
    expect(text).toContain("Owner: CISO");
    expect(text).toContain("ABSTRACT");
    expect(text).toContain("  1. 1. Purpose");
    expect(text).toContain("ISMS");
    expect(text).toContain("• ISO 27001 — A.5.1 (https://iso.org)");
    expect(text).toContain("v1.0 · 2026-01-01 · Ada — Initial");
  });
});

describe("approval workflow", () => {
  it("submits with a fresh two-step chain and keeps an existing chain", () => {
    const submitted = submitDocument(doc(), actor, NOW);
    expect(submitted.approvalStatus).toBe("submitted");
    expect(submitted.submittedByUserId).toBe("u1");
    expect(submitted.approvals.map((s) => s.role)).toEqual(["approver", "risk_manager"]);

    const again = submitDocument({ ...submitted, approvalStatus: "draft" }, actor, NOW);
    expect(again.approvals).toBe(submitted.approvals);
  });

  it("approves step by step and rejects on any rejection", () => {
    const submitted = submitDocument(doc(), actor, NOW);
    const [first, second] = submitted.approvals;

    const afterFirst = decideStep(submitted, first.id, "approved", actor, "ok", NOW);
    expect(afterFirst.approvalStatus).toBe("submitted");
    expect(afterFirst.approvals[0]).toMatchObject({ decision: "approved", approverName: "Ada", comment: "ok" });

    expect(decideStep(afterFirst, second.id, "approved", actor, undefined, NOW).approvalStatus).toBe("approved");
    expect(decideStep(afterFirst, second.id, "rejected", actor, undefined, NOW).approvalStatus).toBe("rejected");
  });

  it("gates decisions on order, role, scope and pending state", () => {
    const submitted = submitDocument(doc(), actor, NOW);
    const [first, second] = submitted.approvals;

    expect(canDecideStep(submitted, 0, "approver", "approver", true)).toBe(true);
    expect(canDecideStep(submitted, 0, "approver", "risk_manager", true)).toBe(false);
    expect(canDecideStep(submitted, 0, "approver", "admin", true)).toBe(true);
    expect(canDecideStep(submitted, 0, "approver", "approver", false)).toBe(false);
    // Second step waits for the first.
    expect(canDecideStep(submitted, 1, "risk_manager", "risk_manager", true)).toBe(false);

    const afterFirst = decideStep(submitted, first.id, "approved", actor, undefined, NOW);
    expect(canDecideStep(afterFirst, 1, "risk_manager", "risk_manager", true)).toBe(true);
    expect(canDecideStep(afterFirst, 0, "approver", "approver", true)).toBe(false);
    expect(second.decision).toBe("pending");
  });

  it("resets to draft clearing every decision", () => {
    const submitted = submitDocument(doc(), actor, NOW);
    const decided = decideStep(submitted, submitted.approvals[0].id, "approved", actor, "fine", NOW);
    const reset = resetToDraft(decided, NOW);

    expect(reset.approvalStatus).toBe("draft");
    expect(reset.submittedAt).toBeUndefined();
    expect(reset.approvals.every((s) => s.decision === "pending" && !s.comment && !s.approverName)).toBe(true);
  });

  it("sends back keeping the reviewer's message on the returning step only", () => {
    const submitted = submitDocument(doc(), actor, NOW);
    const [first, second] = submitted.approvals;
    const returned = sendBack(submitted, first.id, "  Add a scope section ", actor, NOW);

    expect(returned.approvalStatus).toBe("draft");
    expect(returned.approvals[0].comment).toBe("↩ Returned to author: Add a scope section");
    expect(returned.approvals[0].approverName).toBe("Ada");
    expect(returned.approvals.find((s) => s.id === second.id)?.comment).toBeUndefined();
    expect(returned.approvals.every((s) => s.decision === "pending")).toBe(true);
  });
});
