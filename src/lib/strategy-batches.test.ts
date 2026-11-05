import { api } from "./api";
import {
  batchErrorMessage,
  dryRunJsonBatch,
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
