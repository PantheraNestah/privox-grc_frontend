import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { ClipboardCheck, Inbox, Settings2, ShieldCheck, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/grc/common/PageHeader";
import { TENANT_HOME } from "@/components/grc/common/home-links";
import {
  ApprovalsView,
  AssessmentSettingsDialog,
  PeriodBar,
  ReportsView,
  WorklistView,
  currentQuarter,
} from "@/components/grc/assessment/ServerAssessmentViews";
import { usePendingApprovals } from "@/hooks/use-strategy-assessment";

type Tab = "worklist" | "approvals" | "reports";
const TABS: Tab[] = ["worklist", "approvals", "reports"];

const StrategyAssessment = () => {
  const { organization, permissions, hasModule } = useAuth();
  const orgId = organization?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : "worklist";
  const [period, setPeriod] = useState(currentQuarter);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Strict separation: contributing, deciding and configuring are three capabilities.
  const canView = hasModule("GOVERNANCE");
  const canContribute = permissions.includes("strategy.contribute") || permissions.includes("organization.manage");
  const canApprove = permissions.includes("strategy.approve") || permissions.includes("organization.manage");
  const canManageSettings = permissions.includes("organization.manage");
  const pending = usePendingApprovals(orgId);
  const pendingCount = pending.data?.length ?? 0;

  const changeTab = (value: string) => setSearchParams(value === "worklist" ? {} : { tab: value });

  return (
    <>
      <Helmet>
        <title>Strategy Performance Assessment · Rsolve GRC Platform</title>
        <meta name="description" content="Assess strategic initiatives against their KPIs and route them for approval." />
        <link rel="canonical" href="/governance/strategy-assessment" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Governance", to: "/governance" }, { label: "Strategy Assessment" }]}
        title="Performance Assessment"
        description={
          <>
            Assess each initiative for the period, then submit it for approval.
            {!canContribute && <span className="block pt-1 text-xs text-muted-foreground">Read only for your role.</span>}
          </>
        }
        actions={
          canManageSettings ? (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4" /> Settings
            </Button>
          ) : undefined
        }
      />

      {!canView && (
        <Alert className="mb-6 py-2.5">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription className="text-xs">The Governance module is not enabled for your account.</AlertDescription>
        </Alert>
      )}

      {orgId && (
        <>
          <div className="mb-5">
            <PeriodBar period={period} onChange={setPeriod} />
          </div>

          <Tabs value={tab} onValueChange={changeTab}>
            <TabsList className="mb-5 h-auto w-full flex-nowrap justify-start overflow-x-auto sm:w-fit">
              <TabsTrigger value="worklist" className="gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" /> Initiatives
              </TabsTrigger>
              <TabsTrigger value="approvals" className="gap-1.5">
                <Inbox className="h-3.5 w-3.5" /> Approvals
                {pendingCount > 0 && <span className="ml-1 rounded-full bg-brand-accent px-1.5 text-[10px] text-white">{pendingCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Reports
              </TabsTrigger>
            </TabsList>

            <TabsContent value="worklist" className="mt-0">
              <WorklistView orgId={orgId} period={period} canContribute={canContribute} />
            </TabsContent>
            <TabsContent value="approvals" className="mt-0">
              <ApprovalsView orgId={orgId} canApprove={canApprove} />
            </TabsContent>
            <TabsContent value="reports" className="mt-0">
              <ReportsView orgId={orgId} period={period} />
            </TabsContent>
          </Tabs>

          {canManageSettings && (
            <AssessmentSettingsDialog orgId={orgId} open={settingsOpen} onOpenChange={setSettingsOpen} />
          )}
        </>
      )}
    </>
  );
};

export default StrategyAssessment;
