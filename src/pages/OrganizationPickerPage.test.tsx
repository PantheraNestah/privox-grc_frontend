import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AxiosError, type AxiosResponse } from "axios";
import OrganizationPickerPage from "./OrganizationPickerPage";
import type { OrganizationSelectionState } from "@/contexts/AuthContext";

const mocks = vi.hoisted(() => ({
  selection: null as OrganizationSelectionState | null,
  selectOrganization: vi.fn(),
  cancelOrganizationSelection: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    organizationSelection: mocks.selection,
    selectOrganization: mocks.selectOrganization,
    cancelOrganizationSelection: mocks.cancelOrganizationSelection,
  }),
}));

const selection: OrganizationSelectionState = {
  selectionToken: "selection-1",
  rememberMe: false,
  expiresAt: null,
  organizations: [
    {
      id: "org-1",
      code: "SIC",
      name: "Savanna Insurance",
      primary: true,
      lastUsedAt: "2026-10-20T10:00:00Z",
      groups: ["SIC_ORG_ADMIN"],
      modules: ["GOVERNANCE"],
    },
    {
      id: "org-2",
      code: "GNC",
      name: "GNC Holdings",
      primary: false,
      lastUsedAt: "2026-10-26T10:00:00Z",
      groups: ["GNC_ORG_MEMBER"],
      modules: ["RISK_MANAGEMENT"],
    },
  ],
};

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/choose-organization"]}>
        <Routes>
          <Route path="/" element={<div>Credentials form</div>} />
          <Route path="/choose-organization" element={<OrganizationPickerPage />} />
          <Route path="/dashboard" element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

const httpError = (status: number) =>
  new AxiosError("failed", String(status), undefined, undefined, { status } as AxiosResponse);

describe("OrganizationPickerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.selection = selection;
    mocks.selectOrganization.mockResolvedValue(undefined);
  });

  it("renders one readable card per organization and marks the most recent", () => {
    renderPage();

    expect(screen.getByText("Choose an organization")).toBeInTheDocument();
    expect(screen.getByText("Savanna Insurance")).toBeInTheDocument();
    expect(screen.getByText("GNC Holdings")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Organization Admin")).toBeInTheDocument();
    expect(screen.getAllByText(/^Last used /)).toHaveLength(2);
    expect(document.body.textContent).not.toContain("GNC_ORG_MEMBER");
  });

  it("selects the non-primary organization and continues to the dashboard", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /GNC Holdings/ }));

    await waitFor(() => expect(mocks.selectOrganization).toHaveBeenCalledWith("org-2"));
    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
  });

  it("cancels back to the credentials form", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /sign in as someone else/i }));

    expect(mocks.cancelOrganizationSelection).toHaveBeenCalled();
    expect(screen.getByText("Credentials form")).toBeInTheDocument();
  });

  it("redirects to the login form when no selection is in progress", () => {
    mocks.selection = null;
    renderPage();

    expect(screen.getByText("Credentials form")).toBeInTheDocument();
  });

  it("shows an inline 403 message and leaves the user on the picker", async () => {
    mocks.selectOrganization.mockRejectedValue(httpError(403));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /GNC Holdings/ }));

    expect(
      await screen.findByText("You no longer have access to this organization."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dashboard home")).not.toBeInTheDocument();
  });

  it("returns to credentials on an expired selection token (401)", async () => {
    mocks.selectOrganization.mockRejectedValue(httpError(401));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /GNC Holdings/ }));

    await waitFor(() => expect(mocks.selectOrganization).toHaveBeenCalled());
    expect(screen.queryByText(/couldn't open that organization/i)).not.toBeInTheDocument();
  });

  it("uses the remembered organization for the welcome-back subtitle only", () => {
    localStorage.setItem(
      "grc_last_organization",
      JSON.stringify({ id: "org-1", code: "SIC", name: "Savanna Insurance" }),
    );
    renderPage();

    expect(screen.getByText(/you last used Savanna Insurance/i)).toBeInTheDocument();
    // It is a hint, not an auto-selection: both cards remain.
    expect(screen.getAllByRole("button", { name: /Holdings|Insurance/ })).toHaveLength(2);
  });
});
