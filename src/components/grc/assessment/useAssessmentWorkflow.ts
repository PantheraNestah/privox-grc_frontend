import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  loadAssessments,
  newAssessment,
  newAssessmentComment,
  saveAssessments,
  type InitiativeAssessment,
} from "@/data/assessmentStore";
import { getEligibleApprovers } from "@/data/assessmentPending";
import { getOrgDescendantChain, loadOrgNodes, type OrgNode } from "@/data/orgStore";
import { loadStrategy, type InitiativeStatus, type StrategyConfig } from "@/data/strategyStore";
import { can, loadUsers, ROLE_LABELS, type AppUser } from "@/data/userStore";
import { buildVisibleRows, computeStats, isAwaitingDecision } from "./helpers";

/**
 * State + workflow for Strategy Performance Assessment. Data lives in the
 * localStorage prototype stores; every decision persists straight back to them.
 * Actions return `true` when they completed, so callers can close their dialog.
 */
export function useAssessmentWorkflow(activeUser: AppUser) {
  const [cfg, setCfg] = useState<StrategyConfig>({ pillars: [], objectives: [] });
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [assessments, setAssessments] = useState<InitiativeAssessment[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    setCfg(loadStrategy());
    setOrgNodes(loadOrgNodes());
    setAssessments(loadAssessments());
    setUsers(loadUsers());
  }, []);

  const persist = (next: InitiativeAssessment[]) => {
    setAssessments(next);
    saveAssessments(next);
  };
  const reload = () => setAssessments(loadAssessments());

  const isGlobalViewer = can.viewAllScopes(activeUser.role);
  const userScopeNodeIds = useMemo(() => {
    if (!activeUser.orgNodeId) return new Set<string>();
    return new Set(getOrgDescendantChain(orgNodes, activeUser.orgNodeId).map((n) => n.id));
  }, [orgNodes, activeUser.orgNodeId]);

  const visibleRows = useMemo(
    () => buildVisibleRows(cfg, { isGlobalViewer, userScopeNodeIds }),
    [cfg, isGlobalViewer, userScopeNodeIds],
  );

  // Only the eligible approvers for a submission see it queued. Eligibility comes
  // from the org hierarchy (strict ancestors with an approver role); admins join
  // only when no in-chain approver exists so submissions don't skip the
  // immediate approver and pile up on the admin's desk.
  const canApproveAssessment = (a: InitiativeAssessment): boolean => {
    if (!can.approve(activeUser.role) || !isAwaitingDecision(a)) return false;
    const submitter = users.find((u) => u.id === a.createdByUserId);
    return getEligibleApprovers(submitter, users, orgNodes, a.delegatedToUserId).some((u) => u.id === activeUser.id);
  };

  const approvalQueue = useMemo(
    () => assessments.filter(canApproveAssessment),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assessments, activeUser, orgNodes, users],
  );

  const stats = useMemo(() => computeStats(visibleRows.length, assessments), [visibleRows, assessments]);

  const ensureAssessment = (
    initiativeId: string,
    objectiveId: string,
    pillarId: string,
    initiativeStatus: InitiativeStatus,
  ): InitiativeAssessment => {
    const existing = assessments.find((a) => a.initiativeId === initiativeId);
    if (existing) return existing;
    const created = newAssessment({ initiativeId, objectiveId, pillarId, createdByUserId: activeUser.id, initiativeStatus });
    persist([...assessments, created]);
    return created;
  };

  const updateAssessment = (id: string, mutate: (a: InitiativeAssessment) => InitiativeAssessment) =>
    persist(
      assessments.map((a) => {
        if (a.id !== id) return a;
        const next = mutate(a);
        next.updatedAt = new Date().toISOString();
        return next;
      }),
    );

  const note = (text: string) =>
    newAssessmentComment(activeUser.id, activeUser.name, ROLE_LABELS[activeUser.role], text);

  const submitForApproval = (a: InitiativeAssessment): boolean => {
    if (a.kpiAssessments.length === 0) {
      toast.error("Score at least one KPI before submitting.");
      return false;
    }
    updateAssessment(a.id, (prev) => ({ ...prev, status: "submitted", submittedAt: new Date().toISOString() }));
    toast.success("Submitted for approval");
    return true;
  };

  const approve = (a: InitiativeAssessment, comment: string): boolean => {
    updateAssessment(a.id, (prev) => ({
      ...prev,
      status: "approved",
      comments: comment.trim() ? [...prev.comments, note(`✓ Approved: ${comment.trim()}`)] : prev.comments,
    }));
    toast.success("Assessment approved");
    return true;
  };

  const reject = (a: InitiativeAssessment, comment: string): boolean => {
    if (!comment.trim()) {
      toast.error("Add rejection remarks");
      return false;
    }
    updateAssessment(a.id, (prev) => ({
      ...prev,
      status: "rejected",
      comments: [...prev.comments, note(`✗ Rejected: ${comment.trim()}`)],
    }));
    toast.success("Assessment rejected");
    return true;
  };

  const sendBack = (a: InitiativeAssessment, comment: string): boolean => {
    if (!comment.trim()) {
      toast.error("Add a comment so the input user knows what to fix");
      return false;
    }
    updateAssessment(a.id, (prev) => ({
      ...prev,
      status: "draft",
      submittedAt: undefined,
      comments: [...prev.comments, note(`↩ Returned for revision: ${comment.trim()}`)],
    }));
    toast.success("Sent back to input user");
    return true;
  };

  const delegate = (a: InitiativeAssessment, toUserId: string, comment: string): boolean => {
    const target = users.find((u) => u.id === toUserId);
    if (!target) {
      toast.error("Pick a user to delegate to");
      return false;
    }
    if (target.id === activeUser.id) {
      toast.error("You can't delegate to yourself");
      return false;
    }
    if (!can.approve(target.role)) {
      toast.error(`${target.name} doesn't have an approver role`);
      return false;
    }
    const who = `${target.name} (${ROLE_LABELS[target.role]})`;
    const text = comment.trim()
      ? `↗ Delegated upward to ${who}: ${comment.trim()}`
      : `↗ Delegated upward to ${who}.`;
    updateAssessment(a.id, (prev) => ({
      ...prev,
      delegatedToUserId: target.id,
      comments: [...prev.comments, note(text)],
    }));
    toast.success(`Delegated to ${target.name}`);
    return true;
  };

  return {
    cfg,
    orgNodes,
    assessments,
    users,
    isGlobalViewer,
    visibleRows,
    approvalQueue,
    stats,
    reload,
    ensureAssessment,
    updateAssessment,
    submitForApproval,
    approve,
    reject,
    sendBack,
    delegate,
  };
}
