import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RegisterTemplateDialog } from "./RegisterTemplateDialog";
import * as orgNodeTemplates from "@/lib/orgNodeTemplates";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function renderDialog(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RegisterTemplateDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return onOpenChange;
}

describe("RegisterTemplateDialog", () => {
  beforeEach(() => {
    vi.spyOn(orgNodeTemplates, "registerOrgNodeTemplate").mockResolvedValue({
      id: "template-new",
      name: "Insurance Org",
      description: null,
      rootOrgNodeId: "root-new",
      createdByUserId: "user-1",
      createdAt: "2026-09-11T00:00:00Z",
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("registers the example tree through the platform client", async () => {
    const onOpenChange = renderDialog();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Insurance Org" } });
    fireEvent.click(screen.getByRole("button", { name: "Register template" }));

    await waitFor(() =>
      expect(orgNodeTemplates.registerOrgNodeTemplate).toHaveBeenCalledWith(
        {
          name: "Insurance Org",
          description: null,
          rootNode: expect.objectContaining({ name: "Group", type: "GROUP" }),
        },
        "platform",
      ),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("rejects invalid JSON before calling the API", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Broken" } });
    fireEvent.change(screen.getByLabelText("Root node (JSON)"), { target: { value: "{ not json" } });
    fireEvent.click(screen.getByRole("button", { name: "Register template" }));

    expect(await screen.findByText("Root node is not valid JSON")).toBeInTheDocument();
    expect(orgNodeTemplates.registerOrgNodeTemplate).not.toHaveBeenCalled();
  });
});
