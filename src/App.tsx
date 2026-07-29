import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/grc/RequireAuth";
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
import UserManagement from "./pages/UserManagement.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
                <Route path="/settings/users" element={<UserManagement />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
