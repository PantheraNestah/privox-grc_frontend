import { api } from "./api";
import { liveAppliedBatchDetail, liveBatchDetail, liveDryRunReport } from "./strategy-batches.fixture";
import {
  batchErrorMessage,
  dryRunJsonBatch,
  fetchAnnotatedBatchWorkbook,
  formatIssueSource,
  submitJsonBatch,
  uploadBatchFile,
  type BatchReport,
} from "./strategy-batches";

const report = (outcome: BatchReport["outcome"]): BatchReport => ({
  dryRun: outcome === "VALID",
  outcome,
  summary: { total: 2, create: 2, newVersion: 0, unchanged: 0, errors: 0, warnings: 0 },
  issues: [],
  tree: [],
});

describe("batch submissions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts a dry run with dryRun=true and returns the report on 200", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ status: 200, data: report("VALID") } as never);

    const result = await dryRunJsonBatch("org-1", { elements: [] }, "UPSERT");

    expect(post).toHaveBeenCalledWith(
      "/v1/organizations/org-1/strategy-formulation/batches",
      { elements: [] },
      { params: { dryRun: true, mode: "UPSERT" } },
    );
    expect(result).toEqual({ httpStatus: 200, report: report("VALID") });
  });

  it("reads the report from a 422 instead of throwing, so issues can be shown", async () => {
    const invalid = { ...report("INVALID"), summary: { ...report("INVALID").summary, errors: 1 } };
    vi.spyOn(api, "post").mockRejectedValue({ response: { status: 422, data: invalid } });

    const result = await submitJsonBatch("org-1", { elements: [] }, "CREATE_ONLY");

    expect(result.httpStatus).toBe(422);
    expect(result.report.outcome).toBe("INVALID");
  });

  it("keeps the 202 staged status so the UI can say it is awaiting approval", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ status: 202, data: report("PENDING_APPROVAL") } as never);

    const result = await submitJsonBatch("org-1", { elements: [] }, "CREATE_ONLY");

    expect(result.httpStatus).toBe(202);
  });

  it("sends a file as multipart with the guide's form fields", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ status: 200, data: report("VALID") } as never);
    const file = new File(["{}"], "plan.json", { type: "application/json" });

    await uploadBatchFile("org-1", file, { name: "FY27", mode: "CREATE_ONLY", dryRun: true, format: "json" });

    const [url, body] = post.mock.calls[0] as [string, FormData];
    expect(url).toBe("/v1/organizations/org-1/strategy-formulation/batches/file");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("file")).toBe(file);
    expect(body.get("name")).toBe("FY27");
    expect(body.get("mode")).toBe("CREATE_ONLY");
    expect(body.get("dryRun")).toBe("true");
    expect(body.get("report")).toBe("json");
    expect(body.get("format")).toBe("json");
  });
});

describe("batchErrorMessage", () => {
  it("explains a duplicate plan", () => {
    expect(
      batchErrorMessage({ response: { status: 409, data: { message: "DUPLICATE_BATCH: already submitted" } } }),
    ).toMatch(/already been submitted|already submitted/i);
  });

  it("explains the file size limit", () => {
    expect(batchErrorMessage({ response: { status: 413, data: {} } })).toMatch(/2 MiB/);
  });

  it("explains an unsupported file type", () => {
    expect(batchErrorMessage({ response: { status: 415, data: {} } })).toMatch(/\.json or \.xlsx/);
  });

  it("explains that import is switched off when the endpoint is missing", () => {
    expect(batchErrorMessage({ response: { status: 404, data: {} } })).toMatch(/turned off/);
  });
});

describe("formatIssueSource", () => {
  it("renders the server's object forms and the guide's string form", () => {
    expect(formatIssueSource({ pointer: "/elements/1/orgNode" })).toBe("/elements/1/orgNode");
    expect(formatIssueSource({ line: 4, column: 9 })).toBe("line 4, column 9");
    expect(formatIssueSource({ cell: "C7" })).toBe("cell C7");
    expect(formatIssueSource("/elements/0")).toBe("/elements/0");
    expect(formatIssueSource(null)).toBeNull();
  });
});

describe("annotated workbook", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks for an annotated xlsx report on a dry run and returns the blob", async () => {
    const workbook = new Blob(["xlsx"]);
    const post = vi.spyOn(api, "post").mockResolvedValue({ status: 200, data: workbook } as never);
    const file = new File(["x"], "plan.xlsx");

    const result = await fetchAnnotatedBatchWorkbook("org-1", file, { name: "FY27", mode: "UPSERT" });

    const [, body, config] = post.mock.calls[0] as [string, FormData, { responseType: string }];
    expect(body.get("report")).toBe("xlsx");
    expect(body.get("dryRun")).toBe("true");
    expect(body.get("mode")).toBe("UPSERT");
    expect(config.responseType).toBe("blob");
    expect(result).toBe(workbook);
  });
});

describe("batch detail contract (issue #46)", () => {
  it("reads a staged plan from `plan`, not the report's `tree`", () => {
    expect(liveBatchDetail).not.toHaveProperty("tree");
    expect(liveBatchDetail.plan).toHaveLength(1);
    expect(liveBatchDetail.plan[0].type).toBe("PILLAR");
    expect(liveBatchDetail.elementCount).toBe(4);
    expect(liveBatchDetail.approvalStatus).toBe("PENDING");
    expect(liveBatchDetail.strictTypeHierarchyUsed).toBe(true);
    expect(liveBatchDetail.sourceFilename).toMatch(/\.xlsx$/);
  });

  it("uses resolvedFrom, not matchedBy, on batch and report org nodes", () => {
    const objective = liveBatchDetail.plan[0].children?.[0];
    expect(objective?.orgNode?.resolvedFrom).toBe("PATH");
    expect(objective?.orgNode).not.toHaveProperty("matchedBy");

    const reportOrgNode = liveDryRunReport.tree[0].children?.[0]?.orgNode;
    expect(reportOrgNode?.resolvedFrom).toBe("NAME");
    expect(reportOrgNode).not.toHaveProperty("matchedBy");
  });

  it("keeps drift on the node that moved, not on the batch", () => {
    expect(liveBatchDetail).not.toHaveProperty("pathChanged");
    const initiative = liveBatchDetail.plan[0].children?.[0]?.children?.[0];
    expect(initiative?.pathChanged).toBe(true);
    expect(initiative?.currentPath).toMatch(/reorganised/);
  });

  it("types the applied result as a code-keyed map of element outcomes", () => {
    expect(liveAppliedBatchDetail.result?.["GNB27-P1"]).toMatchObject({
      action: "CREATE",
      elementId: expect.any(String),
      versionId: expect.any(String),
    });
    expect(liveAppliedBatchDetail.result?.["GNB27-O1"]?.action).toBe("UNCHANGED");
  });
});
