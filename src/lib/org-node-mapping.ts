/**
 * Maps between the backend `OrgNodeResponse` shape (§15 of
 * GOVERNANCE_API_ENDPOINTS.md — a fixed 7-value `OrgNodeType` enum, no
 * concept of custom tiers) and the local `OrgNode` UI shape
 * (src/data/orgStore.ts), which predates the API and additionally supports:
 *  - Three-Lines-of-Defense classification (`lineOfDefense`)
 *  - `offerings` (products/frameworks/programs owned by the unit)
 *
 * Neither of those has a backend column, so both round-trip through the
 * node's freeform `metadata` JSON field instead of being dropped.
 *
 * `objectiveIds` has no backend equivalent either and isn't populated from
 * responses — nothing in this codebase currently reads it back off an
 * `OrgNode` (roll-up counts join via `objective.linkedOrgNodeIds`, not this
 * field), so it's kept only as an always-empty array for type compatibility.
 */

import type { OrgNode, OrgOffering } from "@/data/orgStore";
import type { CreateOrgNodeRequest, OrgNodeResponse, OrgNodeType as BackendOrgNodeType, UpdateOrgNodeRequest } from "@/lib/governance-types";

/** The only 7 tiers the backend enum supports — local UI keys stay lowercase/underscored. */
export const BACKEND_ORG_NODE_TYPES: readonly BackendOrgNodeType[] = [
  "GROUP", "COMPANY", "DEPARTMENT", "DIVISION", "SECTION", "PROCESS", "SUB_PROCESS",
];

const LOCAL_TO_BACKEND_TYPE: Record<string, BackendOrgNodeType> = {
  group: "GROUP",
  company: "COMPANY",
  department: "DEPARTMENT",
  division: "DIVISION",
  section: "SECTION",
  process: "PROCESS",
  subprocess: "SUB_PROCESS",
};

const BACKEND_TO_LOCAL_TYPE: Record<BackendOrgNodeType, string> = {
  GROUP: "group",
  COMPANY: "company",
  DEPARTMENT: "department",
  DIVISION: "division",
  SECTION: "section",
  PROCESS: "process",
  SUB_PROCESS: "subprocess",
};

export function toBackendOrgNodeType(localType: string): BackendOrgNodeType {
  return LOCAL_TO_BACKEND_TYPE[localType] ?? "DEPARTMENT";
}

export function fromBackendOrgNodeType(backendType: BackendOrgNodeType): string {
  return BACKEND_TO_LOCAL_TYPE[backendType];
}

interface OrgNodeMetadata {
  lineOfDefense?: 1 | 2 | 3;
  offerings?: OrgOffering[];
}

export function fromOrgNodeResponse(res: OrgNodeResponse): OrgNode {
  const metadata = (res.metadata ?? {}) as OrgNodeMetadata;
  return {
    id: res.id,
    name: res.name,
    type: fromBackendOrgNodeType(res.type),
    parentId: res.parentId,
    description: res.description ?? undefined,
    objectiveIds: [],
    lineOfDefense: metadata.lineOfDefense,
    offerings: metadata.offerings,
  };
}

function toMetadata(node: Pick<OrgNode, "lineOfDefense" | "offerings">): Record<string, unknown> {
  const metadata: OrgNodeMetadata = {};
  if (node.lineOfDefense) metadata.lineOfDefense = node.lineOfDefense;
  if (node.offerings && node.offerings.length > 0) metadata.offerings = node.offerings;
  return metadata;
}

export function toCreateOrgNodeRequest(
  node: Pick<OrgNode, "name" | "type" | "parentId" | "description" | "lineOfDefense" | "offerings">,
): CreateOrgNodeRequest {
  return {
    parentId: node.parentId,
    name: node.name,
    type: toBackendOrgNodeType(node.type),
    description: node.description ?? null,
    metadata: toMetadata(node),
  };
}

export function toUpdateOrgNodeRequest(
  node: Pick<OrgNode, "name" | "type" | "description" | "lineOfDefense" | "offerings">,
): UpdateOrgNodeRequest {
  return {
    name: node.name,
    type: toBackendOrgNodeType(node.type),
    description: node.description ?? null,
    metadata: toMetadata(node),
  };
}
