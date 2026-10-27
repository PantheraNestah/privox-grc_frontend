/**
 * Visual language for the Organisation Map's hierarchy view, taken from the
 * client-approved org chart: a deep-navy group root, pale blue business units,
 * muted lavender group functions, and green/red for the 2nd and 3rd Lines of
 * Defence. Kept separate from the React Flow component so the SVG export and
 * the unit tests can share exactly the same palette and rules.
 */

import { effectiveLod, type OrgNode } from "@/data/orgStore";

export type HierarchyRole = "root" | "business" | "function" | "lod2" | "lod3";

export interface HierarchyTone {
  /** Border, connector and swatch colour (HSL triplet, no `hsl()` wrapper). */
  accent: string;
  /** Card background (HSL triplet). */
  fill: string;
  /** Node name colour. */
  text: string;
  /** Description / offering text colour. */
  muted: string;
}

export const HIERARCHY_TONES: Record<HierarchyRole, HierarchyTone> = {
  root: { accent: "214 62% 26%", fill: "214 62% 26%", text: "#ffffff", muted: "#d7e2ef" },
  business: { accent: "209 58% 40%", fill: "206 76% 93%", text: "#10263d", muted: "#41627f" },
  function: { accent: "255 22% 52%", fill: "255 30% 94%", text: "#221f33", muted: "#5c5472" },
  lod2: { accent: "137 42% 34%", fill: "134 44% 90%", text: "#12301a", muted: "#3d6847" },
  lod3: { accent: "356 60% 46%", fill: "356 76% 93%", text: "#3a1013", muted: "#7a3b3f" },
};

/** Connector colour for unclassified parent → child links (client's navy rules). */
export const HIERARCHY_EDGE = "214 40% 32%";

/** Non-company units render as muted group functions unless a LoD is set. */
const FUNCTION_TYPES = new Set(["department", "section", "process", "subprocess"]);

/**
 * Which chart tone a unit gets. The root always reads as the group; an
 * (inherited) 2nd/3rd-line classification wins over the unit type, matching
 * the client's rule that "Internal Control" sits in the same colour as the
 * function that owns it.
 */
export function hierarchyRole(node: OrgNode, byId: Map<string, OrgNode>): HierarchyRole {
  if (!node.parentId) return "root";
  const lod = effectiveLod(node, byId);
  if (lod === 2) return "lod2";
  if (lod === 3) return "lod3";
  return FUNCTION_TYPES.has(node.type) ? "function" : "business";
}

export interface HierarchyCardSize {
  width: number;
  height: number;
}

/** The client's chart steps down in size: group, then units, then sub-units. */
const HIERARCHY_SIZES: HierarchyCardSize[] = [
  { width: 300, height: 84 },
  { width: 212, height: 76 },
  { width: 184, height: 68 },
];

export function hierarchyCardSize(depth: number): HierarchyCardSize {
  return HIERARCHY_SIZES[Math.min(Math.max(depth, 0), HIERARCHY_SIZES.length - 1)];
}

/** Legend rows, in the client's wording and order. */
export const HIERARCHY_LEGEND: { role: HierarchyRole; label: string }[] = [
  { role: "lod2", label: "2nd Line of Defence (Internal Control)" },
  { role: "lod3", label: "3rd Line of Defence (Internal Control)" },
  { role: "business", label: "Other Departments / Business Units" },
];
