/**
 * Maps between the backend `RiskStrategyConfigResponse` shape (§17 of
 * GOVERNANCE_API_ENDPOINTS.md) and the local `RiskStrategyConfig` UI shape
 * (src/data/orgStore.ts), which predates the API and carries a couple of
 * client-only cosmetic fields the backend has no column for:
 *  - `ScaleBand.color` — an HSL token used purely for the level badge color;
 *    reassigned locally from the same default palette on every load.
 *  - `ScaleBand.description` (impact bands only) — the free-text qualitative
 *    narrative. The backend's `RiskImpactBand` only has label/min/max, so
 *    this is UI-only and does not round-trip through a save/reload cycle.
 */

import { buildBands } from "@/data/orgStore";
import type {
  ImpactMeasurement,
  RiskStrategyConfig,
  ScaleBand,
  ScaleLevel,
} from "@/data/orgStore";
import type {
  CreateRiskStrategyVersionRequest,
  ImpactMode,
  LikelihoodMode,
  RiskBandResponse,
  RiskStrategyConfigResponse,
} from "@/lib/governance-types";

const IMPACT_MODE_TO_MEASUREMENT: Record<ImpactMode, ImpactMeasurement> = {
  QUANTITATIVE: "quantitative",
  QUALITATIVE: "qualitative",
  BOTH: "both",
};

const MEASUREMENT_TO_IMPACT_MODE: Record<ImpactMeasurement, ImpactMode> = {
  quantitative: "QUANTITATIVE",
  qualitative: "QUALITATIVE",
  both: "BOTH",
};

const LIKELIHOOD_MODE_TO_LOCAL: Record<LikelihoodMode, RiskStrategyConfig["likelihoodMode"]> = {
  PROBABILITY: "probability",
  TIMELINE: "timeline",
  BOTH: "both",
};

const LOCAL_TO_LIKELIHOOD_MODE: Record<RiskStrategyConfig["likelihoodMode"], LikelihoodMode> = {
  probability: "PROBABILITY",
  timeline: "TIMELINE",
  both: "BOTH",
};

function bandsFromResponse(bands: RiskBandResponse[], level: ScaleLevel): ScaleBand[] {
  const palette = buildBands(level);
  const byPosition = new Map(bands.map((b) => [b.position, b]));
  return palette.map((defaultBand, i) => {
    const position = i + 1;
    const source = byPosition.get(position);
    if (!source) return defaultBand;
    return {
      level: position,
      label: source.label,
      color: defaultBand.color,
      min: source.minValue ?? undefined,
      max: source.maxValue ?? undefined,
    };
  });
}

function bandsToRequest(bands: ScaleBand[]) {
  return bands.map((b) => ({
    position: b.level,
    label: b.label,
    minValue: b.min ?? null,
    maxValue: b.max ?? null,
  }));
}

export function fromRiskStrategyResponse(res: RiskStrategyConfigResponse): RiskStrategyConfig {
  const level = res.levels;
  return {
    scaleLevel: level,
    likelihoodMode: LIKELIHOOD_MODE_TO_LOCAL[res.likelihoodMode],
    likelihoodBands: bandsFromResponse(res.likelihoodBands.probability, level),
    timelineBands: bandsFromResponse(res.likelihoodBands.timeline, level),
    impactParameters: res.impactParameters.map((p) => ({
      id: p.id,
      key: p.name.toLowerCase().replace(/\s+/g, "_"),
      label: p.name,
      enabled: p.enabled,
      measurement: IMPACT_MODE_TO_MEASUREMENT[p.mode],
      bands: bandsFromResponse(p.bands, level),
    })),
    appetiteStatements: res.appetiteCategories.map((c) => ({
      id: c.id,
      category: c.name,
      statement: c.statement,
    })),
  };
}

export function toCreateRiskStrategyVersionRequest(
  cfg: RiskStrategyConfig,
): CreateRiskStrategyVersionRequest {
  return {
    levels: cfg.scaleLevel,
    likelihoodMode: LOCAL_TO_LIKELIHOOD_MODE[cfg.likelihoodMode],
    reviewFrequency: "ANNUALLY",
    appetiteCategories: cfg.appetiteStatements.map((a) => ({
      name: a.category,
      statement: a.statement,
    })),
    likelihoodBands: {
      probability: bandsToRequest(cfg.likelihoodBands),
      timeline: bandsToRequest(cfg.timelineBands),
    },
    impactParameters: cfg.impactParameters.map((p) => ({
      name: p.label,
      enabled: p.enabled,
      mode: MEASUREMENT_TO_IMPACT_MODE[p.measurement],
      bands: bandsToRequest(p.bands),
    })),
  };
}
