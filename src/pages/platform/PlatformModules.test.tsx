import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import PlatformModules from "./PlatformModules";
import * as platformAdmin from "@/lib/platformAdmin";

const modules = [
  {
    id: "mod-1",
    code: "GOVERNANCE",
    name: "Governance",
    description: "Governance structures and organizational oversight.",
    active: true,
    sortOrder: 30,
    createdAt: "2026-07-20T08:01:15Z",
  },
  {
    id: "mod-2",
    code: "RESILIENCE",
    name: "Resilience",
    description: "Business continuity and operational resilience.",
    active: false,
    sortOrder: 70,
    createdAt: "2026-07-20T08:01:15Z",
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter>
          <PlatformModules />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

describe("PlatformModules", () => {
  beforeEach(() => {
    vi.spyOn(platformAdmin, "listPlatformModules").mockResolvedValue(modules);
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders the module catalogue with codes and active state", async () => {
    renderPage();

    expect(await screen.findByText("Governance")).toBeInTheDocument();
    expect(screen.getByText("GOVERNANCE")).toBeInTheDocument();
    expect(screen.getByText("Resilience")).toBeInTheDocument();

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
});
