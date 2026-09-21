import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";
import { AuthShell, ViewHeader } from "@/components/grc/auth-bits";
import { CredentialsForm } from "@/components/grc/CredentialsForm";
import { AuthLoading } from "@/components/grc/AuthLoading";

const PlatformLogin = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading } = usePlatformAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/platform/dashboard", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || isAuthenticated) return <AuthLoading />;

  return (
    <>
      <Helmet>
        <title>Platform Admin · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Platform administration sign-in for organisation onboarding, approvals and module assignment."
        />
        <link rel="canonical" href="/platform/login" />
      </Helmet>

      <AuthShell
        panelTitle={
          <>
            Platform
            <strong className="block font-semibold text-sky">Administration</strong>
          </>
        }
        panelSubtitle="Operator console for onboarding organisations, validating tenants and assigning platform modules."
      >
        <ViewHeader
          title="Administrator sign in"
          sub="Sign in with your platform operator credentials."
        />

        <CredentialsForm
          identifierPlaceholder="operator@privox.io"
          failureLabel="Sign-in failed"
          onSubmit={async (credentials) => {
            await login(credentials);
            navigate("/platform/dashboard", { replace: true });
          }}
          footer={
            <p className="mt-4 text-center text-xs text-brand-muted">
              Tenant user?{" "}
              <Link to="/" className="font-medium text-brand-accent transition hover:text-navy">
                Sign in to your organisation
              </Link>
            </p>
          }
        />
      </AuthShell>
    </>
  );
};

export default PlatformLogin;
