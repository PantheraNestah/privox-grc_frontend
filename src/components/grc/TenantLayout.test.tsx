import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TenantLayout } from "./TenantLayout";
import { TooltipProvider } from "@/components/ui/tooltip";

const modules = vi.hoisted(() => ({ disabled: new Set<string>() }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { fullName: "Jane Doe", email: "jane@org.co" },
    organization: { id: "org-1", code: "ORG", name: "Acme Insurance" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-organization-modules", () => ({
  useModuleAccess: () => ({ isLoading: false, isModuleEnabled: (id: string) => !modules.disabled.has(id) }),
}));

function renderLayout() {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<TenantLayout />}>
            <Route path="/dashboard" element={<div>Dashboard body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );
}

describe("TenantLayout navigation", () => {
  beforeEach(() => {
    localStorage.clear();
    modules.disabled = new Set();
  });

  it("renders the workspace nav with governance and settings links", () => {
    renderLayout();

    expect(screen.getByText("Dashboard body")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Risk Governance" })).toHaveAttribute(
      "href",
      "/governance/risk-governance",
    );
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("href", "/settings/users");
  });

  it("hides sections whose module is not enabled for the organization", () => {
    modules.disabled = new Set(["governance", "settings"]);
    renderLayout();

    expect(screen.queryByRole("link", { name: "Risk Governance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Modules" })).toBeInTheDocument();
  });

  it("shows the organization in the top bar and starts with the sidebar expanded", () => {
    renderLayout();

    expect(screen.getByTitle("View organization details")).toHaveTextContent("Acme Insurance");
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });
});
