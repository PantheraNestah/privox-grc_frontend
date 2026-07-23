import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { AuthScreen } from "@/components/grc/AuthScreen";

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Show nothing while checking auth status (avoids flash of login page)
  if (isLoading) return null;
  if (isAuthenticated) return null;

  return (
    <>
      <Helmet>
        <title>Sign In · Rsolve GRC Platform</title>
        <meta name="description" content="Secure access to the Rsolve unified Governance, Risk and Compliance platform." />
        <link rel="canonical" href="/" />
      </Helmet>
      <AuthScreen />
    </>
  );
};

export default Index;
