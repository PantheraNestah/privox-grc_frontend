import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireModule } from "./RequireModule";

const state = vi.hoisted(() => ({
  hasModule: true,
  isLoading: false,
  orgEnabled: true,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    organization: { id: "org-1", code: "ORG", name: "Org" },
    hasModule: () => state.hasModule,
  }),
}));

vi.mock("@/hooks/use-organization-modules", () => ({
  useModuleAccess: () => ({
    isLoading: state.isLoading,
    isModuleEnabled: () => state.orgEnabled,
  }),
}));

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/governance/risk-strategy"]}>
      <Routes>
        <Route element={<RequireModule code="GOVERNANCE" staticId="governance" label="Governance" />}>
          <Route path="/governance/risk-strategy" element={<div>Protected body</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireModule", () => {
  beforeEach(() => {
    state.hasModule = true;
    state.isLoading = false;
    state.orgEnabled = true;
  });

  it("renders child routes when the org subscribes and the user is allocated", () => {
    renderGuard();
    expect(screen.getByText("Protected body")).toBeInTheDocument();
  });

  it("blocks the child route when the user is not allocated", () => {
    state.hasModule = false;
    renderGuard();
    expect(screen.queryByText("Protected body")).not.toBeInTheDocument();
    expect(screen.getByText("Governance module not allocated")).toBeInTheDocument();
  });

  it("blocks the child route when the organization does not subscribe", () => {
    state.orgEnabled = false;
    renderGuard();
    expect(screen.queryByText("Protected body")).not.toBeInTheDocument();
    expect(screen.getByText("Module not enabled")).toBeInTheDocument();
  });

  it("shows a pending state without mounting children while module access resolves", () => {
    state.isLoading = true;
    renderGuard();
    expect(screen.queryByText("Protected body")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Checking module access/);
  });
});
