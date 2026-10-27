import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { queryClient } from "@/lib/query-client";
import { PlatformAuthProvider } from "@/contexts/PlatformAuthContext";
import { RequireAuth } from "@/components/grc/RequireAuth";
import { RequireOrgAdmin } from "@/components/grc/RequireOrgAdmin";
import { RequireModule } from "@/components/grc/RequireModule";
import { RequirePlatformAuth } from "@/components/grc/RequirePlatformAuth";
import { PlatformLayout } from "@/components/grc/PlatformLayout";
import { TenantLayout } from "@/components/grc/TenantLayout";
import { SessionConflictOverlay } from "@/components/grc/SessionConflictOverlay";
import { RouteFallback } from "@/components/grc/RouteFallback";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";

// Every workspace page is split into its own chunk: the sign-in route stays
// small (the majority of first visits never authenticate) and no page pays for
// another page's dialogs, charts or table code. `Index` is the one deliberate
// exception — it is the entry route, so loading it eagerly avoids a chunk
// waterfall on the critical path.
const OrganizationPickerPage = lazy(() => import("./pages/OrganizationPickerPage.tsx"));
const AcceptInvitationPage = lazy(() => import("./pages/AcceptInvitationPage.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Governance = lazy(() => import("./pages/Governance.tsx"));
const RiskGovernance = lazy(() => import("./pages/RiskGovernance.tsx"));
const RiskStrategy = lazy(() => import("./pages/RiskStrategy.tsx"));
const StrategyFormulation = lazy(() => import("./pages/StrategyFormulation.tsx"));
const StrategyAssessment = lazy(() => import("./pages/StrategyAssessment.tsx"));
const DocumentManagement = lazy(() => import("./pages/DocumentManagement.tsx"));
const SurveyManagement = lazy(() => import("./pages/SurveyManagement.tsx"));
const SurveyRespond = lazy(() => import("./pages/SurveyRespond.tsx"));
const OrganizationDetails = lazy(() => import("./pages/OrganizationDetails.tsx"));
const AccountSettings = lazy(() => import("./pages/AccountSettings.tsx"));
const ModuleSettings = lazy(() => import("./pages/ModuleSettings.tsx"));
const UserManagement = lazy(() => import("./pages/UserManagement.tsx"));
// Named exports of the same chunk — they share the module instance above.
const UserMemberView = lazy(() =>
  import("./pages/UserManagement.tsx").then((m) => ({ default: m.UserMemberView })),
);
const UserMemberEdit = lazy(() =>
  import("./pages/UserManagement.tsx").then((m) => ({ default: m.UserMemberEdit })),
);
const GroupView = lazy(() =>
  import("./pages/UserManagement.tsx").then((m) => ({ default: m.GroupView })),
);
const GroupMembersView = lazy(() =>
  import("./pages/UserManagement.tsx").then((m) => ({ default: m.GroupMembersView })),
);
const GroupEdit = lazy(() =>
  import("./pages/UserManagement.tsx").then((m) => ({ default: m.GroupEdit })),
);
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const PlatformLogin = lazy(() => import("./pages/platform/PlatformLogin.tsx"));
const PlatformDashboard = lazy(() => import("./pages/platform/PlatformDashboard.tsx"));
const PlatformOrganizations = lazy(() => import("./pages/platform/PlatformOrganizations.tsx"));
const PlatformOrganizationDetails = lazy(() => import("./pages/platform/PlatformOrganizationDetails.tsx"));
const PlatformModules = lazy(() => import("./pages/platform/PlatformModules.tsx"));
const PlatformTemplates = lazy(() => import("./pages/platform/PlatformTemplates.tsx"));
const PlatformTemplateRegister = lazy(() => import("./pages/platform/PlatformTemplateRegister.tsx"));

/**
 * Wraps a lazily imported page in its own Suspense boundary. Keeping the
 * boundary *inside* the route (rather than around `<Routes>`) means the
 * sidebar, header and navigation stay on screen while a page chunk loads.
 */
function page(Component: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Component />
    </Suspense>
  );
}

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlatformAuthProvider>
          <TooltipProvider>
            <Sonner />
            <SessionConflictOverlay />
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <Routes>
                <Route path="/" element={<Index />} />
                {/* Deep links may carry an organization hint: /login?org=<id>. */}
                <Route path="/login" element={<Index />} />
                <Route path="/choose-organization" element={page(OrganizationPickerPage)} />
                {/* Public invitation acceptance & signup (outside RequireAuth) */}
                <Route path="/signup" element={page(AcceptInvitationPage)} />
                <Route path="/accept-invitation" element={page(AcceptInvitationPage)} />
                <Route element={<RequireAuth />}>
                  <Route element={<TenantLayout />}>
                    <Route path="/dashboard" element={page(Dashboard)} />
                    {/* Governance section: gated by the GOVERNANCE module allocation. */}
                    <Route element={<RequireModule code="GOVERNANCE" staticId="governance" label="Governance" />}>
                      <Route path="/governance" element={page(Governance)} />
                      <Route path="/governance/risk-governance" element={page(RiskGovernance)} />
                      <Route path="/governance/strategy-formulation" element={page(StrategyFormulation)} />
                      <Route path="/governance/strategy-assessment" element={page(StrategyAssessment)} />
                      <Route path="/governance/risk-strategy" element={page(RiskStrategy)} />
                      <Route path="/governance/documents" element={page(DocumentManagement)} />
                      <Route path="/governance/surveys" element={page(SurveyManagement)} />
                    </Route>
                    <Route path="/settings/organization" element={page(OrganizationDetails)} />
                    <Route path="/settings/account" element={page(AccountSettings)} />
                    <Route path="/settings/modules" element={page(ModuleSettings)} />
                    <Route element={<RequireOrgAdmin />}>
                      <Route path="/settings/users" element={page(UserManagement)} />
                      <Route path="/settings/users/members/:memberId" element={page(UserMemberView)} />
                      <Route path="/settings/users/members/:memberId/edit" element={page(UserMemberEdit)} />
                      <Route path="/settings/users/groups/:groupId" element={page(GroupView)} />
                      <Route path="/settings/users/groups/:groupId/members" element={page(GroupMembersView)} />
                      <Route path="/settings/users/groups/:groupId/edit" element={page(GroupEdit)} />
                    </Route>
                  </Route>
                  {/* Respondent view: standalone page, no workspace chrome. */}
                  <Route path="/surveys/:surveyId/respond" element={page(SurveyRespond)} />
                </Route>

                {/* Platform admin portal */}
                <Route path="/platform/login" element={page(PlatformLogin)} />
                <Route element={<RequirePlatformAuth />}>
                  <Route path="/platform" element={<PlatformLayout />}>
                    <Route index element={<Navigate to="/platform/dashboard" replace />} />
                    <Route path="dashboard" element={page(PlatformDashboard)} />
                    <Route path="organizations" element={page(PlatformOrganizations)} />
                    <Route path="organizations/:orgId" element={page(PlatformOrganizationDetails)} />
                    <Route path="modules" element={page(PlatformModules)} />
                    <Route path="templates" element={page(PlatformTemplates)} />
                    <Route path="templates/new" element={page(PlatformTemplateRegister)} />
                  </Route>
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={page(NotFound)} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </PlatformAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
