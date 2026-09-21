import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import PlatformModules from "./PlatformModules";
import * as platformAdmin from "@/lib/platformAdmin";
import { toast } from "sonner";

const permissions = vi.hoisted(() => ({ value: ["platform.module.assign"] as string[] }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/contexts/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({ permissions: permissions.value }),
}));

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
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
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
    permissions.value = ["platform.module.assign"];
    vi.spyOn(platformAdmin, "listPlatformModules").mockResolvedValue(modules);
    vi.spyOn(platformAdmin, "createPlatformModule").mockResolvedValue({
      id: "mod-3",
      code: "THIRD_PARTY_RISK",
      name: "Third Party Risk",
      description: null,
      active: true,
      sortOrder: 80,
      createdAt: "2026-09-22T10:00:00Z",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("renders the module catalogue with codes and active state", async () => {
    renderPage();

    expect(await screen.findByText("Governance")).toBeInTheDocument();
    expect(screen.getByText("GOVERNANCE")).toBeInTheDocument();
    expect(screen.getByText("Resilience")).toBeInTheDocument();

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("hides the New module action without a module-management permission", async () => {
    permissions.value = ["platform.organization.view"];
    renderPage();

    await screen.findByText("Governance");
    expect(screen.queryByRole("button", { name: "New module" })).not.toBeInTheDocument();
  });

  it("creates a module from the catalogue and suggests the next sort order", async () => {
    renderPage();
    await screen.findByText("Governance");

    fireEvent.click(screen.getByRole("button", { name: "New module" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Third Party Risk" },
    });

    // Code is derived from the name until the user edits it.
    expect(screen.getByLabelText("Code")).toHaveValue("THIRD_PARTY_RISK");
    expect(screen.getByLabelText("Sort order")).toHaveValue(80);

    fireEvent.click(screen.getByRole("button", { name: "Create module" }));

    await waitFor(() =>
      expect(platformAdmin.createPlatformModule).toHaveBeenCalledWith({
        name: "Third Party Risk",
        code: "THIRD_PARTY_RISK",
        description: null,
        sortOrder: 80,
        active: true,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
