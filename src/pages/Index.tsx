import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { AuthScreen } from "@/components/grc/AuthScreen";
import { AuthLoading } from "@/components/grc/AuthLoading";

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

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
      <AuthScreen />
    </>
  );
};

export default Index;
