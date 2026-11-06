import { AxiosError } from "axios";
import { classifyLoadFailure } from "./query-error";

const failure = (status?: number) =>
  status === undefined
    ? new AxiosError("Network Error")
    : new AxiosError("failed", String(status), undefined, undefined, { status } as never);

describe("classifyLoadFailure", () => {
  it("treats a missing endpoint as 'not available', not as a fault", () => {
    const result = classifyLoadFailure(failure(404), "initiatives");
    expect(result.kind).toBe("not-found");
    expect(result.title).toMatch(/isn't available/);
    expect(result.retryable).toBe(false);
  });

  it("explains a permission failure without inviting a retry", () => {
    const result = classifyLoadFailure(failure(403), "conformance");
    expect(result.kind).toBe("forbidden");
    expect(result.message).toMatch(/role does not include conformance/);
    expect(result.retryable).toBe(false);
  });

  it("offers a retry for a server fault", () => {
    expect(classifyLoadFailure(failure(500), "batches")).toMatchObject({ kind: "server", retryable: true });
  });

  it("separates an offline device from a server error", () => {
    const result = classifyLoadFailure(failure(), "initiatives");
    expect(result.kind).toBe("offline");
    expect(result.retryable).toBe(true);
  });

  it("asks for a fresh sign-in on 401 instead of retrying", () => {
    expect(classifyLoadFailure(failure(401), "initiatives")).toMatchObject({ kind: "forbidden", retryable: false });
  });
});
