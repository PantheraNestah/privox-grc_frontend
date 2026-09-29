import { buildDefaultConfig } from "@/data/orgStore";
import { toCreateRiskStrategyVersionRequest } from "./risk-strategy-mapping";

describe("toCreateRiskStrategyVersionRequest", () => {
  it("targets the Enterprise Baseline when no org node is supplied", () => {
    const req = toCreateRiskStrategyVersionRequest(buildDefaultConfig(3));
    expect(req.orgNodeId).toBeNull();
    expect(req.levels).toBe(3);
  });

  it("scopes the proposal to a localized organizational unit", () => {
    expect(toCreateRiskStrategyVersionRequest(buildDefaultConfig(3), "node-ap").orgNodeId).toBe("node-ap");
    expect(toCreateRiskStrategyVersionRequest(buildDefaultConfig(3), null).orgNodeId).toBeNull();
  });

  it("still maps appetite categories, likelihood bands and impact parameters", () => {
    const req = toCreateRiskStrategyVersionRequest(buildDefaultConfig(3), "node-ap");
    expect(req.appetiteCategories).toHaveLength(5);
    expect(req.likelihoodBands?.probability).toHaveLength(3);
    expect(req.likelihoodBands?.timeline).toHaveLength(3);
    expect(req.impactParameters?.length).toBeGreaterThan(0);
  });
});
