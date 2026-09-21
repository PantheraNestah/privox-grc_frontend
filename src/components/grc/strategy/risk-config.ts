import { buildBands, buildDefaultConfig } from "@/data/orgStore";
import type { RiskStrategyConfig, ScaleBand, ScaleLevel } from "@/data/orgStore";

/** "likelihood" | "timeline", or an impact parameter id. */
export type BandTarget = string;

/** Rebuilds every band set at the new level, keeping appetite statements and parameter toggles. */
export function withScaleLevel(cfg: RiskStrategyConfig, level: ScaleLevel): RiskStrategyConfig {
  const fresh = buildDefaultConfig(level);
  return {
    ...cfg,
    scaleLevel: level,
    likelihoodBands: fresh.likelihoodBands,
    timelineBands: fresh.timelineBands,
    impactParameters: cfg.impactParameters.map((p) => ({ ...p, bands: buildBands(level) })),
  };
}

const patchAt = (bands: ScaleBand[], idx: number, patch: Partial<ScaleBand>) =>
  bands.map((band, i) => (i === idx ? { ...band, ...patch } : band));

export function withBand(
  cfg: RiskStrategyConfig,
  target: BandTarget,
  idx: number,
  patch: Partial<ScaleBand>,
): RiskStrategyConfig {
  if (target === "likelihood") return { ...cfg, likelihoodBands: patchAt(cfg.likelihoodBands, idx, patch) };
  if (target === "timeline") return { ...cfg, timelineBands: patchAt(cfg.timelineBands, idx, patch) };
  return {
    ...cfg,
    impactParameters: cfg.impactParameters.map((p) =>
      p.id === target ? { ...p, bands: patchAt(p.bands, idx, patch) } : p,
    ),
  };
}
