import { useEffect, useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Hash,
  MapPin,
  Pencil,
} from "lucide-react";
import { TopNav } from "@/components/grc/TopNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { fetchOrganization } from "@/lib/organization";
import type { OrganizationDetailDto } from "@/lib/auth-types";

type LoadState = "idle" | "loading" | "ready" | "error";

const fallbackText = "Unknown";

function formatValue(value: unknown) {
  if (value == null || value === "") return fallbackText;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(date.getTime())) {
      return date.toLocaleString();
    }
    return value;
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallbackText;
  return JSON.stringify(value);
}

function statusLabel(org: OrganizationDetailDto) {
  if (typeof org.active === "boolean") return org.active ? "Active" : "Inactive";
  return org.status?.trim() || fallbackText;
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 break-words text-sm font-medium text-foreground">{formatValue(value)}</p>
    </div>
  );
}

const OrganizationDetails = () => {
  const { organization: authOrganization } = useAuth();
  const [organization, setOrganization] = useState<OrganizationDetailDto | null>(authOrganization);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authOrganization?.id) {
      setOrganization(null);
      setState("error");
      setError("No active organization was found for this session.");
      return;
    }

    let cancelled = false;
    setState("loading");
    setError(null);

    fetchOrganization(authOrganization.id)
      .then((data) => {
        if (cancelled) return;
        setOrganization({ ...authOrganization, ...data });
        setState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load organization details");
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [authOrganization]);

  const pageTitle = organization?.name ?? authOrganization?.name ?? "Organization Details";

  return (
    <>
      <Helmet>
        <title>{pageTitle} - Rsolve GRC Platform</title>
        <meta name="description" content="View organization details from the backend organization endpoint." />
        <link rel="canonical" href="/settings/organization" />
      </Helmet>

      <div className="flex min-h-screen flex-col">
        <TopNav />

        <main className="flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-9">
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/dashboard" className="transition-colors hover:text-foreground">Dashboard</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">Organization Details</span>
          </nav>

          <header className="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 text-[11px]">
                  <Building2 className="h-3.5 w-3.5" />
                  Organization
                </Badge>
                {organization && <Badge variant="secondary" className="text-[11px]">{statusLabel(organization)}</Badge>}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{pageTitle}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Read-only organization profile from the active session endpoint.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Button disabled size="sm" className="gap-1.5">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Link>
              </Button>
            </div>
          </header>

          {state === "loading" && (
            <div className="py-10 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Loading organization details...</p>
            </div>
          )}

          {state === "error" && (
            <Card className="border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{error ?? "Failed to load organization details"}</p>
            </Card>
          )}

          {state === "ready" && organization && (
            <div className="space-y-5">
              <Card className="p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Name" value={organization.name} />
                  <DetailRow icon={<Hash className="h-3.5 w-3.5" />} label="Code" value={organization.code} />
                  <DetailRow icon={<BadgeCheck className="h-3.5 w-3.5" />} label="Status" value={statusLabel(organization)} />
                  <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Country Code" value={organization.countryCode} />
                  <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Created" value={organization.createdAt} />
                  <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Updated" value={organization.updatedAt} />
                </div>
              </Card>

              <p className="text-xs text-muted-foreground">
                Editing is disabled until the organization update endpoint is provided.
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default OrganizationDetails;
