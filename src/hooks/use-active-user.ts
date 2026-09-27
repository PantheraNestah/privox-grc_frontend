import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveUser, type AppUser, type UserRole } from "@/data/userStore";

/**
 * Returns the currently authenticated user.
 *
 * - If the user is logged in via the API (AuthContext), maps the API
 *   UserDto to the local AppUser shape for backward compatibility.
 * - Falls back to the prototype localStorage-based user when no API
 *   session exists (e.g. during the login page itself).
 */
export function useActiveUser(): AppUser {
  const auth = useAuth();

  const apiUser = useMemo<AppUser | null>(() => {
    if (!auth.isAuthenticated || !auth.user) return null;

    // Derive a role from the streamlined 5-permission SoD model:
    //   organization.manage        → full administrator
    //   *.approve                  → approver (maker-checker reviewer)
    //   *.contribute               → input user (drafter)
    let role: UserRole = "input_user";

    if (auth.permissions.includes("organization.manage")) {
      role = "admin";
    } else if (
      auth.permissions.includes("strategy.approve") ||
      auth.permissions.includes("orgnode.approve")
    ) {
      role = "approver";
    } else if (
      auth.permissions.includes("strategy.contribute") ||
      auth.permissions.includes("orgnode.contribute")
    ) {
      role = "input_user";
    }

    return {
      id: auth.user.id,
      name: auth.user.fullName,
      email: auth.user.email,
      role,
      title: auth.user.fullName,
      createdAt: "",
    };
  }, [auth.isAuthenticated, auth.user, auth.permissions]);

  // When the API user is available, prefer it.
  // Otherwise fall back to the prototype store.
  if (apiUser) return apiUser;
  return getActiveUser();
}
