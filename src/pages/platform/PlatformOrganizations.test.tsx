import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import PlatformOrganizations from "./PlatformOrganizations";
import * as platformAdmin from "@/lib/platformAdmin";
import type { PlatformOrganization } from "@/lib/platformAdmin";

const organizations: PlatformOrganization[] = [
  {
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
  },
  {
    id: "org-2",
    name: "Savanna Insurance Co.",
    code: "SIC",
    slug: "savanna-insurance",
    planTier: null,
    countryCode: "KE",
    status: "PENDING_VALIDATION",
    validatedByUserId: null,
    validatedAt: null,
    validationNotes: null,
    createdAt: "2026-07-21T09:01:25Z",
    updatedAt: "2026-08-05T18:43:03Z",
    deactivatedAt: null,
  },
];

vi.mock("@/contexts/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({ permissions: ["platform.organization.create"] }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter>
          <PlatformOrganizations />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

describe("PlatformOrganizations", () => {
  beforeEach(() => {
    vi.spyOn(platformAdmin, "listPlatformOrganizations").mockResolvedValue(organizations);
  });

  afterEach(() => vi.restoreAllMocks());

  it("lists every organization returned by the platform", async () => {
    renderPage();

    expect(await screen.findByText("G & Nestahs Co.")).toBeInTheDocument();
    expect(screen.getByText("Savanna Insurance Co.")).toBeInTheDocument();
    expect(screen.getByText("g-nestahs-co")).toBeInTheDocument();
    expect(platformAdmin.listPlatformOrganizations).toHaveBeenCalledWith({});
  });

  it("refetches with a status filter when a filter chip is selected", async () => {
    renderPage();
    await screen.findByText("G & Nestahs Co.");

    fireEvent.click(screen.getByRole("button", { name: "Pending validation" }));

    await waitFor(() =>
      expect(platformAdmin.listPlatformOrganizations).toHaveBeenCalledWith({
        status: "PENDING_VALIDATION",
      }),
    );
  });

  it("filters the rendered rows by search term", async () => {
    renderPage();
    await screen.findByText("G & Nestahs Co.");

    fireEvent.change(screen.getByLabelText("Search organizations"), {
      target: { value: "savanna" },
    });

    await waitFor(() => expect(screen.queryByText("G & Nestahs Co.")).not.toBeInTheDocument());
    expect(screen.getByText("Savanna Insurance Co.")).toBeInTheDocument();
  });
});
