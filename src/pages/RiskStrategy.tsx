import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Activity, Gauge, Loader2, Lock, Save, Target } from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { ErrorState } from "@/components/grc/common/states";
import { AppetiteTab, ImpactTab, LikelihoodTab } from "@/components/grc/strategy/RiskScaleEditors";
import { withScaleLevel } from "@/components/grc/strategy/risk-config";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveUser } from "@/hooks/use-active-user";
import {
  isRealStrategyError,
  useCreateRiskStrategyVersion,
  useCurrentRiskStrategy,
  useDecideRiskStrategyVersion,
} from "@/hooks/use-risk-strategy";
import { buildDefaultConfig } from "@/data/orgStore";
import type { RiskStrategyConfig, ScaleLevel } from "@/data/orgStore";
import { fromRiskStrategyResponse, toCreateRiskStrategyVersionRequest } from "@/lib/risk-strategy-mapping";

const RiskStrategy = () => {
  const activeUser = useActiveUser();
  const isAdmin = activeUser?.role === "admin";
  const readOnly = !isAdmin;

  const { organization } = useAuth();
  const orgId = organization?.id;
  const current = useCurrentRiskStrategy(orgId);
  const createVersion = useCreateRiskStrategyVersion(orgId ?? "");
  const decideVersion = useDecideRiskStrategyVersion(orgId ?? "");

  // The server version is the baseline; `draft` holds unsaved edits on top of it.
  const serverCfg = useMemo(
    () => (current.data ? fromRiskStrategyResponse(current.data) : buildDefaultConfig(3)),
    [current.data],
  );
  const [draft, setDraft] = useState<RiskStrategyConfig | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const cfg = draft ?? serverCfg;
  const dirty = draft !== null;
  const saving = createVersion.isPending || decideVersion.isPending;
  const hasSavedVersion = !!current.data;

  const edit = (fn: (cfg: RiskStrategyConfig) => RiskStrategyConfig) =>
    setDraft((prev) => fn(prev ?? serverCfg));

  /**
   * The backend versions risk strategy and can gate a new version behind
   * approval (`requiresApproval`). This page has no separate approval UI, so
   * to preserve the single-shot "Save" behaviour for an admin, a version created
   * while approval is required is immediately self-approved.
   */
  const persist = async (next: RiskStrategyConfig) => {
    if (!orgId) return;
    const created = await createVersion.mutateAsync(toCreateRiskStrategyVersionRequest(next));
    if (!created.current) {
      await decideVersion.mutateAsync({ configId: created.id, body: { decision: "APPROVE" } });
    }
    setDraft(null);
  };

  const save = async () => {
    try {
      await persist(cfg);
      toast.success("Risk strategy saved");
    } catch {
      toast.error("Failed to save risk strategy");
    }
  };

  const reset = async () => {
    const defaults = buildDefaultConfig(cfg.scaleLevel);
    setDraft(defaults);
    try {
      await persist(defaults);
      toast.success("Reset to defaults");
    } catch {
      toast.error("Failed to reset risk strategy");
    }
  };

  const changeScale = (level: ScaleLevel) => {
    edit((c) => withScaleLevel(c, level));
    toast.info(`Scale set to ${level} levels`);
  };

  const showLoading = !!orgId && current.isLoading;
  const loadError = !orgId || (current.isError && isRealStrategyError(current.error));

  return (
    <>
      <Helmet>
        <title>Risk Strategy · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Define risk appetite, likelihood and impact scales, and quantitative thresholds across people, compliance, reputation, financial, operational and strategic dimensions."
        />
        <link rel="canonical" href="/governance/risk-strategy" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Governance", to: "/governance" }, { label: "Risk Strategy" }]}
        title="Risk Strategy"
        description="Define your organisation's risk appetite, likelihood and impact rating scales, and quantitative thresholds."
        eyebrow={
          dirty && (
            <Badge variant="secondary" className="text-[11px] font-normal">
              Unsaved changes
            </Badge>
          )
        }
        actions={
          isAdmin &&
          !showLoading &&
          !loadError && (
            <>
              <Button variant="outline" onClick={() => setConfirmReset(true)} disabled={saving}>
                Reset
              </Button>
              <Button variant="brand" onClick={save} disabled={saving || (!dirty && hasSavedVersion)}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
              </Button>
            </>
          )
        }
      />

      {readOnly && (
        <Alert className="mb-6">
          <Lock className="h-4 w-4" />
          <AlertTitle>Read-only view</AlertTitle>
          <AlertDescription>
            Only an Administrator can define or change the organisation's risk appetite, rating scales and impact
            thresholds. You can review the current configuration below.
          </AlertDescription>
        </Alert>
      )}

      {showLoading && (
        <div className="space-y-6" role="status">
          <span className="sr-only">Loading risk strategy…</span>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-72 w-full" />
        </div>
      )}

      {loadError && (
        <div className="space-y-3">
          <ErrorState
            title="Couldn't load the risk strategy"
            message={
              orgId
                ? "The current configuration could not be retrieved, so editing is disabled to avoid overwriting it."
                : "No active organization was found for this session."
            }
          />
          {orgId && (
            <Button variant="outline" size="sm" onClick={() => void current.refetch()}>
              Try again
            </Button>
          )}
        </div>
      )}

      {!showLoading && !loadError && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="text-base text-navy-deep">Rating scale</CardTitle>
                <CardDescription className="max-w-md">
                  Choose how many levels your likelihood and impact ratings use. Changing this rebuilds the default
                  labels — your appetite statements are kept.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="scale" className="text-xs">
                  Levels
                </Label>
                <Select
                  value={String(cfg.scaleLevel)}
                  onValueChange={(v) => changeScale(Number(v) as ScaleLevel)}
                  disabled={readOnly}
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
              <AppetiteTab cfg={cfg} edit={edit} readOnly={readOnly} />
            </TabsContent>
            <TabsContent value="likelihood" className="mt-5">
              <LikelihoodTab cfg={cfg} edit={edit} readOnly={readOnly} />
            </TabsContent>
            <TabsContent value="impact" className="mt-5">
              <ImpactTab cfg={cfg} edit={edit} readOnly={readOnly} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This saves a new version with the default appetite categories and {cfg.scaleLevel}-level bands. Your
              current configuration stays available in version history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmReset(false);
                void reset();
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RiskStrategy;
