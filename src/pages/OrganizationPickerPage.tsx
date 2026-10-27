import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AlertCircle, ArrowLeft, Building2 } from "lucide-react";
import { isAxiosError } from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { OrganizationCard } from "@/components/grc/OrganizationCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BrandName, Logo } from "@/components/grc/Logo";
import { isUnauthorized } from "@/lib/auth-session";
import {
  ORGANIZATION_ACCESS_LOST_MESSAGE,
  getLastOrganization,
  mostRecentlyUsed,
} from "@/lib/organization-options";

/**
 * Post-login organization picker.
 *
 * Only reachable while `organizationSelection` is in memory: the selection
 * token is deliberately never persisted, so a reload lands back on the login
 * form instead of a picker that cannot finish.
 */
export default function OrganizationPickerPage() {
  const navigate = useNavigate();
  const {
    organizationSelection,
    selectOrganization,
    cancelOrganizationSelection,
  } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOrganization] = useState(() => getLastOrganization());

  const cancel = useCallback(() => {
    cancelOrganizationSelection();
    navigate("/", { replace: true });
  }, [cancelOrganizationSelection, navigate]);

  useEffect(() => {
    setError(null);
  }, [organizationSelection?.selectionToken]);

  if (!organizationSelection) {
    return <Navigate to="/" replace />;
  }

  const { organizations } = organizationSelection;
  const recent = mostRecentlyUsed(organizations);
  // The locally remembered choice wins: it is what this browser used last.
  const lastUsedName = lastOrganization?.name ?? recent?.name;

  const choose = async (organizationId: string) => {
    setSelectedId(organizationId);
    setError(null);
    try {
      await selectOrganization(organizationId);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (isUnauthorized(err)) {
        // The context cleared the selection and set the credentials notice;
        // the render below redirects to the login form.
        return;
      }
      if (isAxiosError(err) && err.response?.status === 403) {
        setError(ORGANIZATION_ACCESS_LOST_MESSAGE);
      } else {
        setError("We couldn't open that organization. Please try again.");
      }
    } finally {
      setSelectedId(null);
    }
  };

  return (
    <div className="min-h-screen bg-offwhite text-foreground">
      <Helmet>
        <title>Choose an Organization · Rsolve GRC Platform</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-5 py-4 sm:px-8">
          <Logo size={30} />
          <BrandName className="text-xl font-semibold tracking-tight text-navy-deep" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
            <Building2 className="h-3.5 w-3.5" aria-hidden /> Organization
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-navy-deep sm:text-3xl">
            Choose an organization
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-brand-muted">
            You belong to more than one organization. Pick the one you want to work in —
            you can switch again at any time from the header.
            {lastUsedName && (
              <>
                {" "}
                <span className="text-navy-dark">Welcome back — you last used {lastUsedName}.</span>
              </>
            )}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-5 flex items-center gap-2 py-2.5 text-[13px]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {organizations.length === 0 ? (
          <div className="rounded-xl border border-border bg-white p-8 text-center">
            <p className="text-sm text-brand-muted">
              You no longer have access to any of the organizations offered. Please sign in again.
            </p>
            <Button variant="brand" className="mt-4" onClick={cancel}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            role="list"
            aria-label="Your organizations"
          >
            {organizations.map((organization) => (
              <div role="listitem" key={organization.id}>
                <OrganizationCard
                  organization={organization}
                  highlight={organization.id === recent?.id}
                  loading={selectedId === organization.id}
                  disabled={selectedId !== null}
                  onSelect={() => void choose(organization.id)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <button
            type="button"
            onClick={cancel}
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-navy"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Not you? Sign in as someone else
          </button>
        </div>
      </main>
    </div>
  );
}
