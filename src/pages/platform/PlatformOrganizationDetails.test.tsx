import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PlatformOrganizationDetails from "./PlatformOrganizationDetails";
import * as platformAdmin from "@/lib/platformAdmin";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/contexts/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({
    permissions: [
      "platform.organization.view",
      "platform.organization.approve",
      "platform.organization.suspend",
      "platform.organization.deactivate",
      "platform.module.assign",
    ],
  }),
}));

const organization = {
  id: "org-1",
  name: "G & Nestahs Co.",
  code: "GNC",
  slug: "g-nestahs-co",
  planTier: "STANDARD",
  countryCode: "KE",
  status: "ACTIVE",
  validatedByUserId: null,
  validatedAt: null,
  validationNotes: null,
  createdAt: "2026-08-24T08:46:23Z",
  updatedAt: "2026-08-25T08:32:06Z",
  deactivatedAt: null,
};

const assignments = [
  {
    id: "assign-1",
    moduleId: "mod-1",
    code: "GOVERNANCE",
    name: "Governance",
    description: "Governance structures",
    sortOrder: 30,
    enabled: true,
    enabledAt: "2026-08-25T08:00:00Z",
    disabledAt: null,
  },
];

function renderDetails() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter initialEntries={["/platform/organizations/org-1"]}>
          <Routes>
            <Route path="/platform/organizations/:orgId" element={<PlatformOrganizationDetails />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

describe("PlatformOrganizationDetails", () => {
  beforeEach(() => {
    vi.spyOn(platformAdmin, "getPlatformOrganization").mockResolvedValue(organization);
    vi.spyOn(platformAdmin, "listPlatformOrganizationModules").mockResolvedValue(assignments);
    vi.spyOn(platformAdmin, "suspendPlatformOrganization").mockResolvedValue(organization);
    vi.spyOn(platformAdmin, "reactivatePlatformOrganization").mockResolvedValue(organization);
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders the profile and module assignments", async () => {
    renderDetails();

    expect(await screen.findByRole("heading", { name: "G & Nestahs Co." })).toBeInTheDocument();
    expect(screen.getByText("Governance")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });

  it("suspends an active organization after confirmation", async () => {
    renderDetails();
    await screen.findByRole("heading", { name: "G & Nestahs Co." });

    fireEvent.click(screen.getByRole("button", { name: /Suspend/ }));

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Suspend" }));

    await waitFor(() =>
      expect(platformAdmin.suspendPlatformOrganization).toHaveBeenCalledWith("org-1"),
    );
  });

  it("disables an enabled module via the toggle", async () => {
    const disable = vi
      .spyOn(platformAdmin, "disablePlatformOrganizationModule")
      .mockResolvedValue({ ...assignments[0], enabled: false });
    renderDetails();
    await screen.findByText("Governance");

    fireEvent.click(screen.getByRole("switch", { name: "Toggle Governance" }));

    await waitFor(() =>
      expect(disable).toHaveBeenCalledWith("org-1", "mod-1"),
    );
  });
});
