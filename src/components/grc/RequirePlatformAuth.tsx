import { Navigate, Outlet } from "react-router-dom";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";

export function RequirePlatformAuth() {
  const { isAuthenticated, isLoading } = usePlatformAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/platform/login" replace />;

  return <Outlet />;
}
