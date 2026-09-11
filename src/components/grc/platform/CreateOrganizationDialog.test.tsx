import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";
import * as platformAdmin from "@/lib/platformAdmin";
import type { PlatformOrganization } from "@/lib/platformAdmin";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const created: PlatformOrganization = {
  id: "org-new",
  name: "G & Nestahs Co.",
  code: "GNC",
  slug: "g-nestahs-co",
  planTier: "STANDARD",
  countryCode: "KE",
  status: "PENDING_VALIDATION",
  validatedByUserId: null,
  validatedAt: null,
  validationNotes: null,
  createdAt: "2026-09-11T00:00:00Z",
  updatedAt: "2026-09-11T00:00:00Z",
  deactivatedAt: null,
};

function renderDialog(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CreateOrganizationDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return onOpenChange;
}

describe("CreateOrganizationDialog", () => {
  beforeEach(() => {
    vi.spyOn(platformAdmin, "createPlatformOrganization").mockResolvedValue(created);
  });

  afterEach(() => vi.restoreAllMocks());

  it("submits the form with an auto-derived slug", async () => {
    const onOpenChange = renderDialog();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "G & Nestahs Co." } });
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "GNC" } });
    fireEvent.change(screen.getByLabelText("Country code"), { target: { value: "KE" } });
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() =>
      expect(platformAdmin.createPlatformOrganization).toHaveBeenCalledWith({
        name: "G & Nestahs Co.",
        code: "GNC",
        slug: "g-nestahs-co",
        countryCode: "KE",
        planTier: "STANDARD",
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
