import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DOCUMENT_STATUS_COLORS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  computeDocumentStatus,
  type PolicyDocument,
} from "@/data/documentsStore";
import { ORG_TYPE_LABELS, type OrgNode } from "@/data/orgStore";
import { EmptyState } from "@/components/grc/common/states";

interface DocumentHierarchyProps {
  orgNodes: OrgNode[];
  docs: PolicyDocument[];
  /** Omit to render the chips as read-only. */
  onOpen?: (doc: PolicyDocument) => void;
}

/** Documents grouped under the org-tree node they apply to. */
export function DocumentHierarchy({ orgNodes, docs, onOpen }: DocumentHierarchyProps) {
  const docsByNode = useMemo(() => {
    const map = new Map<string, PolicyDocument[]>();
    docs.forEach((d) =>
      d.linkedOrgNodeIds.forEach((id) => map.set(id, [...(map.get(id) ?? []), d])),
    );
    return map;
  }, [docs]);

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, OrgNode[]>();
    orgNodes.forEach((n) => map.set(n.parentId, [...(map.get(n.parentId) ?? []), n]));
    return map;
  }, [orgNodes]);

  if (orgNodes.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No organisation hierarchy yet"
        description="Define your org structure in Risk Governance to link documents to it."
        action={
          <Link to="/governance/risk-governance" className="text-sm font-medium text-brand-accent hover:text-navy">
            Open Risk Governance
          </Link>
        }
      />
    );
  }

  const unlinked = docs.filter((d) => d.linkedOrgNodeIds.length === 0);

  return (
    <Card className="space-y-1 p-4">
      {(childrenOf.get(null) ?? []).map((root) => (
        <NodeRow key={root.id} node={root} depth={0} childrenOf={childrenOf} docsByNode={docsByNode} onOpen={onOpen} />
      ))}
      {unlinked.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Unlinked documents
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unlinked.map((d) => (
              <DocumentChip key={d.id} doc={d} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

interface NodeRowProps {
  node: OrgNode;
  depth: number;
  childrenOf: Map<string | null, OrgNode[]>;
  docsByNode: Map<string, PolicyDocument[]>;
  onOpen?: (doc: PolicyDocument) => void;
}

function NodeRow({ node, depth, childrenOf, docsByNode, onOpen }: NodeRowProps) {
  const linked = docsByNode.get(node.id) ?? [];
  const kids = childrenOf.get(node.id) ?? [];

  return (
    <div>
      <div className="flex items-start gap-3 py-1.5" style={{ paddingLeft: depth * 20 }}>
        <span className="mt-0.5 w-20 shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
          {ORG_TYPE_LABELS[node.type]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-navy-deep">{node.name}</p>
          {linked.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {linked.map((d) => (
                <DocumentChip key={d.id} doc={d} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <span className="text-[11px] italic text-muted-foreground">No documents linked</span>
          )}
        </div>
      </div>
      {kids.map((child) => (
        <NodeRow key={child.id} node={child} depth={depth + 1} childrenOf={childrenOf} docsByNode={docsByNode} onOpen={onOpen} />
      ))}
    </div>
  );
}

function DocumentChip({ doc, onOpen }: { doc: PolicyDocument; onOpen?: (doc: PolicyDocument) => void }) {
  const status = computeDocumentStatus(doc);
  return (
    <button
      type="button"
      onClick={() => onOpen?.(doc)}
      disabled={!onOpen}
      title={`${DOCUMENT_TYPE_LABELS[doc.type]} · v${doc.version} · ${DOCUMENT_STATUS_LABELS[status]}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] transition-colors hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-card"
    >
      <span className="uppercase tracking-wide text-muted-foreground">{DOCUMENT_TYPE_LABELS[doc.type]}</span>
      <span className="text-navy-deep">{doc.title}</span>
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: `hsl(${DOCUMENT_STATUS_COLORS[status]})` }}
      />
    </button>
  );
}
