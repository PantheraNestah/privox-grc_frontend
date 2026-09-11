import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlatformAuthProvider } from "@/contexts/PlatformAuthContext";
import { RequireAuth } from "@/components/grc/RequireAuth";
import { RequirePlatformAuth } from "@/components/grc/RequirePlatformAuth";
import { PlatformLayout } from "@/components/grc/PlatformLayout";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Governance from "./pages/Governance.tsx";
import RiskGovernance from "./pages/RiskGovernance.tsx";
import RiskStrategy from "./pages/RiskStrategy.tsx";
import StrategyFormulation from "./pages/StrategyFormulation.tsx";
import StrategyAssessment from "./pages/StrategyAssessment.tsx";
import DocumentManagement from "./pages/DocumentManagement.tsx";
import SurveyManagement from "./pages/SurveyManagement.tsx";
import SurveyRespond from "./pages/SurveyRespond.tsx";
import OrganizationDetails from "./pages/OrganizationDetails.tsx";
import UserManagement, {
  GroupEdit,
  GroupMembersView,
  GroupView,
  UserMemberEdit,
  UserMemberView,
} from "./pages/UserManagement.tsx";
import NotFound from "./pages/NotFound.tsx";
import PlatformLogin from "./pages/platform/PlatformLogin.tsx";
import PlatformDashboard from "./pages/platform/PlatformDashboard.tsx";
import PlatformOrganizations from "./pages/platform/PlatformOrganizations.tsx";
import PlatformOrganizationDetails from "./pages/platform/PlatformOrganizationDetails.tsx";
import PlatformModules from "./pages/platform/PlatformModules.tsx";
import PlatformTemplates from "./pages/platform/PlatformTemplates.tsx";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlatformAuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route element={<RequireAuth />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/governance" element={<Governance />} />
                  <Route path="/governance/risk-governance" element={<RiskGovernance />} />
                  <Route path="/governance/strategy-formulation" element={<StrategyFormulation />} />
                  <Route path="/governance/strategy-assessment" element={<StrategyAssessment />} />
                  <Route path="/governance/risk-strategy" element={<RiskStrategy />} />
                  <Route path="/governance/documents" element={<DocumentManagement />} />
                  <Route path="/governance/surveys" element={<SurveyManagement />} />
                  <Route path="/surveys/:surveyId/respond" element={<SurveyRespond />} />
                  <Route path="/settings/organization" element={<OrganizationDetails />} />
                  <Route path="/settings/users" element={<UserManagement />} />
                  <Route path="/settings/users/members/:memberId" element={<UserMemberView />} />
                  <Route path="/settings/users/members/:memberId/edit" element={<UserMemberEdit />} />
                  <Route path="/settings/users/groups/:groupId" element={<GroupView />} />
                  <Route path="/settings/users/groups/:groupId/members" element={<GroupMembersView />} />
                  <Route path="/settings/users/groups/:groupId/edit" element={<GroupEdit />} />
                </Route>

                {/* Platform admin portal */}
                <Route path="/platform/login" element={<PlatformLogin />} />
                <Route element={<RequirePlatformAuth />}>
                  <Route path="/platform" element={<PlatformLayout />}>
                    <Route index element={<Navigate to="/platform/dashboard" replace />} />
                    <Route path="dashboard" element={<PlatformDashboard />} />
                    <Route path="organizations" element={<PlatformOrganizations />} />
                    <Route path="organizations/:orgId" element={<PlatformOrganizationDetails />} />
                    <Route path="modules" element={<PlatformModules />} />
                    <Route path="templates" element={<PlatformTemplates />} />
                  </Route>
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </PlatformAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
