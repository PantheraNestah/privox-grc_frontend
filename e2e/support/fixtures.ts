import { test as base, expect } from "@playwright/test";
import { ApiStubs } from "./api-stub";

/**
 * Base test. `stubs` intercepts every `/v1/**` request and fails the test on
 * teardown if the app called an endpoint the test did not declare — the
 * hermetic contract from `qa/harness/02-api-stubbing.md`.
 */
export const test = base.extend<{ stubs: ApiStubs }>({
  stubs: async ({ page }, provide) => {
    const stubs = new ApiStubs(page);
    await provide(stubs);
    expect(
      stubs.unstubbed,
      `Unstubbed API calls: ${stubs.unstubbed.join(", ")}`,
    ).toEqual([]);
  },
});

export { expect };
