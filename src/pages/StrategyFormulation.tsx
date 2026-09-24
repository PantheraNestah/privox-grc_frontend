import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  ClipboardCheck,
  Compass,
  ListChecks,
  Network,
  Plus,
  Settings2,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { ErrorState } from "@/components/grc/common/states";
import {
  CreateStrategyElementDialog,
  StrategyBlueprintView,
  StrategyElementDetailSheet,
  StrategyElementsView,
  StrategyInsightsView,
  StrategyKpisView,
  StrategyOverviewView,
  StrategySettingsDialog,
} from "@/components/grc/strategy/StrategyFormulationViews";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgNodes } from "@/hooks/use-org-nodes";
import {
  useStrategyFormulationSettings,
  useStrategyInsights,
  useStrategySummary,
  useStrategyTree,
} from "@/hooks/use-strategy-formulation";
import { fromOrgNodeResponse } from "@/lib/org-node-mapping";
import type { StrategyElementType } from "@/lib/strategy-formulation-types";

const SECTIONS = [
  { value: "overview", label: "Overview", icon: Compass },
  { value: "blueprint", label: "Blueprint", icon: Network },
  { value: "elements", label: "Elements", icon: ListChecks },
  { value: "kpis", label: "KPIs & Progress", icon: TrendingUp },
  { value: "insights", label: "Insights", icon: BarChart3 },
] as const;

type Section = (typeof SECTIONS)[number]["value"];

function isSection(value: string | null): value is Section {
  return SECTIONS.some((section) => section.value === value);
}

const StrategyFormulation = () => {
  const { organization, permissions } = useAuth();
  const orgId = organization?.id;
  const canView = permissions.includes("strategyformulation.view");
  const canManage = permissions.includes("strategyformulation.manage");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: Section = isSection(requestedTab) ? requestedTab : "overview";
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<StrategyElementType>("PILLAR");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const treeQuery = useStrategyTree(canView ? orgId : undefined);
  const summaryQuery = useStrategySummary(canView ? orgId : undefined);
  const insightsQuery = useStrategyInsights(canView ? orgId : undefined);
  const settingsQuery = useStrategyFormulationSettings(canView ? orgId : undefined);
  const orgNodesQuery = useOrgNodes(canManage ? orgId : undefined);

  const changeTab = (value: string) => {
    setSearchParams(value === "overview" ? {} : { tab: value });
  };
  const openCreate = (type: StrategyElementType = "PILLAR") => {
    setCreateType(type);
    setCreateOpen(true);
  };
  const viewProps = {
    tree: treeQuery.data ?? [],
    summary: summaryQuery.data,
    insights: insightsQuery.data,
    loading: treeQuery.isPending || summaryQuery.isPending || insightsQuery.isPending,
    error: treeQuery.error ?? summaryQuery.error ?? insightsQuery.error,
    canManage,
    onOpen: setSelectedElementId,
    onNew: openCreate,
  };

  return (
    <>
      <Helmet>
        <title>Strategy Formulation · Rsolve GRC Platform</title>
        <meta name="description" content="Build, version, publish and monitor the organization's strategic formulation blueprint." />
        <link rel="canonical" href="/governance/strategy-formulation" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Governance", to: "/governance" }, { label: "Strategy Formulation" }]}
        title="Strategy Formulation"
        description="Design the path from organizational pillars to owned initiatives, activities and measurable KPIs. Every change creates an immutable, auditable version."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/governance/strategy-assessment"><ClipboardCheck /> Go to assessment</Link>
            </Button>
            {canManage && settingsQuery.data && (
              <Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 /> Settings</Button>
            )}
            {canManage && <Button variant="brand" onClick={() => openCreate()}><Plus /> New element</Button>}
          </>
        }
      />

      {!orgId ? (
        <ErrorState title="No organization" message="No active organization was found for this session." />
      ) : !canView ? (
        <Alert variant="destructive" className="bg-destructive/5">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Strategy Formulation is restricted</AlertTitle>
          <AlertDescription>Your account needs the strategyformulation.view permission to access this workspace.</AlertDescription>
        </Alert>
      ) : (
        <>
          {!canManage && (
            <Alert className="mb-5 py-2.5">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">You have a read-only formulation view. Strategy creation and governance actions require strategyformulation.manage.</AlertDescription>
            </Alert>
          )}
          <Tabs value={activeTab} onValueChange={changeTab}>
            <TabsList className="mb-5 h-auto w-full flex-nowrap justify-start overflow-x-auto sm:w-fit" aria-label="Strategy formulation views">
              {SECTIONS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="gap-1.5"><Icon className="h-3.5 w-3.5" /> {label}</TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="overview" className="mt-0"><StrategyOverviewView {...viewProps} /></TabsContent>
            <TabsContent value="blueprint" className="mt-0"><StrategyBlueprintView {...viewProps} /></TabsContent>
            <TabsContent value="elements" className="mt-0"><StrategyElementsView {...viewProps} /></TabsContent>
            <TabsContent value="kpis" className="mt-0"><StrategyKpisView {...viewProps} /></TabsContent>
            <TabsContent value="insights" className="mt-0"><StrategyInsightsView {...viewProps} /></TabsContent>
          </Tabs>
        </>
      )}

      {createOpen && orgId && (
        <CreateStrategyElementDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          orgId={orgId}
          tree={treeQuery.data ?? []}
          orgNodes={(orgNodesQuery.data ?? [])
            .filter((node) => !node.effectiveTo)
            .map((node) => {
              const mapped = fromOrgNodeResponse(node);
              return { id: mapped.id, name: mapped.name };
            })}
          orgNodesError={orgNodesQuery.error}
          initialType={createType}
        />
      )}
      {settingsOpen && orgId && settingsQuery.data && (
        <StrategySettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          orgId={orgId}
          settings={settingsQuery.data}
        />
      )}
      {orgId && selectedElementId && (
        <StrategyElementDetailSheet
          orgId={orgId}
          elementId={selectedElementId}
          open={!!selectedElementId}
          onOpenChange={(open) => !open && setSelectedElementId(null)}
          canManage={canManage}
        />
      )}
    </>
  );
};

export default StrategyFormulation;
