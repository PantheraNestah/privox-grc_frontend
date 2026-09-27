import { Outlet } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Route guard for the User & Access Group Management section.
 *
 * All member/group mutation endpoints require `organization.manage`, so
 * non-admins are blocked at the routing layer as well as inside
 * `UserManagement`, before any admin-only UI (or its queries) can mount.
 */
export function RequireOrgAdmin() {
  const { permissions } = useAuth();

  if (!permissions.includes("organization.manage")) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          User and Access Group Management is restricted to Organization Administrators.
        </AlertDescription>
      </Alert>
    );
  }

  return <Outlet />;
}
