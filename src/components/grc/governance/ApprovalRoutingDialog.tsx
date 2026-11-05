import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useApprovalLevelRules,
  useDeleteApprovalLevelRule,
  useUpsertApprovalLevelRule,
} from "@/hooks/use-org-nodes";
import type { ApprovalLevelRule, OrgNodeType } from "@/lib/governance-types";

/** The API's node levels, in hierarchy order, with display labels. */
const LEVELS: Array<{ value: OrgNodeType; label: string }> = [
  { value: "GROUP", label: "Group" },
  { value: "COMPANY", label: "Company" },
  { value: "DEPARTMENT", label: "Department" },
  { value: "DIVISION", label: "Division" },
  { value: "SECTION", label: "Section" },
  { value: "PROCESS", label: "Process" },
  { value: "SUB_PROCESS", label: "Sub-process" },
];

/**
 * Decides which level signs off work submitted at each level. No rule means the
 * immediate parent; a rule means the nearest ancestor of that type. Root nodes
 * have no approver, so only organization admins can decide at the top.
 */
export function ApprovalRoutingDialog({
  orgId,
  open,
  onOpenChange,
  canEdit,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}) {
  const rules = useApprovalLevelRules(orgId, open);
  const upsert = useUpsertApprovalLevelRule(orgId);
  const remove = useDeleteApprovalLevelRule(orgId);
  const [pending, setPending] = useState<OrgNodeType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetOf = (source: OrgNodeType): OrgNodeType | "PARENT" =>
    rules.data?.find((rule) => rule.sourceNodeType === source)?.targetNodeType ?? "PARENT";

  const change = async (source: OrgNodeType, value: string) => {
    setError(null);
    setPending(source);
    try {
      if (value === "PARENT") {
        if (targetOf(source) !== "PARENT") await remove.mutateAsync(source);
      } else {
        await upsert.mutateAsync({ sourceNodeType: source, targetNodeType: value as OrgNodeType });
      }
      toast.success("Approval routing updated");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setError(status === 403 ? "You don't have permission to change approval routing." : "Could not save that rule.");
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-brand-accent" /> Approval routing
          </DialogTitle>
          <DialogDescription>
            Who signs off work submitted at each level.
          </DialogDescription>
        </DialogHeader>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {rules.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {rules.error && <p className="text-sm text-destructive">Could not load the routing rules.</p>}

        {rules.data && (
          <ul className="divide-y rounded-md border">
            {LEVELS.map(({ value: level, label }) => (
              <li key={level} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                <span className="text-xs text-muted-foreground">approved by</span>
                <select
                  aria-label={`Approver for ${label}`}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60"
                  value={targetOf(level)}
                  disabled={!canEdit || pending === level}
                  onChange={(e) => void change(level, e.target.value)}
                >
                  <option value="PARENT">Immediate parent</option>
                  {LEVELS.filter((candidate) => candidate.value !== level).map((candidate) => (
                    <option key={candidate.value} value={candidate.value}>
                      Nearest {candidate.label}
                    </option>
                  ))}
                </select>
                {pending === level && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          Root units have nobody above them, so only organization admins can decide there.
        </p>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small read-only line for the insights panel: who approves work at this node. */
export function ApprovalNodeHint({ nodeName }: { nodeName: string | null | undefined }) {
  return (
    <p className="text-[11px] text-muted-foreground">
      Approved by {nodeName ? <span className="font-medium text-foreground">{nodeName}</span> : "organization admins (root unit)"}
    </p>
  );
}

export function ruleFor(rules: ApprovalLevelRule[] | undefined, source: OrgNodeType): OrgNodeType | null {
  return rules?.find((rule) => rule.sourceNodeType === source)?.targetNodeType ?? null;
}
