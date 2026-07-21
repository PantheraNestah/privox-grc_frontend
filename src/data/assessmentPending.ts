// Helpers that resolve "who is currently holding up an assessment?" so the UI
// can show e.g. "Awaiting Approver — Jane Doe" instead of just "Awaiting Approver".

import type { InitiativeAssessment } from "./assessmentStore";
import { ASSESSMENT_STATUS_LABELS } from "./assessmentStore";
import { type OrgNode } from "./orgStore";
import { ROLE_LABELS, type AppUser } from "./userStore";

export interface PendingActor {
  /** Short label e.g. "Awaiting Approver" */
  statusLabel: string;
  /** Detailed actor sentence e.g. "with Jane Doe (Approver · Finance)" */
  actorLabel: string;
  /** Compact actor name only (for tight cells) */
  actorShort: string;
  /** Combined "Awaiting Approver — Jane Doe" */
  combined: string;
}

// Roles that can sit in an org-hierarchy approval chain (excludes admin — admin is a fallback only).
const CHAIN_APPROVER_ROLES = new Set<AppUser["role"]>(["approver", "executive", "risk_manager"]);

/**
 * Find users that qualify as approvers for a given submitter.
 *
 * Routing rules (in priority order):
 *  0. DELEGATION: if the assessment has been explicitly delegated upward to a user, that user
 *     (only) is the eligible approver — admins remain a final safety net.
 *  1. PRIMARY: any user holding an approval-capable role whose org unit is a STRICT ANCESTOR of
 *     the submitter's unit. The closest ancestors come first.
 *  2. SECONDARY: if no in-chain approver exists above the submitter, fall back to ALL users with
 *     an approval-capable role across the system (not just admins) — so a submission never
 *     silently lands on the admin's desk while real approvers exist elsewhere.
 *  3. FINAL FALLBACK: admins, only when no approver-role users exist anywhere.
 */
export function getEligibleApprovers(
  submitter: AppUser | undefined,
  users: AppUser[],
  orgNodes: OrgNode[],
  delegatedToUserId?: string,
): AppUser[] {
  const admins = users.filter(u => u.role === "admin" && u.id !== submitter?.id);

  // 0. Honor explicit delegation
  if (delegatedToUserId) {
    const target = users.find(u => u.id === delegatedToUserId);
    if (target) {
      // delegated approver + admins as a safety net (in case the delegate is unavailable)
      const out = [target];
      admins.forEach(a => { if (a.id !== target.id) out.push(a); });
      return out;
    }
  }

  // Build the ordered ancestor chain (closest first), excluding the submitter's own unit.
  const ancestorIds = (submitter?.orgNodeId && orgNodes.length)
    ? (() => {
        const map = new Map(orgNodes.map(n => [n.id, n]));
        const ids: string[] = [];
        let cur = map.get(submitter.orgNodeId!);
        const seen = new Set<string>();
        // skip self — we want STRICT ancestors only
        cur = cur?.parentId ? map.get(cur.parentId) : undefined;
        while (cur && !seen.has(cur.id)) {
          seen.add(cur.id);
          ids.push(cur.id);
          cur = cur.parentId ? map.get(cur.parentId) : undefined;
        }
        return ids;
      })()
    : [];

  const chainApprovers: AppUser[] = [];
  ancestorIds.forEach(nid => {
    users.forEach(u => {
      if (u.id === submitter?.id) return;
      if (!CHAIN_APPROVER_ROLES.has(u.role) && u.role !== "admin") return;
      if (u.orgNodeId !== nid) return;
      if (!chainApprovers.find(x => x.id === u.id)) chainApprovers.push(u);
    });
  });

  if (chainApprovers.length > 0) return chainApprovers;

  // 2. Secondary fallback — any approver-role user system-wide.
  const systemApprovers = users.filter(u =>
    u.id !== submitter?.id && CHAIN_APPROVER_ROLES.has(u.role)
  );
  if (systemApprovers.length > 0) return systemApprovers;

  // 3. Final fallback — admins.
  return admins;
}

export function getPendingActor(
  a: InitiativeAssessment,
  users: AppUser[],
  orgNodes: OrgNode[],
): PendingActor {
  const statusLabel = ASSESSMENT_STATUS_LABELS[a.status];
  const submitter = users.find(u => u.id === a.createdByUserId);

  if (a.status === "draft") {
    const name = submitter?.name ?? "Input User";
    return {
      statusLabel,
      actorShort: name,
      actorLabel: `with ${name}${submitter ? ` (${ROLE_LABELS[submitter.role]})` : ""}`,
      combined: `${statusLabel} — ${name}`,
    };
  }

  if (a.status === "submitted" || a.status === "in_review") {
    const eligible = getEligibleApprovers(submitter, users, orgNodes, a.delegatedToUserId);
    const delegated = !!a.delegatedToUserId;
    const prefix = delegated ? `${statusLabel} (delegated)` : statusLabel;
    if (eligible.length === 0) {
      return {
        statusLabel: prefix,
        actorShort: "No approver",
        actorLabel: `— no eligible approver`,
        combined: `${prefix} — no approver`,
      };
    }
    if (eligible.length === 1) {
      const u = eligible[0];
      return {
        statusLabel: prefix,
        actorShort: u.name,
        actorLabel: `with ${u.name} (${ROLE_LABELS[u.role]})`,
        combined: `${prefix} — ${u.name}`,
      };
    }
    const first = eligible[0];
    const more = eligible.length - 1;
    return {
      statusLabel: prefix,
      actorShort: `${first.name} +${more}`,
      actorLabel: `with ${first.name} and ${more} other${more === 1 ? "" : "s"}`,
      combined: `${prefix} — ${first.name} +${more} more`,
    };
  }

  // approved / rejected — terminal
  return {
    statusLabel,
    actorShort: "—",
    actorLabel: "",
    combined: statusLabel,
  };
}
