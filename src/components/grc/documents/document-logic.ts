import {
  DOCUMENT_TYPE_LABELS,
  buildTwoStepApprovalChain,
  computeDocumentStatus,
  recomputeDocApprovalStatus,
  type ApprovalDecision,
  type ApprovalRole,
  type DocumentStatus,
  type DocumentType,
  type PolicyDocument,
} from "@/data/documentsStore";
import { getOrgAncestorChain, type OrgNode, type OrgNodeType } from "@/data/orgStore";
import type { UserRole } from "@/data/userStore";

export const DOC_TYPES: DocumentType[] = ["policy", "standard", "procedure", "guideline"];
export const ORG_LEVEL_FILTERS: OrgNodeType[] = ["group", "company", "department", "division", "section"];

// ─── Scope & visibility ───────────────────────────────────

/**
 * Org node ids the user is "in scope" for: their own node, every ancestor up to
 * the root, and every descendant beneath them. A document is visible/actionable
 * when any of its linked nodes intersects this set.
 */
export function computeUserScopeNodeIds(orgNodes: OrgNode[], userOrgNodeId?: string): Set<string> {
  const scope = new Set<string>();
  if (!userOrgNodeId) return scope;

  getOrgAncestorChain(orgNodes, userOrgNodeId).forEach((n) => scope.add(n.id));

  const childrenOf = new Map<string | null, string[]>();
  orgNodes.forEach((n) => {
    const siblings = childrenOf.get(n.parentId) ?? [];
    siblings.push(n.id);
    childrenOf.set(n.parentId, siblings);
  });

  const stack = [userOrgNodeId];
  while (stack.length) {
    const current = stack.pop()!;
    (childrenOf.get(current) ?? []).forEach((child) => {
      if (!scope.has(child)) {
        scope.add(child);
        stack.push(child);
      }
    });
  }
  return scope;
}

export function filterVisibleDocuments(
  docs: PolicyDocument[],
  opts: { isGlobalViewer: boolean; userOrgNodeId?: string; scope: ReadonlySet<string> },
): PolicyDocument[] {
  if (opts.isGlobalViewer) return docs;
  if (!opts.userOrgNodeId) return [];
  return docs.filter((d) => d.linkedOrgNodeIds.some((id) => opts.scope.has(id)));
}

/** Global viewers, authors of unlinked drafts, and users whose scope touches a linked unit. */
export function isDocumentInScope(
  doc: PolicyDocument,
  isGlobalViewer: boolean,
  scope: ReadonlySet<string>,
): boolean {
  return isGlobalViewer || doc.linkedOrgNodeIds.length === 0 || doc.linkedOrgNodeIds.some((id) => scope.has(id));
}

// ─── Filtering & counts ───────────────────────────────────

export interface DocumentFilters {
  search: string;
  type: DocumentType | "all";
  status: DocumentStatus | "all";
  level: OrgNodeType | "all";
}

export const DEFAULT_FILTERS: DocumentFilters = { search: "", type: "all", status: "all", level: "all" };

export function filterDocuments(
  docs: PolicyDocument[],
  filters: DocumentFilters,
  orgNodeMap: ReadonlyMap<string, OrgNode>,
): PolicyDocument[] {
  const query = filters.search.trim().toLowerCase();
  return docs.filter((d) => {
    if (filters.type !== "all" && d.type !== filters.type) return false;
    if (filters.status !== "all" && computeDocumentStatus(d) !== filters.status) return false;
    if (
      filters.level !== "all" &&
      !d.linkedOrgNodeIds.some((id) => orgNodeMap.get(id)?.type === filters.level)
    ) {
      return false;
    }
    if (query && !d.title.toLowerCase().includes(query) && !(d.description ?? "").toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}

export function countDocuments(docs: PolicyDocument[]) {
  const counts = { total: docs.length, current: 0, expired: 0, draft: 0 };
  docs.forEach((d) => {
    const status = computeDocumentStatus(d);
    if (status === "current") counts.current += 1;
    else if (status === "expired") counts.expired += 1;
    else counts.draft += 1;
  });
  return counts;
}

// ─── Editing helpers ──────────────────────────────────────

/** Swaps an item with its neighbour; returns the same array when the move is out of range. */
export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Sequential approval: a step is decidable once earlier steps are approved and the user may act on it. */
export function canDecideStep(
  doc: PolicyDocument,
  index: number,
  role: ApprovalRole,
  userRole: UserRole,
  inDocScope: boolean,
): boolean {
  if (!inDocScope) return false;
  if (userRole !== "admin" && userRole !== role) return false;
  for (let i = 0; i < index; i += 1) {
    if (doc.approvals[i]?.decision !== "approved") return false;
  }
  return doc.approvals[index]?.decision === "pending";
}

// ─── Approval workflow transitions ────────────────────────

export interface Actor {
  id: string;
  name: string;
}

const nowIso = () => new Date().toISOString();

/** Start (or restart) the Approver → Risk Manager chain. */
export function submitDocument(doc: PolicyDocument, actor: Actor, now = nowIso()): PolicyDocument {
  return {
    ...doc,
    approvalStatus: "submitted",
    submittedAt: now,
    submittedByUserId: actor.id,
    approvals: doc.approvals.length > 0 ? doc.approvals : buildTwoStepApprovalChain(),
    updatedAt: now,
  };
}

export function decideStep(
  doc: PolicyDocument,
  stepId: string,
  decision: ApprovalDecision,
  actor: Actor,
  comment?: string,
  now = nowIso(),
): PolicyDocument {
  const approvals = doc.approvals.map((step) =>
    step.id === stepId
      ? {
          ...step,
          decision,
          decidedAt: now,
          approverName: actor.name,
          approverUserId: actor.id,
          comment: comment ?? step.comment,
        }
      : step,
  );
  const draft = { ...doc, approvals };
  return { ...draft, approvalStatus: recomputeDocApprovalStatus(draft), updatedAt: now };
}

/** Admin / Risk Manager reset: back to draft with every decision cleared. */
export function resetToDraft(doc: PolicyDocument, now = nowIso()): PolicyDocument {
  return {
    ...doc,
    approvalStatus: "draft",
    submittedAt: undefined,
    approvals: doc.approvals.map((step) => ({
      ...step,
      decision: "pending",
      decidedAt: undefined,
      approverName: undefined,
      approverUserId: undefined,
      comment: undefined,
    })),
    updatedAt: now,
  };
}

/**
 * Returns the document to its author: workflow restarts, decisions are cleared
 * and the reviewer's message stays on the step that returned it.
 */
export function sendBack(
  doc: PolicyDocument,
  fromStepId: string,
  message: string,
  actor: Actor,
  now = nowIso(),
): PolicyDocument {
  return {
    ...doc,
    approvalStatus: "draft",
    submittedAt: undefined,
    approvals: doc.approvals.map((step) => ({
      ...step,
      decision: "pending",
      decidedAt: undefined,
      approverName: step.id === fromStepId ? actor.name : undefined,
      approverUserId: step.id === fromStepId ? actor.id : undefined,
      comment: step.id === fromStepId ? `↩ Returned to author: ${message.trim()}` : undefined,
    })),
    updatedAt: now,
  };
}

// ─── Export ───────────────────────────────────────────────

/** Printable plain-text rendering of the structured document. */
export function documentToText(d: PolicyDocument): string {
  const title = d.title || "Untitled document";
  const lines: string[] = [title, "=".repeat(Math.max(20, title.length))];
  lines.push(`${DOCUMENT_TYPE_LABELS[d.type]} · v${d.version}`);
  if (d.owner) lines.push(`Owner: ${d.owner}`);
  if (d.effectiveDate) lines.push(`Effective: ${d.effectiveDate}`);
  if (d.reviewDate) lines.push(`Next review: ${d.reviewDate}`);
  lines.push("");

  if (d.description) lines.push("ABSTRACT", d.description, "");
  if (d.sections.length > 0) {
    lines.push("TABLE OF CONTENTS");
    d.sections.forEach((s, i) => lines.push(`  ${i + 1}. ${s.heading}`));
    lines.push("");
  }
  if (d.abbreviations.length > 0) {
    lines.push("ABBREVIATIONS & DEFINED TERMS");
    d.abbreviations.forEach((a) => lines.push(`  ${a.term.padEnd(12)} ${a.meaning}`));
    lines.push("");
  }
  d.sections.forEach((s) => {
    lines.push(s.heading, "-".repeat(Math.max(8, s.heading.length)), s.body || "", "");
  });
  if (d.references.length > 0) {
    lines.push("REFERENCES");
    d.references.forEach((r) =>
      lines.push(`  • ${r.label}${r.source ? ` — ${r.source}` : ""}${r.url ? ` (${r.url})` : ""}`),
    );
    lines.push("");
  }
  if (d.revisionHistory.length > 0) {
    lines.push("REVISION HISTORY");
    d.revisionHistory.forEach((r) => lines.push(`  v${r.version} · ${r.date} · ${r.author} — ${r.summary}`));
    lines.push("");
  }
  // Legacy free-form content (only if no structured sections were authored).
  if (d.sections.length === 0 && d.content) lines.push(d.content);

  return lines.join("\n");
}

export function documentFileName(d: PolicyDocument): string {
  return `${(d.title || "document").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
}

// ─── Shared prop shape for the editor tabs ────────────────

export interface DocumentTabProps {
  draft: PolicyDocument;
  /** Functional update of the draft (safe against stale closures). */
  patch: (update: (d: PolicyDocument) => PolicyDocument) => void;
  canEdit: boolean;
}
