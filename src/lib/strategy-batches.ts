/**
 * Bulk strategy configuration (batches), templates, export and the
 * conformance / hierarchy-rule reads. Contract: integration guide §5.6.
 *
 * A batch is a whole plan submitted at once. Dry runs validate it without
 * writing. Applied and staged submissions return the same report body, and an
 * invalid plan returns it with HTTP 422.
 */

import { api } from "./api";

export type BatchMode = "CREATE_ONLY" | "UPSERT";
export type BatchOutcome = "VALID" | "INVALID" | "PENDING_APPROVAL" | "APPLIED";
export type BatchStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
export type BatchDecision = "APPROVE" | "REJECT" | "REQUEST_REVISION";
export type BatchAction = "CREATE" | "NEW_VERSION" | "UNCHANGED";

export interface BatchIssue {
  severity: "ERROR" | "WARNING";
  /** Rule id: F- format, C- content, S- structure, N- org node, E- existing data, W- warning. */
  rule: string;
  item?: string | null;
  message: string;
  field?: string | null;
  /**
   * Where the problem is: a JSON pointer, a line and column, or a spreadsheet
   * cell. The server sends it as an object, but the guide describes a string,
   * so both are accepted.
   */
  source?: BatchIssueSource | string | null;
  candidates?: string[] | null;
}

export interface BatchIssueSource {
  pointer?: string;
  line?: number;
  column?: number;
  cell?: string;
  [key: string]: unknown;
}

/** Human-readable location for an issue's source, or null when there is none. */
export function formatIssueSource(source: BatchIssue["source"]): string | null {
  if (!source) return null;
  if (typeof source === "string") return source;
  if (source.pointer) return source.pointer;
  if (source.cell) return `cell ${source.cell}`;
  if (source.line !== undefined) {
    return source.column !== undefined ? `line ${source.line}, column ${source.column}` : `line ${source.line}`;
  }
  return JSON.stringify(source);
}

/** How the reference in a plan resolved to an organization unit. */
export type BatchOrgNodeResolution = "ID" | "PATH" | "NAME" | "INHERITED";

/**
 * The organization unit a plan element is attached to.
 *
 * The server sends the resolution as `resolvedFrom`; `reference` is what the
 * plan said, and `inheritedFrom` names the ancestor whose unit was reused.
 * This shape is the same on a dry-run report and on a staged batch.
 */
export interface BatchOrgNode {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  path?: string | null;
  resolvedFrom?: BatchOrgNodeResolution | null;
  reference?: string | null;
  inheritedFrom?: string | null;
}

/** A node of the dry-run / submission report, which carries a verdict. */
export interface BatchTreeNode {
  key?: string | null;
  type: string;
  code?: string | null;
  title?: string | null;
  action: BatchAction;
  status: "OK" | "WARNING" | "ERROR";
  orgNode?: BatchOrgNode | null;
  children?: BatchTreeNode[] | null;
  existingParent?: string | null;
  targetValue?: number | null;
  unit?: string | null;
  direction?: string | null;
  baselineValue?: number | null;
}

export interface BatchReportSummary {
  total: number;
  byType?: Record<string, number>;
  create: number;
  newVersion: number;
  unchanged: number;
  errors: number;
  warnings: number;
}

/** Response of a dry run, an applied batch, a staged batch and a rejected plan. */
export interface BatchReport {
  dryRun: boolean;
  outcome: BatchOutcome;
  batchId?: string | null;
  approvalRequestId?: string | null;
  summary: BatchReportSummary;
  issues: BatchIssue[];
  issuesTruncated?: boolean;
  tree: BatchTreeNode[];
}

export interface BatchSummary {
  id: string;
  name: string;
  status: BatchStatus;
  sourceKind?: string | null;
  mode: BatchMode;
  elementCount: number;
  createdBy?: string | null;
  createdAt: string;
  decidedAt?: string | null;
  appliedAt?: string | null;
}

/**
 * A node of a staged or applied batch. Unlike `BatchTreeNode` it has no verdict:
 * the batch was validated when it was submitted, so `action` and `status` do not
 * exist here and a "Warning" badge would be fiction.
 */
export interface BatchPlanNode {
  key?: string | null;
  code?: string | null;
  type: string;
  title?: string | null;
  description?: string | null;
  outcomeSummary?: string | null;
  targetValue?: number | null;
  unit?: string | null;
  direction?: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | string | null;
  baselineValue?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  sortOrder?: number | null;
  orgNode?: BatchOrgNode | null;
  /** The org node was renamed, moved or ended after the batch was submitted. */
  pathChanged?: boolean | null;
  /** Where that node is now; only meaningful when `pathChanged` is true. */
  currentPath?: string | null;
  /** The element this node updates, when it is attached to an existing one. */
  existingParent?: string | null;
  elementId?: string | null;
  versionId?: string | null;
  children?: BatchPlanNode[] | null;
}

/** What applying a batch did to one code in its plan. */
export interface BatchResultEntry {
  elementId: string;
  versionId: string;
  action: BatchAction;
}

/**
 * `GET /batches/{batchId}`. The staged plan is `plan`, not the report's `tree`,
 * and `result` is keyed by element code, not a report summary. Both mistakes
 * made the review dialog show nothing (issue #46).
 */
export interface BatchDetail extends BatchSummary {
  sourceFilename?: string | null;
  plan: BatchPlanNode[];
  result?: Record<string, BatchResultEntry> | null;
  warnings?: BatchIssue[] | null;
  approvalStatus?: string | null;
  approvalRequestId?: string | null;
  approvalComments?: string | null;
  strictTypeHierarchyUsed?: boolean | null;
}

export interface BatchSubmission {
  /** HTTP status: 200 dry run valid, 201 applied, 202 staged, 422 invalid. */
  httpStatus: number;
  report: BatchReport;
}

export interface ConformanceElement {
  id: string;
  code?: string | null;
  type: string;
  parentElementId?: string | null;
  parentType?: string | null;
  orgNodeId?: string | null;
  orgNodeName?: string | null;
}

export interface StrategyConformance {
  organizationId: string;
  nonConformingElementCount: number;
  elements: ConformanceElement[];
}

export interface HierarchyRule {
  childType: string;
  allowedParentTypes: string[];
}

export interface StrategyHierarchyRules {
  organizationId: string;
  strictTypeHierarchy: boolean;
  rules: HierarchyRule[];
}

export type TemplateKind = "json" | "xlsx";

function basePath(orgId: string): string {
  return `/v1/organizations/${orgId}/strategy-formulation`;
}

/**
 * The guide returns the report body with 200, 201, 202 and 422. Axios throws
 * on 422, so read the report from the error and rethrow everything else.
 */
async function submissionFrom(
  request: Promise<{ status: number; data: BatchReport }>,
): Promise<BatchSubmission> {
  try {
    const response = await request;
    return { httpStatus: response.status, report: response.data };
  } catch (error) {
    const response = (error as { response?: { status?: number; data?: unknown } }).response;
    if (response?.status === 422 && response.data && typeof response.data === "object") {
      return { httpStatus: 422, report: response.data as BatchReport };
    }
    throw error;
  }
}

/** Server message for batch failures, with a plain-language fallback for the common statuses. */
export function batchErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { message?: string } } }).response;
  switch (response?.status) {
    case 409:
      return response.data?.message?.startsWith("DUPLICATE_BATCH")
        ? "This exact plan was already submitted and is still pending or applied."
        : response.data?.message || "Another change conflicts with this batch. Reload and try again.";
    case 413:
      return "The file is over the 2 MiB limit. Split it into smaller batches.";
    case 415:
      return "Upload a .json or .xlsx file that matches the chosen format.";
    case 404:
      return "Bulk import is turned off for this environment.";
    default:
      return response?.data?.message || "The batch request failed. Please try again.";
  }
}

/** Validates a JSON plan without writing anything. */
export function dryRunJsonBatch(orgId: string, plan: unknown, mode: BatchMode): Promise<BatchSubmission> {
  return submissionFrom(
    api.post<BatchReport>(`${basePath(orgId)}/batches`, plan, {
      params: { dryRun: true, mode },
    }),
  );
}

/** Submits a JSON plan: applied at once, or staged for approval, depending on the settings. */
export function submitJsonBatch(orgId: string, plan: unknown, mode: BatchMode): Promise<BatchSubmission> {
  return submissionFrom(api.post<BatchReport>(`${basePath(orgId)}/batches`, plan, { params: { mode } }));
}

export interface BatchFileOptions {
  name: string;
  mode: BatchMode;
  dryRun: boolean;
  format?: "json" | "xlsx";
}

/**
 * Uploads a .json or .xlsx plan as multipart/form-data.
 */
export function uploadBatchFile(orgId: string, file: File, options: BatchFileOptions): Promise<BatchSubmission> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", options.name);
  form.append("mode", options.mode);
  form.append("dryRun", String(options.dryRun));
  form.append("report", "json");
  if (options.format) form.append("format", options.format);
  // The shared client defaults to application/json, and axios then serialises
  // FormData as JSON. Marking this request multipart keeps the file intact;
  // the browser adds the boundary.
  return submissionFrom(
    api.post<BatchReport>(`${basePath(orgId)}/batches/file`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  );
}

export async function fetchBatches(orgId: string, status?: BatchStatus): Promise<BatchSummary[]> {
  const { data } = await api.get<BatchSummary[] | null>(`${basePath(orgId)}/batches`, {
    params: status ? { status } : undefined,
  });
  return Array.isArray(data) ? data : [];
}

export async function fetchBatch(orgId: string, batchId: string): Promise<BatchDetail> {
  const { data } = await api.get<BatchDetail>(`${basePath(orgId)}/batches/${batchId}`);
  return data;
}

export async function decideBatch(
  orgId: string,
  batchId: string,
  body: { decision: BatchDecision; comments?: string },
): Promise<BatchDetail> {
  const { data } = await api.post<BatchDetail>(`${basePath(orgId)}/batches/${batchId}/decision`, body);
  return data;
}

export async function fetchConformance(orgId: string): Promise<StrategyConformance> {
  const { data } = await api.get<StrategyConformance>(`${basePath(orgId)}/settings/conformance`);
  return data;
}

export async function fetchHierarchyRules(orgId: string): Promise<StrategyHierarchyRules> {
  const { data } = await api.get<StrategyHierarchyRules>(`${basePath(orgId)}/hierarchy-rules`);
  return data;
}

/** Downloads a file as a blob. Content-Disposition is not readable cross-origin, so the caller names the file. */
async function fetchBlob(url: string, params?: Record<string, string | boolean>): Promise<Blob> {
  const { data } = await api.get<Blob>(url, { params, responseType: "blob" });
  return data;
}

export function fetchTemplate(orgId: string, kind: TemplateKind): Promise<Blob> {
  return fetchBlob(`${basePath(orgId)}/templates/${kind}`, { examples: true });
}

export function fetchBatchSchema(orgId: string): Promise<Blob> {
  return fetchBlob(`${basePath(orgId)}/templates/schema`);
}

export function exportFormulation(orgId: string, format: TemplateKind): Promise<Blob> {
  return fetchBlob(`${basePath(orgId)}/export`, { format });
}

/** Saves a blob under a name chosen here, because the server's file name is not readable. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Checks a spreadsheet and returns it back annotated with a result per row,
 * so the author can fix the flagged rows and upload it again. The guide only
 * allows this on a dry run of an .xlsx upload.
 */
export async function fetchAnnotatedBatchWorkbook(
  orgId: string,
  file: File,
  options: { name: string; mode: BatchMode },
): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", options.name);
  form.append("mode", options.mode);
  form.append("dryRun", "true");
  form.append("report", "xlsx");
  const { data } = await api.post<Blob>(`${basePath(orgId)}/batches/file`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    responseType: "blob",
  });
  return data;
}
