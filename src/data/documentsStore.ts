// Local-storage backed document repository (policies, standards, procedures, guidelines).
// Documents are linked to nodes in the Risk Governance org tree.
// Documents follow a 2-step approval workflow: Author → Approver → Risk Manager (final).
//
// Each document has a STRUCTURED body composed of standard sections (Purpose, Scope,
// Definitions, Abbreviations, Roles & Responsibilities, etc.) that follow the conventions
// of policy / standard / procedure / guideline writing. Authors can also attach the
// authoritative source file (PDF / DOCX / etc.) instead of re-typing from scratch.

import { uid } from "./orgStore";
import type { ApprovalStep, ApprovalDecision, ApprovalRole } from "./strategyStore";
import { buildTwoStepApprovalChain } from "./strategyStore";

export type DocumentType = "policy" | "standard" | "procedure" | "guideline";

export type DocumentStatus = "draft" | "current" | "expired";

/** Lifecycle of a document through its approval workflow. */
export type DocumentApprovalStatus = "draft" | "submitted" | "approved" | "rejected";

/** A single editable section inside a document body (e.g. "Purpose", "Scope"). */
export interface DocumentSection {
  id: string;
  heading: string;
  body: string;
}

/** A defined term / abbreviation used in the document. */
export interface DocumentAbbreviation {
  id: string;
  term: string;
  meaning: string;
}

/** External reference (standard, regulation, related policy, etc.). */
export interface DocumentReference {
  id: string;
  label: string;
  source?: string;     // e.g. "ISO 27001 §A.5.1"
  url?: string;
}

/** Single revision-history entry. */
export interface DocumentRevision {
  id: string;
  version: string;
  date: string;        // ISO yyyy-mm-dd
  author: string;
  summary: string;
}

/** Optional uploaded source file (stored as base64 data URL for the prototype). */
export interface DocumentAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** data:<mime>;base64,<payload> — playable directly with anchor download. */
  dataUrl: string;
  uploadedAt: string;
  uploadedByUserId?: string;
}

export interface PolicyDocument {
  id: string;
  title: string;
  type: DocumentType;
  version: string;
  description?: string;
  /** Plain-text body — kept for backwards compatibility. New documents use `sections`. */
  content: string;
  /** Structured sections rendered in order to form the document body. */
  sections: DocumentSection[];
  /** Defined terms and acronyms, rendered as an Abbreviations table. */
  abbreviations: DocumentAbbreviation[];
  /** External references, standards, related documents. */
  references: DocumentReference[];
  /** Version history entries shown at the end of the document. */
  revisionHistory: DocumentRevision[];
  /** Optional uploaded source file (PDF/DOCX/etc.). */
  attachment?: DocumentAttachment;
  /** Org-tree node ids this document applies to (any level). */
  linkedOrgNodeIds: string[];
  effectiveDate?: string;   // ISO yyyy-mm-dd — when it became active
  reviewDate?: string;      // ISO yyyy-mm-dd — when it next needs review (drives currency)
  owner?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
  /** 2-step approval chain: Approver → Risk Manager (final). */
  approvalStatus: DocumentApprovalStatus;
  approvals: ApprovalStep[];
  submittedAt?: string;
  submittedByUserId?: string;
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  policy: "Policy",
  standard: "Standard",
  procedure: "Procedure",
  guideline: "Guideline",
};

export const DOCUMENT_TYPE_COLORS: Record<DocumentType, string> = {
  policy: "231 53% 37%",
  standard: "210 61% 49%",
  procedure: "158 53% 49%",
  guideline: "265 88% 66%",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Draft",
  current: "Current",
  expired: "Expired / Due review",
};

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: "215 16% 47%",
  current: "158 53% 49%",
  expired: "352 70% 61%",
};

export const DOC_APPROVAL_STATUS_LABELS: Record<DocumentApprovalStatus, string> = {
  draft: "Draft (Author)",
  submitted: "In Approval",
  approved: "Approved",
  rejected: "Rejected",
};

export const DOC_APPROVAL_STATUS_COLORS: Record<DocumentApprovalStatus, string> = {
  draft: "215 16% 47%",
  submitted: "210 61% 49%",
  approved: "158 53% 49%",
  rejected: "352 70% 61%",
};

const KEY = "rsolve.documents.v1";

/** Maximum size of an uploaded attachment before we refuse to base64-store it.
 *  Browsers cap localStorage around 5MB total, so we keep individual files small. */
export const MAX_ATTACHMENT_BYTES = 1_500_000; // ~1.5 MB

/** Standard section templates per document type. Templates are based on common
 *  governance documentation conventions (ISO/IEC 27001, COBIT, NIST style guides). */
export const DOCUMENT_TEMPLATES: Record<DocumentType, { sections: { heading: string; body: string }[] }> = {
  policy: {
    sections: [
      { heading: "1. Purpose", body: "State the intent of this policy and the risk it manages." },
      { heading: "2. Scope", body: "Identify which business units, systems, processes and personnel this policy applies to." },
      { heading: "3. Policy Statements", body: "List the binding rules, expressed as 'shall' / 'must' statements." },
      { heading: "4. Roles & Responsibilities", body: "Describe accountabilities for executives, managers, end users and assurance functions." },
      { heading: "5. Compliance & Enforcement", body: "Explain how compliance is monitored and the consequences of non-compliance." },
      { heading: "6. Exceptions", body: "Document the formal process for requesting and approving exceptions to this policy." },
      { heading: "7. Related Documents", body: "Reference standards, procedures and guidelines that support this policy." },
    ],
  },
  standard: {
    sections: [
      { heading: "1. Purpose", body: "Explain the technical / operational outcome this standard delivers." },
      { heading: "2. Scope", body: "Identify the systems, environments and lifecycles this standard applies to." },
      { heading: "3. Mandatory Requirements", body: "List the specific, measurable, testable requirements (configuration, controls, thresholds)." },
      { heading: "4. Implementation Guidance", body: "Provide examples, recommended tooling and accepted patterns." },
      { heading: "5. Roles & Responsibilities", body: "Identify the owners, implementers and reviewers." },
      { heading: "6. Compliance Verification", body: "Describe how conformance is tested (audits, scans, attestations)." },
      { heading: "7. Related Documents", body: "Reference the parent policy and supporting procedures." },
    ],
  },
  procedure: {
    sections: [
      { heading: "1. Purpose", body: "State what task this procedure enables and the outcome it produces." },
      { heading: "2. Scope", body: "Identify when this procedure applies and to whom." },
      { heading: "3. Pre-requisites", body: "List the access, tools, approvals and inputs required before starting." },
      { heading: "4. Step-by-step Instructions", body: "1.\n2.\n3.\nNumbered, in order, with the expected result of each step." },
      { heading: "5. Roles & Responsibilities", body: "Specify who performs, who reviews and who approves." },
      { heading: "6. Records & Evidence", body: "Identify the artefacts produced and where they are stored for audit." },
      { heading: "7. Related Documents", body: "Link to the policy and standard this procedure operationalises." },
    ],
  },
  guideline: {
    sections: [
      { heading: "1. Purpose", body: "Explain why this guidance exists and what good looks like." },
      { heading: "2. Audience", body: "Identify who should read and apply this guideline." },
      { heading: "3. Recommended Practices", body: "Describe the recommended (non-mandatory) approaches and patterns." },
      { heading: "4. Examples", body: "Provide worked examples or scenarios that illustrate good outcomes." },
      { heading: "5. Anti-patterns to Avoid", body: "Common pitfalls and what to do instead." },
      { heading: "6. Related Documents", body: "Reference the policies, standards or procedures this guideline supports." },
    ],
  },
};

export function loadDocuments(): PolicyDocument[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw) as PolicyDocument[];
    // Migration: older docs may not have approval / structured fields
    return parsed.map(d => ({
      ...d,
      approvalStatus: d.approvalStatus ?? "draft",
      approvals: d.approvals ?? [],
      sections: d.sections ?? (d.content ? [{ id: uid("sec"), heading: "Body", body: d.content }] : []),
      abbreviations: d.abbreviations ?? [],
      references: d.references ?? [],
      revisionHistory: d.revisionHistory ?? [],
    }));
  } catch {
    return [];
  }
}

export function saveDocuments(docs: PolicyDocument[]) {
  localStorage.setItem(KEY, JSON.stringify(docs));
}

/** Build a fresh document, pre-populated with the template for the given type. */
export function newDocument(type: DocumentType = "policy"): PolicyDocument {
  const now = new Date().toISOString();
  return {
    id: uid("doc"),
    title: "",
    type,
    version: "1.0",
    description: "",
    content: "",
    sections: DOCUMENT_TEMPLATES[type].sections.map(s => ({ id: uid("sec"), ...s })),
    abbreviations: [],
    references: [],
    revisionHistory: [],
    linkedOrgNodeIds: [],
    effectiveDate: "",
    reviewDate: "",
    owner: "",
    createdAt: now,
    updatedAt: now,
    approvalStatus: "draft",
    approvals: [],
  };
}

/** Replace the document body with the standard template for the given type.
 *  Existing custom sections are discarded — caller should confirm. */
export function applyTemplate(d: PolicyDocument, type: DocumentType): PolicyDocument {
  return {
    ...d,
    type,
    sections: DOCUMENT_TEMPLATES[type].sections.map(s => ({ id: uid("sec"), ...s })),
  };
}

export const newSection = (heading = "New section"): DocumentSection => ({ id: uid("sec"), heading, body: "" });
export const newAbbreviation = (): DocumentAbbreviation => ({ id: uid("abbr"), term: "", meaning: "" });
export const newReference = (): DocumentReference => ({ id: uid("ref"), label: "", source: "", url: "" });
export const newRevision = (version: string, author: string): DocumentRevision => ({
  id: uid("rev"),
  version,
  date: new Date().toISOString().slice(0, 10),
  author,
  summary: "",
});

/** Compute current/expired/draft status from review date and effective date.
 *  Documents not yet approved are always 'draft' regardless of dates. */
export function computeDocumentStatus(d: PolicyDocument): DocumentStatus {
  if (d.approvalStatus !== "approved") return "draft";
  if (!d.effectiveDate) return "draft";
  if (d.reviewDate) {
    const review = new Date(d.reviewDate);
    if (!isNaN(review.getTime()) && review.getTime() < Date.now()) return "expired";
  }
  return "current";
}

/** Recompute approvalStatus from the approval chain. */
export function recomputeDocApprovalStatus(d: PolicyDocument): DocumentApprovalStatus {
  if (d.approvalStatus === "draft") return "draft";
  const decisions = d.approvals.map(s => s.decision);
  if (decisions.length === 0) return d.approvalStatus;
  if (decisions.some(x => x === "rejected")) return "rejected";
  if (decisions.every(x => x === "approved")) return "approved";
  return "submitted";
}

/** Read a File and return a base64 data URL — used to persist attachments in
 *  localStorage. Rejects if the file is over MAX_ATTACHMENT_BYTES. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      reject(new Error(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max ${(MAX_ATTACHMENT_BYTES / 1024 / 1024).toFixed(1)}MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Format a byte count in a human-readable way. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export { buildTwoStepApprovalChain };
export type { ApprovalStep, ApprovalDecision, ApprovalRole };
