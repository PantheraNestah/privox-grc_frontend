import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { AxiosError, type AxiosResponse } from "axios";
import OrganizationDetails from "./OrganizationDetails";
import * as organization from "@/lib/organization";
import * as orgNodes from "@/lib/orgNodes";
import type { OrgNodeResponse } from "@/lib/governance-types";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ organization: { id: "org-1", code: "GNC", name: "G & Nestahs Co." } }),
}));

// React Flow needs real layout; the map is exercised through this stand-in.
vi.mock("@/components/grc/OrgTreeGraph", () => ({
  flatOrgNodesToView: (rows: unknown[]) => rows,
  OrgTreeGraph: ({ roots }: { roots: unknown[] }) => <div data-testid="graph">{roots.length} roots</div>,
}));

const details = {
  id: "org-1",
  code: "GNC",
  name: "G & Nestahs Co.",
  status: "ACTIVE",
  countryCode: "KE",
  createdAt: "2026-08-24T08:46:23Z",
  updatedAt: "2026-08-25T08:32:06Z",
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter>
          <OrganizationDetails />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

describe("OrganizationDetails", () => {
  beforeEach(() => {
    vi.spyOn(organization, "fetchOrganization").mockResolvedValue(details);
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders the profile and the organization map", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodes").mockResolvedValue([
      { id: "n1", name: "Group", type: "GROUP", parentId: null } as unknown as OrgNodeResponse,
    ]);
    renderPage();

    expect(await screen.findByText("KE")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("G & Nestahs Co.");
    expect(screen.getByText("GNC")).toBeInTheDocument();
    expect(await screen.findByTestId("graph")).toHaveTextContent("1 roots");
    expect(organization.fetchOrganization).toHaveBeenCalledWith("org-1");
  });

  it("hides the map when the tree endpoint is unavailable", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodes").mockRejectedValue(
      new AxiosError("forbidden", "403", undefined, undefined, { status: 403 } as AxiosResponse),
    );
    renderPage();

    expect(await screen.findByText("KE")).toBeInTheDocument();
    expect(screen.queryByText("Organization map")).not.toBeInTheDocument();
  });

  it("shows an error when the organization cannot be loaded", async () => {
    vi.spyOn(organization, "fetchOrganization").mockRejectedValue(new Error("Organization exploded"));
    vi.spyOn(orgNodes, "fetchOrgNodes").mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Organization exploded")).toBeInTheDocument();
  });
});
