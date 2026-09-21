import { AxiosError, type AxiosResponse } from "axios";
import { shouldRetryQuery } from "./query-client";

const httpError = (status: number) =>
  new AxiosError("failed", String(status), undefined, undefined, { status } as AxiosResponse);

describe("shouldRetryQuery", () => {
  it("fails fast on client errors", () => {
    expect(shouldRetryQuery(0, httpError(401))).toBe(false);
    expect(shouldRetryQuery(0, httpError(403))).toBe(false);
    expect(shouldRetryQuery(0, httpError(404))).toBe(false);
  });

  it("retries throttling and timeouts", () => {
    expect(shouldRetryQuery(0, httpError(429))).toBe(true);
    expect(shouldRetryQuery(0, httpError(408))).toBe(true);
  });

  it("retries server and network failures twice", () => {
    expect(shouldRetryQuery(0, httpError(503))).toBe(true);
    expect(shouldRetryQuery(1, new AxiosError("Network Error"))).toBe(true);
    expect(shouldRetryQuery(2, httpError(503))).toBe(false);
  });
});
