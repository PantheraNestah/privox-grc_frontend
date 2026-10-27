import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { AuthScreen } from "@/components/grc/AuthScreen";
import { AuthLoading } from "@/components/grc/AuthLoading";

const Index = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated, isLoading, organizationSelection } = useAuth();
  // `/login?org=<organizationId>` lets emailed links name the organization and
  // skip the picker (issue: skip the picker when the organization is known).
  const organizationHint = params.get("org")?.trim() || undefined;

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (organizationSelection) {
      navigate("/choose-organization", { replace: true });
    }
  }, [isAuthenticated, isLoading, organizationSelection, navigate]);

  // Avoid a flash of the login form while a stored session is being restored.
  if (isLoading) return <AuthLoading />;
  if (isAuthenticated) return null;

  return (
    <>
      <Helmet>
        <title>Sign In · Rsolve GRC Platform</title>
        <meta name="description" content="Secure access to the Rsolve unified Governance, Risk and Compliance platform." />
        <link rel="canonical" href="/" />
      </Helmet>
      <AuthScreen organizationHint={organizationHint} />
    </>
  );
};

export default Index;
