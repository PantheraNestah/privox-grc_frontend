import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/grc/common/PageHeader";
import { ErrorState, ListSkeleton, LoadState } from "@/components/grc/common/states";
import { TENANT_HOME } from "@/components/grc/common/home-links";
import { BatchReviewView, BatchStatusBadge } from "@/components/grc/strategy/BatchReviewView";
import { useAuth } from "@/contexts/AuthContext";
import { useBatchDecision, useStrategyBatch } from "@/hooks/use-strategy-batches";
import { batchModeLabel } from "@/lib/strategy-batch-plan";
import { batchErrorMessage, type BatchDecision } from "@/lib/strategy-batches";

const BULK_IMPORT_PATH = "/governance/strategy-formulation?tab=bulk";

/**
 * A shareable page for one submitted bulk plan (issue #46, part 2).
 *
 * The old dialog could not be linked to, could not show the plan, and closed as
 * soon as a decision was made. This page keeps the reviewer on the batch so
 * they can read the applied result as well.
 */
const StrategyBatchReview = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const { organization, permissions, hasModule, user } = useAuth();
  const orgId = organization?.id;

  const canView = hasModule("GOVERNANCE");
  const canApprove =
    permissions.includes("strategy.approve") || permissions.includes("organization.manage");

  const batchQuery = useStrategyBatch(canView ? orgId : undefined, batchId ?? null);
  const decision = useBatchDecision(orgId ?? "");
  const [comments, setComments] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const batch = batchQuery.data;

  const handleDecide = async (kind: BatchDecision) => {
    if (!batch) return;
    setDecisionError(null);
    try {
      await decision.mutateAsync({
        batchId: batch.id,
        decision: kind,
        comments: comments.trim() || undefined,
      });
      toast.success(kind === "APPROVE" ? "Batch approved and applied." : "Decision recorded.");
      setComments("");
    } catch (err) {
      const message = batchErrorMessage(err);
      setDecisionError(message);
      toast.error(message);
    }
  };

  const title = batch?.name ?? "Batch review";

  return (
    <>
      <Helmet>
        <title>{`${title} · Rsolve GRC Platform`}</title>
        <meta name="description" content="Read a submitted bulk strategy plan before deciding it." />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[
          { label: "Governance", to: "/governance" },
          { label: "Strategy Formulation", to: BULK_IMPORT_PATH },
          { label: batch?.name ?? "Batch review" },
        ]}
        title={title}
        description={
          batch
            ? `${batchModeLabel(batch.mode)} · ${batch.elementCount} element${batch.elementCount === 1 ? "" : "s"} submitted in one plan.`
            : "Read a submitted bulk plan before deciding it."
        }
        eyebrow={batch ? <BatchStatusBadge status={batch.status} /> : undefined}
        actions={
          <Button asChild variant="outline">
            <Link to={BULK_IMPORT_PATH}>
              <ArrowLeft /> Back to bulk import
            </Link>
          </Button>
        }
      />

      {!orgId ? (
        <ErrorState title="No organization" message="No active organization was found for this session." />
      ) : !canView ? (
        <Alert variant="destructive" className="bg-destructive/5">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Governance module not allocated</AlertTitle>
          <AlertDescription>
            You do not have access to the Governance module. Please contact your organization administrator to
            allocate this module to your account.
          </AlertDescription>
        </Alert>
      ) : !batchId ? (
        <ErrorState title="No batch selected" message="Open a batch from the Bulk import tab to review it." />
      ) : batchQuery.isPending ? (
        <ListSkeleton label="Loading the batch" rows={4} />
      ) : batchQuery.isError ? (
        <LoadState error={batchQuery.error} subject="this batch" onRetry={() => void batchQuery.refetch()} />
      ) : !batch ? (
        <ErrorState title="Batch not available" message="This batch may have been removed, or it belongs to another organization." />
      ) : (
        <BatchReviewView
          batch={batch}
          organizationName={organization?.name ?? "your organization"}
          canApprove={canApprove}
          currentUserId={user?.id}
          comments={comments}
          onCommentsChange={setComments}
          onDecide={(kind) => void handleDecide(kind)}
          decisionPending={decision.isPending}
          decisionError={decisionError}
        />
      )}
    </>
  );
};

export default StrategyBatchReview;
