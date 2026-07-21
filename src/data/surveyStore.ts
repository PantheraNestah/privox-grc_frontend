// Local-storage backed Questionnaire / Survey module.
// Designed by Admin or Risk Manager. Published to internal users (by role or org node),
// to a mock Active Directory list, or to external email addresses via tokenized links.

import { uid } from "./orgStore";
import type { UserRole } from "./userStore";

export type SurveyCategory =
  | "risk_culture"
  | "risk_governance"
  | "vendor_management"
  | "data_management"
  | "risk_management"
  | "custom";

export const SURVEY_CATEGORY_LABELS: Record<SurveyCategory, string> = {
  risk_culture: "Risk Culture",
  risk_governance: "Risk Governance",
  vendor_management: "Vendor Management",
  data_management: "Data Management",
  risk_management: "Risk Management",
  custom: "Custom",
};

export type ScoringModel = "weighted" | "maturity" | "none";

export const SCORING_LABELS: Record<ScoringModel, string> = {
  weighted: "Weighted (per-question score)",
  maturity: "Maturity (1-5 average)",
  none: "No scoring (responses only)",
};

export type QuestionType = "single" | "multi" | "scale" | "text" | "yes_no";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: "Single choice",
  multi: "Multiple choice",
  scale: "Scale (1-5)",
  text: "Free text",
  yes_no: "Yes / No",
};

export interface QuestionOption {
  id: string;
  label: string;
  /** Weighted-scoring: 0..1 contribution if selected. Maturity: ignored (scale uses position). */
  score?: number;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  /** Weight applied to this question's score (weighted model). */
  weight: number;
  /** For single/multi/yes_no */
  options: QuestionOption[];
}

export type AudienceType = "roles" | "ad_all_staff" | "external" | "org_units";

export const AUDIENCE_LABELS: Record<AudienceType, string> = {
  roles: "System users by role",
  ad_all_staff: "All staff (Active Directory)",
  external: "External parties (email)",
  org_units: "Specific org units",
};

export interface SurveyAudience {
  type: AudienceType;
  /** roles → list of UserRole; org_units → list of OrgNode ids; external/ad → list of emails */
  values: string[];
}

export type SurveyStatus = "draft" | "published" | "closed";

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
};

export const SURVEY_STATUS_COLORS: Record<SurveyStatus, string> = {
  draft: "215 16% 47%",
  published: "158 53% 49%",
  closed: "352 70% 61%",
};

export interface Survey {
  id: string;
  title: string;
  description?: string;
  category: SurveyCategory;
  scoring: ScoringModel;
  questions: Question[];
  audiences: SurveyAudience[];
  status: SurveyStatus;
  createdByUserId: string;
  createdAt: string;
  publishedAt?: string;
  closedAt?: string;
  /** ISO date the survey closes automatically. */
  dueDate?: string;
}

export interface SurveyAnswer {
  questionId: string;
  /** For text — string. For single/yes_no — option id. For multi — array of option ids. For scale — number 1-5. */
  value: string | string[] | number | null;
}

export type RespondentChannel = "internal_user" | "ad_staff" | "external";

export interface SurveyResponse {
  id: string;
  surveyId: string;
  channel: RespondentChannel;
  /** internal_user: user id; ad_staff/external: email */
  respondentRef: string;
  respondentName?: string;
  /** External link token (only for external responses). */
  token?: string;
  startedAt: string;
  submittedAt?: string;
  answers: SurveyAnswer[];
  /** Computed score (% for weighted, 1-5 average for maturity, undefined for none). */
  score?: number;
}

const SURVEY_KEY = "rsolve.surveys.v1";
const RESPONSE_KEY = "rsolve.survey-responses.v1";
const AD_STAFF_KEY = "rsolve.ad-staff.v1";

interface SurveyStore { surveys: Survey[]; }
interface ResponseStore { responses: SurveyResponse[]; }

// ---- Mock Active Directory directory ----
export interface AdStaffMember {
  email: string;
  name: string;
  department?: string;
}

const SEED_AD_STAFF: AdStaffMember[] = [
  { email: "alice.smith@company.com", name: "Alice Smith", department: "Finance" },
  { email: "bob.jones@company.com", name: "Bob Jones", department: "Operations" },
  { email: "carol.lee@company.com", name: "Carol Lee", department: "IT" },
  { email: "dave.kim@company.com", name: "Dave Kim", department: "HR" },
  { email: "eve.patel@company.com", name: "Eve Patel", department: "Risk" },
  { email: "frank.ruiz@company.com", name: "Frank Ruiz", department: "Legal" },
];

export function loadAdStaff(): AdStaffMember[] {
  try {
    const raw = localStorage.getItem(AD_STAFF_KEY);
    if (!raw) {
      localStorage.setItem(AD_STAFF_KEY, JSON.stringify(SEED_AD_STAFF));
      return SEED_AD_STAFF;
    }
    return JSON.parse(raw) as AdStaffMember[];
  } catch {
    return SEED_AD_STAFF;
  }
}

export function saveAdStaff(list: AdStaffMember[]) {
  localStorage.setItem(AD_STAFF_KEY, JSON.stringify(list));
}

// ---- Surveys ----
export function loadSurveys(): Survey[] {
  try {
    const raw = localStorage.getItem(SURVEY_KEY);
    if (!raw) {
      localStorage.setItem(SURVEY_KEY, JSON.stringify({ surveys: [] }));
      return [];
    }
    return (JSON.parse(raw) as SurveyStore).surveys ?? [];
  } catch {
    return [];
  }
}

export function saveSurveys(list: Survey[]) {
  localStorage.setItem(SURVEY_KEY, JSON.stringify({ surveys: list }));
}

export function newSurvey(createdByUserId: string): Survey {
  return {
    id: uid("svy"),
    title: "",
    description: "",
    category: "custom",
    scoring: "weighted",
    questions: [],
    audiences: [],
    status: "draft",
    createdByUserId,
    createdAt: new Date().toISOString(),
  };
}

export function newQuestion(): Question {
  return {
    id: uid("q"),
    text: "",
    type: "single",
    required: true,
    weight: 1,
    options: [
      { id: uid("opt"), label: "Option 1", score: 1 },
      { id: uid("opt"), label: "Option 2", score: 0 },
    ],
  };
}

export function newOption(): QuestionOption {
  return { id: uid("opt"), label: "", score: 0 };
}

// ---- Responses ----
export function loadResponses(): SurveyResponse[] {
  try {
    const raw = localStorage.getItem(RESPONSE_KEY);
    if (!raw) {
      localStorage.setItem(RESPONSE_KEY, JSON.stringify({ responses: [] }));
      return [];
    }
    return (JSON.parse(raw) as ResponseStore).responses ?? [];
  } catch {
    return [];
  }
}

export function saveResponses(list: SurveyResponse[]) {
  localStorage.setItem(RESPONSE_KEY, JSON.stringify({ responses: list }));
}

export function newResponse(args: {
  surveyId: string;
  channel: RespondentChannel;
  respondentRef: string;
  respondentName?: string;
  token?: string;
}): SurveyResponse {
  return {
    id: uid("rsp"),
    surveyId: args.surveyId,
    channel: args.channel,
    respondentRef: args.respondentRef,
    respondentName: args.respondentName,
    token: args.token,
    startedAt: new Date().toISOString(),
    answers: [],
  };
}

/** Compute the expected respondent universe size for a survey, given internal users + AD list. */
export function expectedRespondentCount(
  s: Survey,
  internalUsers: { id: string; role: UserRole; orgNodeId?: string }[],
  adStaff: AdStaffMember[],
): number {
  let count = 0;
  for (const aud of s.audiences) {
    if (aud.type === "roles") {
      count += internalUsers.filter(u => aud.values.includes(u.role)).length;
    } else if (aud.type === "org_units") {
      count += internalUsers.filter(u => u.orgNodeId && aud.values.includes(u.orgNodeId)).length;
    } else if (aud.type === "ad_all_staff") {
      count += adStaff.length;
    } else if (aud.type === "external") {
      count += aud.values.length;
    }
  }
  return count;
}

/** Score a single response per the survey's scoring model. */
export function scoreResponse(s: Survey, r: SurveyResponse): number | undefined {
  if (s.scoring === "none") return undefined;

  if (s.scoring === "maturity") {
    const scaleAnswers = r.answers
      .map(a => {
        const q = s.questions.find(qq => qq.id === a.questionId);
        if (!q) return null;
        if (q.type === "scale" && typeof a.value === "number") return a.value;
        // Map yes_no / single onto 1-5 where possible (yes=5, no=1)
        if (q.type === "yes_no") return a.value === "yes" ? 5 : a.value === "no" ? 1 : null;
        return null;
      })
      .filter((v): v is number => typeof v === "number");
    if (scaleAnswers.length === 0) return 0;
    return Number((scaleAnswers.reduce((a, b) => a + b, 0) / scaleAnswers.length).toFixed(2));
  }

  // weighted
  let totalWeight = 0;
  let earned = 0;
  for (const q of s.questions) {
    const weight = q.weight ?? 1;
    totalWeight += weight;
    const ans = r.answers.find(a => a.questionId === q.id);
    if (!ans) continue;
    let frac = 0;
    if (q.type === "single" || q.type === "yes_no") {
      const opt = q.options.find(o => o.id === ans.value);
      frac = opt?.score ?? 0;
    } else if (q.type === "multi" && Array.isArray(ans.value)) {
      const max = q.options.reduce((sum, o) => sum + (o.score ?? 0), 0) || 1;
      const got = q.options
        .filter(o => (ans.value as string[]).includes(o.id))
        .reduce((sum, o) => sum + (o.score ?? 0), 0);
      frac = Math.max(0, Math.min(1, got / max));
    } else if (q.type === "scale" && typeof ans.value === "number") {
      frac = Math.max(0, Math.min(1, (ans.value - 1) / 4)); // 1→0, 5→1
    } else if (q.type === "text") {
      frac = ans.value && String(ans.value).trim().length > 0 ? 1 : 0;
    }
    earned += weight * frac;
  }
  if (totalWeight === 0) return 0;
  return Number(((earned / totalWeight) * 100).toFixed(1));
}

/** Generate a short opaque token for external respondents. */
export function generateToken(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}
