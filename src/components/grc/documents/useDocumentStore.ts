import { useCallback, useState } from "react";
import { loadDocuments, saveDocuments, type PolicyDocument } from "@/data/documentsStore";
import { loadOrgNodes, type OrgNode } from "@/data/orgStore";

/**
 * Documents live in the localStorage prototype store. Reading lazily on first
 * render (rather than in an effect) avoids an empty-list flash, and every write
 * goes through `persist` so state and storage never diverge.
 */
export function useDocumentStore() {
  const [docs, setDocs] = useState<PolicyDocument[]>(loadDocuments);
  const [orgNodes] = useState<OrgNode[]>(loadOrgNodes);

  const persist = useCallback((next: PolicyDocument[]) => {
    setDocs(next);
    saveDocuments(next);
  }, []);

  return { docs, orgNodes, persist };
}
