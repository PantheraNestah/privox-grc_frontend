// Local-storage backed user directory + active session for the prototype.
// Roles drive what the user can do across the Strategy modules.

import { uid } from "./orgStore";

export type UserRole = "admin" | "input_user" | "approver" | "risk_manager" | "executive";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orgNodeId?: string;       // optional link into Risk Governance hierarchy
  title?: string;
  createdAt: string;
}

const USERS_KEY = "rsolve.users.v1";
const ACTIVE_KEY = "rsolve.users.active.v1";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  input_user: "Input User",
  approver: "Approver",
  risk_manager: "Risk Manager",
  executive: "Executive",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Manages users and has full access across the platform.",
  input_user: "Builds the strategic plan and submits self-assessments.",
  approver: "Reviews submissions for their assigned organisation unit.",
  risk_manager: "Read-only oversight across all units; can comment.",
  executive: "Read-only dashboards and final-level approval.",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: "265 88% 66%",
  input_user: "210 61% 49%",
  approver: "34 89% 61%",
  risk_manager: "192 60% 53%",
  executive: "231 53% 37%",
};

const SEED_USERS: AppUser[] = [
  {
    id: uid("usr"),
    name: "System Admin",
    email: "admin@rsolve.local",
    role: "admin",
    title: "GRC Administrator",
    createdAt: new Date().toISOString(),
  },
];

export function loadUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
      return SEED_USERS;
    }
    const parsed = JSON.parse(raw) as AppUser[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_USERS;
  } catch {
    return SEED_USERS;
  }
}

export function saveUsers(users: AppUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function newUser(): AppUser {
  return {
    id: uid("usr"),
    name: "",
    email: "",
    role: "input_user",
    title: "",
    createdAt: new Date().toISOString(),
  };
}

export function getActiveUserId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveUserId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
  // notify same-tab listeners
  window.dispatchEvent(new CustomEvent("rsolve:active-user-changed"));
}

export function getActiveUser(): AppUser {
  const users = loadUsers();
  const id = getActiveUserId();
  const found = id ? users.find(u => u.id === id) : null;
  if (found) return found;
  // default to first admin
  const admin = users.find(u => u.role === "admin") ?? users[0];
  if (admin) setActiveUserId(admin.id);
  return admin;
}

// ---- Permission helpers (single source of truth) ----
export const can = {
  manageUsers: (r: UserRole) => r === "admin",
  /** ONLY Admin defines the strategic pillars all users will link to. */
  editPillars: (r: UserRole) => r === "admin",
  /** EVERY authenticated role can build their own objectives → initiatives → activities → outcomes → KPIs. */
  editStrategyPlan: (_r: UserRole) => true,
  /** Every user self-assesses what they own. */
  submitAssessment: (_r: UserRole) => true,
  /** Approvers must sit ABOVE the submitter in the org hierarchy. Role gate kept for non-hierarchy roles. */
  approve: (r: UserRole) => r === "admin" || r === "approver" || r === "executive" || r === "risk_manager",
  commentOnAssessment: (r: UserRole) => r !== "executive",
  viewAssessment: (_r: UserRole) => true,
  /** Admin & Risk Manager can reset a locked formulation/assessment back to draft so the input user can edit. */
  resetWorkflow: (r: UserRole) => r === "admin" || r === "risk_manager",
  /** Admin, Risk Manager and Executive get a global view across all units (e.g. Document Management). */
  viewAllScopes: (r: UserRole) => r === "admin" || r === "risk_manager" || r === "executive",
  /** Who can author/edit policy & procedure documents. */
  manageDocuments: (r: UserRole) => r === "admin" || r === "risk_manager" || r === "input_user",
  /** Only Admin & Risk Manager can design and publish surveys/questionnaires. */
  manageSurveys: (r: UserRole) => r === "admin" || r === "risk_manager",
};
