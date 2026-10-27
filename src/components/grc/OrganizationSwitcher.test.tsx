import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError, type AxiosResponse } from "axios";
import { OrganizationSwitcher } from "./OrganizationSwitcher";
import type { MyOrganizationsResponse } from "@/lib/auth-types";

const mocks = vi.hoisted(() => ({
  switchOrganization: vi.fn(),
  refetch: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  query: {
    data: undefined as MyOrganizationsResponse | undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ switchOrganization: mocks.switchOrganization }),
}));

vi.mock("@/hooks/use-my-organizations", () => ({
  useMyOrganizations: () => ({ ...mocks.query, refetch: mocks.refetch }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const current = { id: "org-1", code: "SIC", name: "Savanna Insurance" };

const twoOrganizations: MyOrganizationsResponse = {
  currentOrganizationId: "org-1",
  organizations: [
    { id: "org-1", code: "SIC", name: "Savanna Insurance", primary: true, groups: ["SIC_ORG_ADMIN"] },
    { id: "org-2", code: "GNC", name: "GNC Holdings", primary: false, groups: ["GNC_ORG_MEMBER"] },
  ],
};

function renderSwitcher() {
  return render(
    <MemoryRouter initialEntries={["/settings/organization"]}>
      <Routes>
        <Route
          path="/settings/organization"
          element={<OrganizationSwitcher currentOrganization={current} />}
        />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const httpError = (status: number) =>
  new AxiosError("failed", String(status), undefined, undefined, { status } as AxiosResponse);

describe("OrganizationSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.switchOrganization.mockResolvedValue(undefined);
    mocks.query = {
      data: twoOrganizations,
      isLoading: false,
      isError: false,
      isFetching: false,
    };
  });

  it("keeps a plain organization link for single-organization users", () => {
    mocks.query = {
      ...mocks.query,
      data: {
        currentOrganizationId: "org-1",
        organizations: [twoOrganizations.organizations[0]],
      },
    };
    renderSwitcher();

    expect(screen.getByTitle("View organization details")).toHaveTextContent("Savanna Insurance");
    expect(
      screen.queryByRole("button", { name: /switch organization/i }),
    ).not.toBeInTheDocument();
  });

  it("lists the user's organizations and shows the current one", () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole("button", { name: /switch organization/i }));

    expect(mocks.refetch).toHaveBeenCalled();
    expect(screen.getByText("GNC Holdings")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("Organization Admin")).toBeInTheDocument();
    expect(screen.getByText("Organization Member")).toBeInTheDocument();
    // Raw group codes never reach the menu.
    expect(document.body.textContent).not.toContain("GNC_ORG_MEMBER");
  });

  it("confirms, switches and lands on the dashboard", async () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole("button", { name: /switch organization/i }));
    fireEvent.click(screen.getByRole("button", { name: /GNC Holdings/ }));

    expect(await screen.findByText("Switch to GNC Holdings?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch organization" }));

    await waitFor(() => expect(mocks.switchOrganization).toHaveBeenCalledWith("org-2"));
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Switched to GNC Holdings");
  });

  it("keeps the current session on 403 and refreshes the list", async () => {
    mocks.switchOrganization.mockRejectedValue(httpError(403));
    renderSwitcher();

    fireEvent.click(screen.getByRole("button", { name: /switch organization/i }));
    fireEvent.click(screen.getByRole("button", { name: /GNC Holdings/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Switch organization" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "You no longer have access to that organization.",
      ),
    );
    expect(mocks.refetch).toHaveBeenCalled();
  });
});
