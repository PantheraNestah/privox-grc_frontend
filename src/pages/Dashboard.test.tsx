import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./Dashboard";
import * as organizationModules from "@/lib/organizationModules";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const auth = vi.hoisted(() => ({ permissions: ["organization.manage"] as string[] }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    organization: { id: "org-1", code: "ORG", name: "Org" },
    permissions: auth.permissions,
    hasModule: () => true,
  }),
}));

vi.mock("@/hooks/use-active-user", () => ({
  useActiveUser: () => ({ id: "u1", name: "Jane Doe", email: "jane@org.com", role: "admin" }),
}));

const row = (code: string, name: string, enabled: boolean, sortOrder: number) => ({
  id: code,
  moduleId: code,
  code,
  name,
  sortOrder,
  enabled,
  enabledAt: null,
  disabledAt: null,
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/governance" element={<div>Governance overview</div>} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    auth.permissions = ["organization.manage"];
    vi.spyOn(organizationModules, "fetchOrganizationModules").mockResolvedValue([
      row("GOVERNANCE", "Governance", true, 10),
      row("USER_MANAGEMENT", "User Management", true, 20),
      row("RISK_MANAGEMENT", "Risk Management", false, 30),
    ]);
  });

  afterEach(() => vi.restoreAllMocks());

  it("greets the user and shows only the modules enabled for the organization", async () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Good (morning|afternoon|evening), Jane/);
    expect(await screen.findByText("Governance Management")).toBeInTheDocument();
    expect(screen.getByText("User Management")).toBeInTheDocument();
    expect(screen.queryByText("Risk Management")).not.toBeInTheDocument();
  });

  it("opens the module page when a routed module is selected", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Governance Management/ }));

    expect(await screen.findByText("Governance overview")).toBeInTheDocument();
  });

  it("shows the default quick actions", async () => {
    renderPage();
    await screen.findByText("Governance Management");

    expect(screen.getByText("Quick actions")).toBeInTheDocument();
  });

  it("hides user management from non-admins even when the module is allocated", async () => {
    auth.permissions = [];
    renderPage();

    expect(await screen.findByText("Governance Management")).toBeInTheDocument();
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
  });

  it("shows an empty state when no module is enabled", async () => {
    vi.spyOn(organizationModules, "fetchOrganizationModules").mockResolvedValue([
      row("GOVERNANCE", "Governance", false, 10),
    ]);
    renderPage();

    expect(await screen.findByText("No modules are enabled for your organization.")).toBeInTheDocument();
  });

  it("shows an error when the module lookup fails", async () => {
    vi.spyOn(organizationModules, "fetchOrganizationModules").mockRejectedValue(new Error("nope"));
    renderPage();

    expect(await screen.findByText("Unable to load enabled modules for your organization.")).toBeInTheDocument();
  });
});
