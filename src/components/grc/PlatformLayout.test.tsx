import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PlatformLayout } from "./PlatformLayout";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/contexts/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({
    user: { fullName: "Gift Superadmin", email: "gift@privox.io" },
    permissions: ["platform.organization.view"],
    logout: vi.fn(),
  }),
}));

function renderLayout() {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={["/platform/dashboard"]}>
        <Routes>
          <Route path="/platform" element={<PlatformLayout />}>
            <Route path="dashboard" element={<div>Dashboard body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  );
}

describe("PlatformLayout sidebar", () => {
  beforeEach(() => localStorage.clear());

  it("starts expanded with labelled links on a wide viewport", () => {
    renderLayout();

    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Organizations" })).toHaveTextContent("Organizations");
  });

  it("collapses to an icon rail and remembers the choice", () => {
    const { unmount } = renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Organizations" })).not.toHaveTextContent("Organizations");
    expect(localStorage.getItem("platform.sidebar.collapsed")).toBe("true");

    unmount();
    renderLayout();
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});
