import { Outlet } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/use-organization-modules";

interface RequireModuleProps {
  /** User-allocation module code checked by `hasModule`, e.g. "GOVERNANCE". */
  code: string;
  /** Static catalogue id used for the organization subscription map, e.g. "governance". */
  staticId: string;
  /** Human-readable module label used in the denial copy. */
  label: string;
}

/**
 * Route-level entitlement guard for a module-backed section.
 *
 * Mounts its child routes only when BOTH layers allow access:
 *  1. the organization subscribes to the module (`isModuleEnabled`), and
 *  2. the signed-in user is allocated the module (`hasModule`).
 *
 * Because children never mount when access is denied, feature pages cannot
 * issue their API queries from a deep link. While the subscription lookup is
 * still pending we render a neutral pending state rather than denying, since
 * `isModuleEnabled` defaults unknown modules to enabled to avoid hiding the
 * app during a slow/failed request.
 */
export function RequireModule({ code, staticId, label }: RequireModuleProps) {
  const { organization, hasModule } = useAuth();
  const { isLoading, isModuleEnabled } = useModuleAccess(organization?.id);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking module access…
      </div>
    );
  }

  if (!isModuleEnabled(staticId)) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Module not enabled</AlertTitle>
        <AlertDescription>
          {label} is not enabled for your organization. Contact your platform administrator.
        </AlertDescription>
      </Alert>
    );
  }

  if (!hasModule(code)) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>{label} module not allocated</AlertTitle>
        <AlertDescription>
          You do not have access to the {label} module. Please contact your organization administrator to
          allocate this module to your account.
        </AlertDescription>
      </Alert>
    );
  }

  return <Outlet />;
}
