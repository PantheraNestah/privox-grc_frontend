import { Navigate, Outlet } from "react-router-dom";
import { usePlatformAuth } from "@/contexts/PlatformAuthContext";
import { AuthLoading } from "@/components/grc/AuthLoading";

export function RequirePlatformAuth() {
  const { isAuthenticated, isLoading } = usePlatformAuth();

  if (isLoading) return <AuthLoading />;
  if (!isAuthenticated) return <Navigate to="/platform/login" replace />;

  return <Outlet />;
}
