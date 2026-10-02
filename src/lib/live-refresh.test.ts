import { REFRESH_INTERVALS, autoRefreshInterval } from "./live-refresh";

describe("autoRefreshInterval", () => {
  it("exposes named cadences in increasing order", () => {
    expect(REFRESH_INTERVALS.fast).toBeLessThan(REFRESH_INTERVALS.standard);
    expect(REFRESH_INTERVALS.standard).toBeLessThan(REFRESH_INTERVALS.slow);
  });

  it("polls on the cadence while the query is healthy", () => {
    const interval = autoRefreshInterval("standard");
    expect(interval({ state: { status: "success" } })).toBe(REFRESH_INTERVALS.standard);
    expect(interval({ state: { status: "pending" } })).toBe(REFRESH_INTERVALS.standard);
  });

  it("stops polling once the query has failed so a 403/500 is not retried every tick", () => {
    const interval = autoRefreshInterval("fast");
    expect(interval({ state: { status: "error" } })).toBe(false);
  });
});
