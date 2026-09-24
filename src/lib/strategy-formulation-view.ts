import type {
  StrategyElementType,
  StrategyTreeNode,
  StrategyVersionStatus,
} from "@/lib/strategy-formulation-types";

export interface FlatStrategyNode {
  node: StrategyTreeNode;
  depth: number;
  path: string[];
}

export const STRATEGY_TYPE_LABELS: Record<StrategyElementType, string> = {
  PILLAR: "Pillar",
  OBJECTIVE: "Objective",
  INITIATIVE: "Initiative",
  ACTIVITY: "Activity",
  KPI: "KPI",
};

export const STRATEGY_TYPE_ORDER: StrategyElementType[] = [
  "PILLAR",
  "OBJECTIVE",
  "INITIATIVE",
  "ACTIVITY",
  "KPI",
];

export function flattenStrategyTree(tree: StrategyTreeNode[]): FlatStrategyNode[] {
  const rows: FlatStrategyNode[] = [];
  const visit = (nodes: StrategyTreeNode[], depth: number, parentPath: string[]) => {
    nodes.forEach((node) => {
      const path = [...parentPath, node.title];
      rows.push({ node, depth, path });
      visit(node.children, depth + 1, path);
    });
  };
  visit(tree, 0, []);
  return rows;
}

export function countStrategyTypes(tree: StrategyTreeNode[]) {
  const counts = Object.fromEntries(
    STRATEGY_TYPE_ORDER.map((type) => [type, 0]),
  ) as Record<StrategyElementType, number>;
  flattenStrategyTree(tree).forEach(({ node }) => {
    counts[node.type] += 1;
  });
  return counts;
}

export function elementCompletion(node: StrategyTreeNode): {
  score: number;
  complete: number;
  total: number;
  missing: string[];
} {
  const checks: Array<[string, boolean]> = [
    ["description", !!node.description?.trim()],
    ...(node.type !== "PILLAR" ? [["responsible unit", !!node.orgNodeId] as [string, boolean]] : []),
    ...(["INITIATIVE", "ACTIVITY", "KPI"].includes(node.type)
      ? [["planning period", !!node.periodStart && !!node.periodEnd] as [string, boolean]]
      : []),
    ...(node.type === "ACTIVITY" ? [["outcome", !!node.outcomeSummary?.trim()] as [string, boolean]] : []),
    ...(["ACTIVITY", "KPI"].includes(node.type)
      ? [["target", node.targetValue !== null] as [string, boolean], ["unit", !!node.unit?.trim()] as [string, boolean]]
      : []),
  ];
  const complete = checks.filter(([, passed]) => passed).length;
  return {
    score: checks.length ? Math.round((complete / checks.length) * 100) : 100,
    complete,
    total: checks.length,
    missing: checks.filter(([, passed]) => !passed).map(([label]) => label),
  };
}

export function strategyReadiness(tree: StrategyTreeNode[]) {
  const rows = flattenStrategyTree(tree);
  if (!rows.length) return 0;
  return Math.round(
    rows.reduce((total, row) => total + elementCompletion(row.node).score, 0) / rows.length,
  );
}

export function statusCounts(tree: StrategyTreeNode[]) {
  const counts: Record<StrategyVersionStatus, number> = {
    DRAFT: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
  };
  flattenStrategyTree(tree).forEach(({ node }) => {
    counts[node.status] += 1;
  });
  return counts;
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "No planning period";
  const format = (value: string) =>
    new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(value));
  if (start && end) return `${format(start)} – ${format(end)}`;
  return format(start ?? end!);
}

export function typeIconClass(type: StrategyElementType): string {
  return {
    PILLAR: "bg-royal/10 text-royal",
    OBJECTIVE: "bg-brand-accent/10 text-brand-accent",
    INITIATIVE: "bg-warn/15 text-warn",
    ACTIVITY: "bg-success/12 text-success",
    KPI: "bg-destructive/10 text-destructive",
  }[type];
}
