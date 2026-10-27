import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useMyOrganizations } from "@/hooks/use-my-organizations";
import { OrganizationCard } from "@/components/grc/OrganizationCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrganizationDto, OrganizationOptionDto } from "@/lib/auth-types";

const chipClass =
  "inline-flex max-w-[280px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.07] px-2.5 py-1.5 text-xs font-medium text-sky transition hover:bg-white/15 hover:text-white";

/**
 * Header organization control. Single-organization users keep the plain link
 * to organization settings; users with 2+ organizations get a picker that
 * switches without logging out.
 */
export function OrganizationSwitcher({
  currentOrganization,
}: {
  currentOrganization: OrganizationDto | null;
}) {
  const navigate = useNavigate();
  const { switchOrganization } = useAuth();
  const query = useMyOrganizations(true);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<OrganizationOptionDto | null>(null);
  const [switching, setSwitching] = useState(false);

  const organizations = query.data?.organizations ?? [];
  const currentId = query.data?.currentOrganizationId ?? currentOrganization?.id ?? null;
  const label =
    currentOrganization?.name?.trim() || currentOrganization?.code?.trim() || "Organization";

  // Platform sessions and single-org users do not get a switcher.
  if (!currentOrganization || organizations.length < 2) {
    return (
      <Link
        to="/settings/organization"
        title="View organization details"
        className={chipClass}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  const choose = (organization: OrganizationOptionDto) => {
    if (organization.id === currentId) {
      setOpen(false);
      return;
    }
    setPending(organization);
  };

  const confirmSwitch = async () => {
    if (!pending) return;
    const target = pending;
    setSwitching(true);
    try {
      await switchOrganization(target.id);
      setPending(null);
      setOpen(false);
      toast.success(`Switched to ${target.name}`);
      // The cache was cleared and the navigation guards re-evaluate against
      // the new organization's permissions/modules.
      navigate("/dashboard");
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 403) {
        toast.error("You no longer have access to that organization.");
        // Keep the current session, but stop offering the stale card.
        void query.refetch();
      } else {
        toast.error("Couldn't switch organization. Please try again.");
      }
    } finally {
      setSwitching(false);
      setPending(null);
    }
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Fresh membership/module data whenever the menu opens.
          if (next) void query.refetch();
        }}
      >
        <PopoverTrigger asChild>
          <button type="button" className={chipClass} aria-label={`Organization: ${label}. Switch organization`}>
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
            {query.isFetching ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
            ) : (
              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[min(22rem,calc(100vw-1.5rem))] p-2">
          <p className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Switch organization
          </p>

          {query.isLoading ? (
            <div className="space-y-2 p-1">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : query.isError ? (
            <p className="px-2 py-3 text-xs text-destructive">
              Couldn't load your organizations.{" "}
              <button
                type="button"
                onClick={() => void query.refetch()}
                className="font-medium underline underline-offset-2"
              >
                Retry
              </button>
            </p>
          ) : (
            <div className="max-h-[min(24rem,60vh)] space-y-1.5 overflow-y-auto">
              {organizations.map((organization) => (
                <OrganizationCard
                  key={organization.id}
                  compact
                  organization={organization}
                  current={organization.id === currentId}
                  onSelect={() => choose(organization)}
                />
              ))}
            </div>
          )}

          <Link
            to="/settings/organization"
            onClick={() => setOpen(false)}
            className="mt-2 block border-t border-border px-2 pt-2 text-[11.5px] text-brand-muted transition hover:text-navy"
          >
            View organization details
          </Link>
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next && !switching) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to {pending?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll leave {label} and go to the {pending?.name} dashboard. Any unsaved
              changes on this page will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={switching}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={switching}
              onClick={(event) => {
                event.preventDefault();
                void confirmSwitch();
              }}
            >
              {switching ? "Switching…" : "Switch organization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
