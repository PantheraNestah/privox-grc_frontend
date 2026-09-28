import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Activity,
  CheckCircle2,
  Clock,
  Gauge,
  History,
  Loader2,
  Lock,
  Save,
  Target,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/grc/common/PageHeader";
import { TENANT_HOME } from "@/components/grc/common/home-links";
import { ErrorState } from "@/components/grc/common/states";
import { AppetiteTab, ImpactTab, LikelihoodTab } from "@/components/grc/strategy/RiskScaleEditors";
import { withScaleLevel } from "@/components/grc/strategy/risk-config";
import { useAuth } from "@/contexts/AuthContext";
import {
  isRealStrategyError,
  useCreateRiskStrategyVersion,
  useCurrentRiskStrategy,
  useDecideRiskStrategyVersion,
  useRiskStrategyHistory,
} from "@/hooks/use-risk-strategy";
import { buildDefaultConfig } from "@/data/orgStore";
import type { RiskStrategyConfig, ScaleLevel } from "@/data/orgStore";
import type { ApprovalDecisionType } from "@/lib/governance-types";
import { fromRiskStrategyResponse, toCreateRiskStrategyVersionRequest } from "@/lib/risk-strategy-mapping";

const RiskStrategy = () => {
  const { organization, permissions } = useAuth();
  const orgId = organization?.id;

  // ─── 1. Segregation of Duties Permissions ─────────────────────────────────
  const canContribute =
    permissions.includes("strategy.contribute") || permissions.includes("organization.manage");
  const canApprove =
    permissions.includes("strategy.approve") || permissions.includes("organization.manage");

  // ─── 2. Data Queries & Mutations ──────────────────────────────────────────
  const currentQuery = useCurrentRiskStrategy(orgId);
  const historyQuery = useRiskStrategyHistory(orgId);
  const createVersion = useCreateRiskStrategyVersion(orgId ?? "");
  const decideVersion = useDecideRiskStrategyVersion(orgId ?? "");

  // ─── 3. Version Resolution & Active Selection ─────────────────────────────
  const versions = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);
  const pendingDraft = versions.find((v) => v.approvalStatus === "PENDING");
  const activeVersion = versions.find((v) => v.current) ?? currentQuery.data;

  // Explicitly selected version ID (null = default auto-selection)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const displayedVersion = useMemo(() => {
    if (selectedVersionId) {
      const match = versions.find((v) => v.id === selectedVersionId);
      if (match) return match;
    }
    // Default: show the pending draft if one exists, otherwise the active version.
    return pendingDraft ?? activeVersion ?? null;
  }, [selectedVersionId, versions, pendingDraft, activeVersion]);

  const isViewingDraft = displayedVersion?.approvalStatus === "PENDING";
  const isViewingActive = displayedVersion?.current === true;
  // Historical only when a concrete non-active, non-pending version is shown.
  // (No version at all must stay editable so the first baseline can be created.)
  const isViewingHistorical = !!displayedVersion && !isViewingDraft && !isViewingActive;

  // Editable when the user can contribute and is not inspecting a submitted
  // draft or a superseded version.
  const isFormEditable = canContribute && !isViewingDraft && !isViewingHistorical;
  const readOnlyForm = !isFormEditable;

  // Baseline config mapped from the resolved server version.
  const serverCfg = useMemo(
    () => (displayedVersion ? fromRiskStrategyResponse(displayedVersion) : buildDefaultConfig(3)),
    [displayedVersion],
  );

  // Draft holds unsaved modifications made in the current session.
  const [draft, setDraft] = useState<RiskStrategyConfig | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Decision modal state.
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [pendingDecisionType, setPendingDecisionType] = useState<ApprovalDecisionType>("APPROVE");
  const [decisionComments, setDecisionComments] = useState("");

  const cfg = draft ?? serverCfg;
  const dirty = draft !== null;
  const saving = createVersion.isPending || decideVersion.isPending;
  const hasSavedVersion = !!displayedVersion;

  const edit = (fn: (cfg: RiskStrategyConfig) => RiskStrategyConfig) => {
    if (readOnlyForm) return;
    setDraft((prev) => fn(prev ?? serverCfg));
  };

  // ─── 4. Save (Propose Draft) Handler ──────────────────────────────────────
  const handleSave = async () => {
    if (!orgId) return;
    try {
      const created = await createVersion.mutateAsync(toCreateRiskStrategyVersionRequest(cfg));
      if (created.current) {
        toast.success(`Risk strategy v${created.version} published.`);
      } else {
        toast.info(`Draft v${created.version} submitted for supervisory approval.`);
      }
      setSelectedVersionId(created.id);
      setDraft(null);
    } catch {
      toast.error("Failed to save risk strategy configuration.");
    }
  };

  // ─── 5. Decision (Approve / Reject / Request Revision) ────────────────────
  const openDecisionDialog = (type: ApprovalDecisionType) => {
    setPendingDecisionType(type);
    setDecisionComments("");
    setDecisionModalOpen(true);
  };

  const handleDecisionSubmit = async () => {
    if (!orgId || !pendingDraft) return;
    try {
      await decideVersion.mutateAsync({
        configId: pendingDraft.id,
        body: {
          decision: pendingDecisionType,
          comments: decisionComments.trim() || undefined,
        },
      });

      if (pendingDecisionType === "APPROVE") {
        toast.success(`Risk strategy v${pendingDraft.version} approved and activated.`);
        setSelectedVersionId(pendingDraft.id);
      } else if (pendingDecisionType === "REJECT") {
        toast.warning(`Draft v${pendingDraft.version} was rejected.`);
        setSelectedVersionId(activeVersion?.id ?? null);
      } else {
        toast.info(`Revision requested for draft v${pendingDraft.version}.`);
      }
      setDecisionModalOpen(false);
    } catch {
      toast.error("Failed to submit approval decision.");
    }
  };

  // ─── 6. Reset to Defaults ─────────────────────────────────────────────────
  const handleReset = async () => {
    const defaults = buildDefaultConfig(cfg.scaleLevel);
    setDraft(defaults);
    try {
      const created = await createVersion.mutateAsync(toCreateRiskStrategyVersionRequest(defaults));
      toast.info(`Reset draft v${created.version} submitted for approval.`);
      setSelectedVersionId(created.id);
      setDraft(null);
    } catch {
      toast.error("Failed to reset risk strategy.");
    }
  };

  const changeScale = (level: ScaleLevel) => {
    if (readOnlyForm) return;
    edit((c) => withScaleLevel(c, level));
    toast.info(`Scale set to ${level} levels`);
  };

  const showLoading = !!orgId && currentQuery.isLoading && !displayedVersion;
  const loadError = !orgId || (currentQuery.isError && isRealStrategyError(currentQuery.error));

  return (
    <>
      <Helmet>
        <title>Risk Strategy · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Define risk appetite, likelihood and impact scales, and quantitative thresholds."
        />
        <link rel="canonical" href="/governance/risk-strategy" />
      </Helmet>

      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Governance", to: "/governance" }, { label: "Risk Strategy" }]}
        title="Risk Strategy"
        description="Define your organisation's risk appetite, rating scales, and quantitative impact thresholds."
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            {isViewingDraft && (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <Clock className="mr-1 h-3 w-3" /> Draft v{displayedVersion?.version} (pending approval)
              </Badge>
            )}
            {isViewingActive && (
              <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Active baseline (v{displayedVersion?.version})
              </Badge>
            )}
            {isViewingHistorical && displayedVersion && (
              <Badge variant="secondary">
                <History className="mr-1 h-3 w-3" /> v{displayedVersion.version} (superseded)
              </Badge>
            )}
            {dirty && (
              <Badge variant="secondary" className="text-[11px] font-normal">
                Unsaved changes
              </Badge>
            )}
          </div>
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            {versions.length > 0 && (
              <Select
                value={displayedVersion?.id ?? ""}
                onValueChange={(value) => {
                  setSelectedVersionId(value);
                  setDraft(null);
                }}
              >
                <SelectTrigger className="h-10 w-full text-xs sm:w-[190px]">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="text-xs">
                      v{v.version}{" "}
                      {v.current
                        ? "(Active)"
                        : v.approvalStatus === "PENDING"
                          ? "(Draft pending)"
                          : "(Superseded)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {isViewingDraft && canApprove && (
              <>
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={saving}
                  onClick={() => openDecisionDialog("REJECT")}
                >
                  <XCircle /> Reject
                </Button>
                <Button variant="outline" disabled={saving} onClick={() => openDecisionDialog("REQUEST_REVISION")}>
                  <History /> Request revision
                </Button>
                <Button variant="brand" disabled={saving} onClick={() => openDecisionDialog("APPROVE")}>
                  <CheckCircle2 /> Approve version
                </Button>
              </>
            )}

            {isFormEditable && !showLoading && !loadError && (
              <>
                <Button variant="outline" onClick={() => setConfirmReset(true)} disabled={saving}>
                  Reset
                </Button>
                <Button variant="brand" onClick={handleSave} disabled={saving || (!dirty && hasSavedVersion)}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* ─── Pending Approval Notification Banner ──────────────────────────── */}
      {pendingDraft && (
        <Alert className="mb-6 border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <AlertTitle className="text-sm font-semibold">
                Draft version v{pendingDraft.version} pending approval
              </AlertTitle>
              <AlertDescription className="text-xs">
                Proposed on {new Date(pendingDraft.createdAt).toLocaleDateString()} at{" "}
                {new Date(pendingDraft.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.{" "}
                {canApprove
                  ? "Inspect the proposed draft and record your decision."
                  : "Awaiting sign-off by a Governance Approver. The configuration is locked while in review."}
              </AlertDescription>
            </div>
            <div className="flex items-center gap-2">
              {displayedVersion?.id !== pendingDraft.id ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    setSelectedVersionId(pendingDraft.id);
                    setDraft(null);
                  }}
                >
                  Review draft v{pendingDraft.version}
                </Button>
              ) : (
                activeVersion && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => {
                      setSelectedVersionId(activeVersion.id);
                      setDraft(null);
                    }}
                  >
                    View active baseline (v{activeVersion.version})
                  </Button>
                )
              )}
            </div>
          </div>
        </Alert>
      )}

      {/* ─── Read-Only Information Banner ─────────────────────────────────── */}
      {!canContribute && !canApprove && (
        <Alert className="mb-6">
          <Lock className="h-4 w-4" />
          <AlertTitle>Read-only view</AlertTitle>
          <AlertDescription>
            You have viewer access to the Risk Strategy module. Changes can only be proposed by Governance
            Contributors and approved by Governance Approvers.
          </AlertDescription>
        </Alert>
      )}

      {/* ─── Loading Skeleton ──────────────────────────────────────────────── */}
      {showLoading && (
        <div className="space-y-6" role="status">
          <span className="sr-only">Loading risk strategy…</span>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {/* ─── Error State ───────────────────────────────────────────────────── */}
      {loadError && (
        <div className="space-y-3">
          <ErrorState
            title="Couldn't load the risk strategy"
            message={
              orgId
                ? "The configuration could not be retrieved from the server."
                : "No active organization was found for this session."
            }
          />
          {orgId && (
            <Button variant="outline" size="sm" onClick={() => void currentQuery.refetch()}>
              Try again
            </Button>
          )}
        </div>
      )}

      {/* ─── Main Editor View ──────────────────────────────────────────────── */}
      {!showLoading && !loadError && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="text-base text-navy-deep">Rating scale</CardTitle>
                <CardDescription className="max-w-md">
                  Choose how many levels your likelihood and impact ratings use.
                  {readOnlyForm && " (Locked in read-only mode for this version.)"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="scale" className="text-xs">
                  Levels
                </Label>
                <Select
                  value={String(cfg.scaleLevel)}
                  onValueChange={(v) => changeScale(Number(v) as ScaleLevel)}
                  disabled={readOnlyForm}
                >
                  <SelectTrigger id="scale" className="w-[11rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 levels (Low / Mod / High)</SelectItem>
                    <SelectItem value="4">4 levels</SelectItem>
                    <SelectItem value="5">5 levels (Very Low → Very High)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
          </Card>

          <Tabs defaultValue="appetite">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="appetite" className="gap-1.5">
                <Target className="h-3.5 w-3.5" /> Appetite
              </TabsTrigger>
              <TabsTrigger value="likelihood" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Likelihood
              </TabsTrigger>
              <TabsTrigger value="impact" className="gap-1.5">
                <Gauge className="h-3.5 w-3.5" /> Impact
              </TabsTrigger>
            </TabsList>

            <TabsContent value="appetite" className="mt-5">
              <AppetiteTab cfg={cfg} edit={edit} readOnly={readOnlyForm} />
            </TabsContent>
            <TabsContent value="likelihood" className="mt-5">
              <LikelihoodTab cfg={cfg} edit={edit} readOnly={readOnlyForm} />
            </TabsContent>
            <TabsContent value="impact" className="mt-5">
              <ImpactTab cfg={cfg} edit={edit} readOnly={readOnlyForm} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ─── Reset Confirmation Dialog ─────────────────────────────────────── */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This proposes a new draft version with default appetite statements and standard {cfg.scaleLevel}-level
              bands. The current configuration remains in version history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmReset(false);
                void handleReset();
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Approver Decision Dialog ──────────────────────────────────────── */}
      <Dialog open={decisionModalOpen} onOpenChange={setDecisionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingDecisionType === "APPROVE"
                ? "Approve risk strategy"
                : pendingDecisionType === "REJECT"
                  ? "Reject draft proposal"
                  : "Request revisions"}
            </DialogTitle>
            <DialogDescription>
              {pendingDecisionType === "APPROVE"
                ? `Approving draft v${pendingDraft?.version} immediately publishes it as the active baseline, superseding v${activeVersion?.version}.`
                : `Provide feedback for draft v${pendingDraft?.version}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="comments">
              Decision comments {pendingDecisionType !== "APPROVE" && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="comments"
              placeholder={
                pendingDecisionType === "APPROVE"
                  ? "e.g., Aligned with the enterprise risk assessment."
                  : "e.g., Financial thresholds for Level 4 must be recalibrated."
              }
              value={decisionComments}
              onChange={(e) => setDecisionComments(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={pendingDecisionType === "REJECT" ? "destructive" : "brand"}
              disabled={saving || (pendingDecisionType !== "APPROVE" && !decisionComments.trim())}
              onClick={handleDecisionSubmit}
            >
              {saving && <Loader2 className="animate-spin" />}
              {pendingDecisionType === "APPROVE"
                ? "Confirm & activate"
                : pendingDecisionType === "REJECT"
                  ? "Confirm rejection"
                  : "Request revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RiskStrategy;
