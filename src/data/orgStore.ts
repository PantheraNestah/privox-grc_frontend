// Local-storage backed store for Risk Governance org tree + objectives + risk strategy config.
// All data persists in the user's browser via localStorage.

/** Org hierarchy type. Default tiers are seeded but admins can register
 *  custom hierarchy types via `loadOrgTypes` / `saveOrgTypes`, which is why
 *  this is a string rather than a closed union. */
export type OrgNodeType = string;

export const DEFAULT_ORG_TYPES: OrgNodeType[] = [
  "group", "company", "department", "division", "section", "process", "subprocess",
];

export interface OrgNode {
  id: string;
  name: string;
  type: OrgNodeType;
  parentId: string | null;
  description?: string;
  objectiveIds: string[]; // linked organization objectives
  /** Three Lines of Defense classification (1=Business/Ownership, 2=Oversight & Control, 3=Independent Assurance). */
  lineOfDefense?: 1 | 2 | 3;
  /** Offerings produced/owned by this unit (products, frameworks, programs, etc.). */
  offerings?: OrgOffering[];
}

export type OfferingKind =
  | "product_category"
  | "product_name"
  | "risk_framework"
  | "compliance_program"
  | "service"
  | "other";

export interface OrgOffering {
  id: string;
  kind: OfferingKind;
  label: string;
}

export const OFFERING_KIND_LABELS: Record<OfferingKind, string> = {
  product_category: "Product Category",
  product_name: "Product Name",
  risk_framework: "Risk Framework",
  compliance_program: "Compliance Program",
  service: "Service",
  other: "Offering",
};

export const OFFERING_KIND_COLORS: Record<OfferingKind, string> = {
  product_category: "210 61% 49%",
  product_name: "192 60% 53%",
  risk_framework: "352 70% 61%",
  compliance_program: "265 88% 66%",
  service: "158 53% 49%",
  other: "229 30% 50%",
};

export const LINE_OF_DEFENSE_LABELS: Record<1 | 2 | 3, string> = {
  1: "Line 1: Business (Ownership)",
  2: "Line 2: Oversight & Control",
  3: "Line 3: Independent Assurance",
};

export const LINE_OF_DEFENSE_SHORT: Record<1 | 2 | 3, string> = {
  1: "Line 1: Business",
  2: "Line 2: Internal Control",
  3: "Line 3: Internal Audit",
};

export const LINE_OF_DEFENSE_COLORS: Record<1 | 2 | 3, string> = {
  1: "210 61% 49%",
  2: "34 60% 45%",
  3: "352 70% 55%",
};

/** Effective Line of Defense — inherits from the nearest classified ancestor. */
export function effectiveLod(node: OrgNode, byId: Map<string, OrgNode>): 1 | 2 | 3 | undefined {
  let cur: OrgNode | undefined = node;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    if (cur.lineOfDefense) return cur.lineOfDefense;
    seen.add(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return undefined;
}

export interface Objective {
  id: string;
  title: string;
  description?: string;
}

// ---- Hierarchy type registry (defaults + admin-defined custom types) ----

export interface OrgTypeDef {
  key: string;     // stable lowercase id
  label: string;   // display name
  color: string;   // HSL token e.g. "210 61% 49%"
  builtin?: boolean; // seeded defaults can be renamed/recoloured but not deleted
}

const DEFAULT_TYPE_DEFS: OrgTypeDef[] = [
  { key: "group", label: "Group", color: "231 53% 37%", builtin: true },
  { key: "company", label: "Company", color: "230 76% 64%", builtin: true },
  { key: "department", label: "Department", color: "210 61% 49%", builtin: true },
  { key: "division", label: "Division", color: "158 53% 49%", builtin: true },
  { key: "section", label: "Section", color: "34 89% 61%", builtin: true },
  { key: "process", label: "Process", color: "265 88% 66%", builtin: true },
  { key: "subprocess", label: "Sub-process", color: "229 81% 76%", builtin: true },
];

const TYPES_KEY = "rsolve.org.types.v1";

export function loadOrgTypes(): OrgTypeDef[] {
  try {
    const raw = localStorage.getItem(TYPES_KEY);
    if (!raw) {
      localStorage.setItem(TYPES_KEY, JSON.stringify(DEFAULT_TYPE_DEFS));
      return DEFAULT_TYPE_DEFS;
    }
    const parsed = JSON.parse(raw) as OrgTypeDef[];
    const map = new Map(parsed.map(t => [t.key, t]));
    // Always re-add any missing built-ins so legacy nodes still resolve.
    DEFAULT_TYPE_DEFS.forEach(d => {
      const existing = map.get(d.key);
      if (!existing) map.set(d.key, d);
      else map.set(d.key, { ...existing, builtin: true });
    });
    return Array.from(map.values());
  } catch {
    return DEFAULT_TYPE_DEFS;
  }
}

export function saveOrgTypes(types: OrgTypeDef[]) {
  localStorage.setItem(TYPES_KEY, JSON.stringify(types));
  window.dispatchEvent(new CustomEvent("rsolve:org-types-changed"));
}

/** Proxy-backed label/color lookups so existing `ORG_TYPE_LABELS[node.type]`
 *  call sites keep working with both built-in and custom types. */
export const ORG_TYPE_LABELS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, key: string) => loadOrgTypes().find(t => t.key === key)?.label ?? key,
});

export const ORG_TYPE_COLORS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, key: string) => loadOrgTypes().find(t => t.key === key)?.color ?? "229 30% 50%",
});

const ORG_KEY = "rsolve.org.nodes.v1";
const OBJ_KEY = "rsolve.org.objectives.v1";

// ---- Objectives (stubbed; will live in Strategy Formulation module later) ----
const SEED_OBJECTIVES: Objective[] = [
  { id: "obj-1", title: "Grow revenue 15% YoY", description: "Strategic growth target across all business units." },
  { id: "obj-2", title: "Achieve ISO 27001 certification", description: "Compliance & information security objective." },
  { id: "obj-3", title: "Reduce operational incidents by 30%", description: "Operational excellence objective." },
  { id: "obj-4", title: "Improve customer satisfaction (NPS > 60)", description: "Customer experience objective." },
  { id: "obj-5", title: "Launch 2 new product lines", description: "Innovation & market expansion objective." },
];

export function loadObjectives(): Objective[] {
  try {
    const raw = localStorage.getItem(OBJ_KEY);
    if (!raw) {
      localStorage.setItem(OBJ_KEY, JSON.stringify(SEED_OBJECTIVES));
      return SEED_OBJECTIVES;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_OBJECTIVES;
  }
}

export function saveObjectives(items: Objective[]) {
  localStorage.setItem(OBJ_KEY, JSON.stringify(items));
}

// ---- Org nodes ----
export function loadOrgNodes(): OrgNode[] {
  try {
    const raw = localStorage.getItem(ORG_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveOrgNodes(nodes: OrgNode[]) {
  localStorage.setItem(ORG_KEY, JSON.stringify(nodes));
}

export function uid(prefix = "n") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Returns the chain of ancestors from the given node up to the root (inclusive of the node itself).
 * Order: [node, parent, grandparent, ..., root].
 */
export function getOrgAncestorChain(nodes: OrgNode[], nodeId: string): OrgNode[] {
  const map = new Map(nodes.map(n => [n.id, n]));
  const chain: OrgNode[] = [];
  let cur = map.get(nodeId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return chain;
}

/**
 * Returns the given node and all of its descendants (children, grandchildren, ...).
 * Used to scope what an approver / input user can see: their unit and everything below it,
 * but never anything above it in the hierarchy.
 */
export function getOrgDescendantChain(nodes: OrgNode[], nodeId: string): OrgNode[] {
  const childrenByParent = new Map<string, OrgNode[]>();
  nodes.forEach(n => {
    if (!n.parentId) return;
    const arr = childrenByParent.get(n.parentId) ?? [];
    arr.push(n);
    childrenByParent.set(n.parentId, arr);
  });
  const root = nodes.find(n => n.id === nodeId);
  if (!root) return [];
  const out: OrgNode[] = [];
  const stack: OrgNode[] = [root];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur.id)) continue;
    seen.add(cur.id);
    out.push(cur);
    (childrenByParent.get(cur.id) ?? []).forEach(c => stack.push(c));
  }
  return out;
}

/**
 * Returns true if `ancestorId` is the same as `nodeId` OR sits above it in the org chain.
 * Used to check whether an approver's unit is at or above the submitter's unit.
 */
export function isAncestorOrSelf(nodes: OrgNode[], ancestorId: string, nodeId: string): boolean {
  if (!ancestorId || !nodeId) return false;
  const chain = getOrgAncestorChain(nodes, nodeId).map(n => n.id);
  return chain.includes(ancestorId);
}

/** Strict: ancestorId is strictly above nodeId (not equal). */
export function isStrictAncestor(nodes: OrgNode[], ancestorId: string, nodeId: string): boolean {
  if (ancestorId === nodeId) return false;
  return isAncestorOrSelf(nodes, ancestorId, nodeId);
}

// ---- Risk Strategy config ----
export type ScaleLevel = 3 | 4 | 5;

export interface ScaleBand {
  level: number; // 1..N
  label: string;
  color: string; // hsl tokens like "158 53% 49%"
  min?: number;
  max?: number;
  /** Optional qualitative narrative for the band (used by qualitative impact mode). */
  description?: string;
}

export interface AppetiteStatement {
  id: string;
  category: string;
  statement: string;
}

export type ImpactMeasurement = "qualitative" | "quantitative" | "both";

export interface ImpactParameter {
  id: string;
  key: string; // people, compliance, reputation, financial, operational, strategic
  label: string;
  enabled: boolean;
  /** How this impact parameter is measured. Quantitative uses numeric thresholds (min/max);
   *  qualitative uses descriptive band labels only; both shows them side-by-side. */
  measurement: ImpactMeasurement;
  bands: ScaleBand[];
}

export const IMPACT_MEASUREMENT_LABELS: Record<ImpactMeasurement, string> = {
  qualitative: "Qualitative",
  quantitative: "Quantitative",
  both: "Both",
};

export interface RiskStrategyConfig {
  scaleLevel: ScaleLevel;
  likelihoodMode: "probability" | "timeline" | "both";
  likelihoodBands: ScaleBand[];
  timelineBands: ScaleBand[];
  impactParameters: ImpactParameter[];
  appetiteStatements: AppetiteStatement[];
}

const RISK_KEY = "rsolve.risk.strategy.v1";

const DEFAULT_LEVEL_LABELS: Record<number, string[]> = {
  3: ["Low", "Moderate", "High"],
  4: ["Low", "Moderate", "High", "Critical"],
  5: ["Very Low", "Low", "Moderate", "High", "Very High"],
};

const DEFAULT_LEVEL_COLORS: Record<number, string[]> = {
  3: ["158 53% 49%", "34 89% 61%", "352 70% 61%"],
  4: ["158 53% 49%", "210 61% 49%", "34 89% 61%", "352 70% 61%"],
  5: ["158 53% 49%", "210 61% 49%", "34 89% 61%", "352 70% 61%", "352 70% 35%"],
};

export function buildBands(level: ScaleLevel): ScaleBand[] {
  const labels = DEFAULT_LEVEL_LABELS[level];
  const colors = DEFAULT_LEVEL_COLORS[level];
  return labels.map((label, i) => ({ level: i + 1, label, color: colors[i] }));
}

const IMPACT_PARAMS: { key: string; label: string }[] = [
  { key: "people", label: "People" },
  { key: "compliance", label: "Compliance" },
  { key: "reputation", label: "Reputation" },
  { key: "financial", label: "Financial" },
  { key: "operational", label: "Operational" },
  { key: "strategic", label: "Strategic" },
];

export function buildDefaultConfig(level: ScaleLevel = 3): RiskStrategyConfig {
  return {
    scaleLevel: level,
    likelihoodMode: "both",
    likelihoodBands: buildBands(level),
    timelineBands: buildBands(level),
    impactParameters: IMPACT_PARAMS.map(p => ({
      id: uid("imp"),
      key: p.key,
      label: p.label,
      enabled: true,
      measurement: "quantitative",
      bands: buildBands(level),
    })),
    appetiteStatements: [
      { id: uid("app"), category: "Strategic", statement: "" },
      { id: uid("app"), category: "Operational", statement: "" },
      { id: uid("app"), category: "Financial", statement: "" },
      { id: uid("app"), category: "Compliance", statement: "" },
      { id: uid("app"), category: "Cyber & Information Security", statement: "" },
    ],
  };
}

export function loadRiskStrategy(): RiskStrategyConfig {
  try {
    const raw = localStorage.getItem(RISK_KEY);
    if (!raw) {
      const def = buildDefaultConfig(3);
      localStorage.setItem(RISK_KEY, JSON.stringify(def));
      return def;
    }
    const parsed = JSON.parse(raw) as RiskStrategyConfig;
    // Migration: ensure every impact parameter has a measurement type
    parsed.impactParameters = (parsed.impactParameters ?? []).map(p => ({
      ...p,
      measurement: p.measurement ?? "quantitative",
    }));
    return parsed;
  } catch {
    return buildDefaultConfig(3);
  }
}

export function saveRiskStrategy(cfg: RiskStrategyConfig) {
  localStorage.setItem(RISK_KEY, JSON.stringify(cfg));
}
