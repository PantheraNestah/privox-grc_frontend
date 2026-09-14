import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import PlatformTemplates from "./PlatformTemplates";
import * as orgNodeTemplates from "@/lib/orgNodeTemplates";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/contexts/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({ permissions: ["platform.orgnode.manage"] }),
}));

const templates = [
  {
    id: "template-1",
    name: "Kenya Enterprise Standard Structure",
    description: "A reusable organizational structure.",
    rootOrgNodeId: "root-1",
    createdByUserId: "user-1",
    createdAt: "2026-09-04T15:19:34Z",
  },
];

const preview = {
  templateId: "template-1",
  name: "Kenya Enterprise Standard Structure",
  description: "A reusable organizational structure.",
  rootNode: {
    id: "root-1",
    name: "Kenya Enterprise Group",
    type: "GROUP" as const,
    description: null,
    children: [
      { id: "child-1", name: "Finance", type: "DEPARTMENT" as const, description: null, children: [] },
    ],
  },
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter>
          <PlatformTemplates />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

describe("PlatformTemplates", () => {
  beforeEach(() => {
    vi.spyOn(orgNodeTemplates, "fetchOrgNodeTemplates").mockResolvedValue(templates);
    vi.spyOn(orgNodeTemplates, "fetchOrgNodeTemplatePreview").mockResolvedValue(preview);
  });

  afterEach(() => vi.restoreAllMocks());

  it("lists the template catalogue via the platform client", async () => {
    renderPage();

    expect(await screen.findByText("Kenya Enterprise Standard Structure")).toBeInTheDocument();
    expect(orgNodeTemplates.fetchOrgNodeTemplates).toHaveBeenCalledWith("platform");
  });

  it("opens a nested preview dialog for a template", async () => {
    renderPage();
    await screen.findByText("Kenya Enterprise Standard Structure");

    fireEvent.click(screen.getByRole("button", { name: /Preview tree/ }));

    expect(await screen.findByText("Kenya Enterprise Group")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    await waitFor(() =>
      expect(orgNodeTemplates.fetchOrgNodeTemplatePreview).toHaveBeenCalledWith("template-1", "platform"),
    );
  });
});
