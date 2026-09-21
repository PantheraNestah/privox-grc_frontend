// Strategy Performance Assessment.
//
// Tabs:
//   • Self-Assessment — every user can score their initiatives' KPIs (% achievement + RAG)
//   • Approvals       — submitted assessments the current user may decide (must sit STRICTLY
//                       ABOVE the submitter in the org hierarchy)
//   • Reports         — pillar roll-ups & overall performance gauges
//
// Visibility (Self-Assessment): global viewers (Admin / Risk Manager / Executive) see
// everything; everyone else only initiatives whose objective is linked to their unit or a
// descendant.

import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { ClipboardCheck, ShieldCheck, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { ApprovalsView } from "@/components/grc/assessment/ApprovalsView";
import { AssessmentEditor } from "@/components/grc/assessment/AssessmentEditor";
import { ReportsView } from "@/components/grc/assessment/ReportsView";
import { ReviewDialog } from "@/components/grc/assessment/ReviewDialog";
import { SelfAssessmentView } from "@/components/grc/assessment/SelfAssessmentView";
import { useAssessmentWorkflow } from "@/components/grc/assessment/useAssessmentWorkflow";
import type { InitiativeAssessment } from "@/data/assessmentStore";
import type { Initiative } from "@/data/strategyStore";
import { can, ROLE_LABELS } from "@/data/userStore";
import { useActiveUser } from "@/hooks/use-active-user";
import { cn } from "@/lib/utils";

type Tab = "assess" | "approvals" | "reports";

const StatCard = ({ label, value, dot }: { label: string; value: number; dot?: string }) => (
  <Card>
    <CardContent className="p-4">
      <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {dot && <span aria-hidden className={cn("h-2 w-2 rounded-full", dot)} />}
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold leading-none text-foreground">{value}</p>
    </CardContent>
  </Card>
);

const StrategyAssessment = () => {
  const activeUser = useActiveUser();
  const flow = useAssessmentWorkflow(activeUser);
  const [tab, setTab] = useState<Tab>("assess");
  const [editing, setEditing] = useState<{ a: InitiativeAssessment; init: Initiative } | null>(null);
  const [reviewing, setReviewing] = useState<InitiativeAssessment | null>(null);

  const { stats, approvalQueue } = flow;

  return (
    <>
      <Helmet>
        <title>Strategy Performance Assessment · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Self-assess strategic initiatives, score KPIs and route assessments through hierarchical approvals."
        />
        <link rel="canonical" href="/governance/strategy-assessment" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Governance", to: "/governance" }, { label: "Strategy Assessment" }]}
        title="Performance Assessment"
        description={
          <>
            Self-assess each initiative's KPIs (score % + RAG), then submit for approval. Approvals route up the org
            hierarchy automatically.{" "}
            <span className="block pt-1 text-xs">
              Viewing as <strong className="font-medium text-foreground">{activeUser.name}</strong> (
              {ROLE_LABELS[activeUser.role]})
            </span>
          </>
        }
      />

      <Alert className="mb-6 py-2.5">
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {flow.isGlobalViewer ? (
            <>
              <strong className="font-medium text-foreground">{ROLE_LABELS[activeUser.role]} view —</strong> seeing the
              entire performance picture across all units.
            </>
          ) : activeUser.orgNodeId ? (
            <>
              <strong className="font-medium text-foreground">Scoped view —</strong> you self-assess initiatives in your
              unit or a unit below it. Approvals you receive must come from above.
            </>
          ) : (
            <span className="text-warn">
              <strong className="font-medium">No org unit linked —</strong> ask an Administrator to assign you in User
              Management.
            </span>
          )}
        </AlertDescription>
      </Alert>

      <section aria-label="Assessment summary" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Initiatives" value={stats.total} />
        <StatCard label="Draft" value={stats.draft} dot="bg-muted-foreground" />
        <StatCard label="Awaiting approval" value={stats.submitted} dot="bg-brand-accent" />
        <StatCard label="Approved" value={stats.approved} dot="bg-success" />
        <StatCard label="Rejected" value={stats.rejected} dot="bg-destructive" />
      </section>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="mb-4 h-auto max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="assess" className="gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" /> Self-Assessment
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            {`Approvals${approvalQueue.length > 0 ? ` (${approvalQueue.length})` : ""}`}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Reports &amp; Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assess" className="mt-0">
          <SelfAssessmentView
            rows={flow.visibleRows}
            assessments={flow.assessments}
            users={flow.users}
            orgNodes={flow.orgNodes}
            canSelfAssess={can.submitAssessment(activeUser.role)}
            onOpen={(init, objectiveId, pillarId) => {
              const a = flow.ensureAssessment(init.id, objectiveId, pillarId, init.status);
              setEditing({ a, init });
            }}
          />
        </TabsContent>

        <TabsContent value="approvals" className="mt-0">
          <ApprovalsView
            queue={approvalQueue}
            cfg={flow.cfg}
            users={flow.users}
            orgNodes={flow.orgNodes}
            activeUser={activeUser}
            allAssessments={flow.assessments}
            onReview={setReviewing}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <ReportsView rows={flow.visibleRows} assessments={flow.assessments} cfg={flow.cfg} orgNodes={flow.orgNodes} />
        </TabsContent>
      </Tabs>

      {editing && (
        <AssessmentEditor
          assessment={editing.a}
          init={editing.init}
          currentUserId={activeUser.id}
          currentUserName={activeUser.name}
          onClose={() => {
            setEditing(null);
            flow.reload();
          }}
          onUpdate={(mutate) => {
            flow.updateAssessment(editing.a.id, mutate);
            // Keep the open dialog in step with what was just persisted.
            setEditing((prev) =>
              prev ? { ...prev, a: { ...mutate(prev.a), updatedAt: new Date().toISOString() } } : prev,
            );
          }}
          onSubmit={() => flow.submitForApproval(editing.a) && setEditing(null)}
        />
      )}

      {reviewing && (
        <ReviewDialog
          assessment={reviewing}
          init={flow.visibleRows.find((r) => r.init.id === reviewing.initiativeId)?.init}
          submitter={flow.users.find((u) => u.id === reviewing.createdByUserId)}
          users={flow.users}
          activeUser={activeUser}
          onClose={() => setReviewing(null)}
          onApprove={(c) => flow.approve(reviewing, c) && setReviewing(null)}
          onReject={(c) => flow.reject(reviewing, c) && setReviewing(null)}
          onSendBack={(c) => flow.sendBack(reviewing, c) && setReviewing(null)}
          onDelegate={(userId, c) => flow.delegate(reviewing, userId, c) && setReviewing(null)}
        />
      )}
    </>
  );
};

export default StrategyAssessment;
