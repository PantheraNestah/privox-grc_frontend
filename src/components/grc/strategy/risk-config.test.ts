import { buildDefaultConfig } from "@/data/orgStore";
import { withBand, withScaleLevel } from "./risk-config";

describe("risk-config", () => {
  it("rebuilds bands at the new scale level but keeps appetite statements", () => {
    const cfg = buildDefaultConfig(3);
    cfg.appetiteStatements[0].statement = "Low appetite";

    const next = withScaleLevel(cfg, 5);

    expect(next.scaleLevel).toBe(5);
    expect(next.likelihoodBands).toHaveLength(5);
    expect(next.timelineBands).toHaveLength(5);
    expect(next.impactParameters.every((p) => p.bands.length === 5)).toBe(true);
    expect(next.appetiteStatements[0].statement).toBe("Low appetite");
  });

  it("patches a likelihood, timeline or impact band without touching the others", () => {
    const cfg = buildDefaultConfig(3);
    const impactId = cfg.impactParameters[1].id;

    const a = withBand(cfg, "likelihood", 0, { label: "Rare" });
    expect(a.likelihoodBands[0].label).toBe("Rare");
    expect(a.likelihoodBands[1].label).toBe(cfg.likelihoodBands[1].label);
    expect(a.timelineBands).toBe(cfg.timelineBands);

    const b = withBand(cfg, "timeline", 2, { max: 12 });
    expect(b.timelineBands[2].max).toBe(12);

    const c = withBand(cfg, impactId, 1, { min: 5 });
    expect(c.impactParameters[1].bands[1].min).toBe(5);
    expect(c.impactParameters[0].bands).toBe(cfg.impactParameters[0].bands);
  });
});
