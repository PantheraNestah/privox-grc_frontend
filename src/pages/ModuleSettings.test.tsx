import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import ModuleSettings from "./ModuleSettings";
import * as organizationModules from "@/lib/organizationModules";

const auth = vi.hoisted(() => ({ organization: { id: "org-1", code: "ORG", name: "Org" } as { id: string } | null }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ organization: auth.organization }),
}));

const rows: organizationModules.OrganizationModuleStatus[] = [
  { id: "m1", moduleId: "1", code: "GOVERNANCE", name: "Governance", sortOrder: 10, enabled: true, enabledAt: "2026-08-01T00:00:00Z", disabledAt: null },
  { id: "m2", moduleId: "2", code: "RESILIENCE", name: "Resilience", sortOrder: 20, enabled: false, enabledAt: null, disabledAt: "2026-08-10T00:00:00Z" },
];

function renderPage(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter>
          <ModuleSettings />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

describe("ModuleSettings", () => {
  beforeEach(() => {
    auth.organization = { id: "org-1" };
    vi.spyOn(organizationModules, "fetchOrganizationModules").mockResolvedValue(rows);
  });

  afterEach(() => vi.restoreAllMocks());

  it("lists every module with its enabled state", async () => {
    renderPage();

    expect(await screen.findByText("Governance Management")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 enabled/)).toBeInTheDocument();
    expect(organizationModules.fetchOrganizationModules).toHaveBeenCalledWith("org-1");
  });

  it("reuses the cached subscription list when the page is opened again", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const first = renderPage(queryClient);
    await screen.findByText("Governance Management");
    first.unmount();

    renderPage(queryClient);
    expect(await screen.findByText("Governance Management")).toBeInTheDocument();
    expect(organizationModules.fetchOrganizationModules).toHaveBeenCalledTimes(1);
  });

  it("shows the API error", async () => {
    vi.spyOn(organizationModules, "fetchOrganizationModules").mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByText("boom")).toBeInTheDocument();
  });

  it("explains when the session has no organization", () => {
    auth.organization = null;
    renderPage();

    expect(screen.getByText("No active organization was found for this session.")).toBeInTheDocument();
    expect(organizationModules.fetchOrganizationModules).not.toHaveBeenCalled();
  });
});
