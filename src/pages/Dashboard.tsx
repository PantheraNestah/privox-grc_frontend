import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModuleCard } from "@/components/grc/ModuleCard";
import { QuickActionsPanel } from "@/components/grc/QuickActionsPanel";
import { InstallAppButton } from "@/components/grc/InstallAppButton";
import { PageHeader, TENANT_HOME } from "@/components/grc/common/PageHeader";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/grc/common/states";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveUser } from "@/hooks/use-active-user";
import { useOrganizationModules } from "@/hooks/use-organization-modules";
import { toEnabledModules } from "@/lib/organizationModules";
import type { ModuleDef } from "@/data/modules";
import type { QuickAction } from "@/data/quickActions";

const greetingFor = (h: number) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");

/** Static module id → route for modules that have a page today. */
const MODULE_ROUTES: Record<string, string> = {
  governance: "/governance",
  settings: "/settings/users",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { organization, permissions, hasModule } = useAuth();
  const activeUser = useActiveUser();
  const modules = useOrganizationModules(organization?.id);
  const [openModule, setOpenModule] = useState<ModuleDef | null>(null);
  const [openAction, setOpenAction] = useState<QuickAction | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Layer 1: only show modules allocated to this user (org admins bypass).
  // USER_MANAGEMENT has no non-admin UI (its pages are admin-gated), so it is
  // hidden from users who cannot administer users.
  const canManageUsers = permissions.includes("organization.manage");
  const enabledModules = useMemo(
    () =>
      toEnabledModules(
        (modules.data ?? []).filter(
          (row) =>
            row.enabled &&
            hasModule(row.code) &&
            (canManageUsers || row.code.toUpperCase() !== "USER_MANAGEMENT"),
        ),
      ),
    [modules.data, hasModule, canManageUsers],
  );
  const firstName = activeUser?.name?.split(" ")[0] ?? "User";
  const greeting = useMemo(() => greetingFor(now.getHours()), [now]);
  const dateStr = useMemo(
    () => now.toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    [now],
  );
  const linkedModule = openAction?.moduleId ? enabledModules.find((m) => m.id === openAction.moduleId) : null;

  const handleModuleClick = (m: ModuleDef) => {
    const route = MODULE_ROUTES[m.id];
    if (route) navigate(route);
    else setOpenModule(m);
  };

  const modulesError = !organization?.id
    ? "No organization is linked to the signed-in user."
    : modules.isError
      ? "Unable to load enabled modules for your organization."
      : null;

  return (
    <>
      <Helmet>
        <title>Dashboard · Rsolve GRC Platform</title>
        <meta
          name="description"
          content="Unified Governance, Risk and Compliance workspace — modules, notifications and customisable quick actions."
        />
        <link rel="canonical" href="/dashboard" />
      </Helmet>

      <PageHeader
        home={TENANT_HOME}
        crumbs={[{ label: "Dashboard" }]}
        title={`${greeting}, ${firstName}`}
        description={
          <>
            Here's your GRC platform overview for today.{" "}
            <span className="text-xs text-brand-accent">{dateStr}</span>
          </>
        }
        actions={<InstallAppButton />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-navy-deep">Modules</h2>
            <span className="text-xs text-muted-foreground">Select a module to get started</span>
          </div>

          {modulesError ? (
            <ErrorState title="Couldn't load modules" message={modulesError} />
          ) : modules.isLoading ? (
            <CardGridSkeleton count={6} label="Loading enabled modules…" />
          ) : enabledModules.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No modules enabled"
              description="No modules are enabled for your organization."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {enabledModules.map((m) => (
                <ModuleCard key={m.id} module={m} onClick={() => handleModuleClick(m)} />
              ))}
            </div>
          )}
        </section>

        <QuickActionsPanel modules={enabledModules} onActionClick={setOpenAction} />
      </div>

      <Dialog open={!!openModule} onOpenChange={(o) => !o && setOpenModule(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[420px]">
          {openModule && (
            <>
              <span
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: `hsl(${openModule.color} / 0.12)` }}
              >
                <openModule.icon
                  className="h-7 w-7"
                  style={{ color: `hsl(${openModule.color})` }}
                  strokeWidth={1.6}
                />
              </span>
              <DialogHeader className="items-center text-center sm:text-center">
                <DialogTitle>{openModule.name}</DialogTitle>
                <DialogDescription>
                  {openModule.desc}
                  <br />
                  <br />
                  Full functionality will be available in the next release.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-center">
                <Button variant="brand" onClick={() => setOpenModule(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!openAction} onOpenChange={(o) => !o && setOpenAction(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[400px]">
          {openAction && (
            <>
              <DialogHeader className="items-center text-center sm:text-center">
                <DialogTitle>{openAction.title}</DialogTitle>
                <DialogDescription>
                  {openAction.description || "Quick action triggered."}
                  {linkedModule && (
                    <>
                      <br />
                      <br />
                      Routing to <strong className="text-navy-dark">{linkedModule.name}</strong>…
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-center">
                <Button variant="brand" onClick={() => setOpenAction(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Dashboard;
