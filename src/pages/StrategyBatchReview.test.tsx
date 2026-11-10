import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError } from "axios";
import { toast } from "sonner";
import StrategyBatchReview from "./StrategyBatchReview";
import { liveBatchDetail } from "@/lib/strategy-batches.fixture";

const mocks = vi.hoisted(() => ({
  batch: {
    data: undefined as unknown,
    isPending: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
  mutateAsync: vi.fn(),
  isPending: false,
  permissions: ["strategy.approve"] as string[],
  hasModule: true,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: "u1", email: "approver@org.com", username: "approver", fullName: "Approver" },
    organization: { id: "org-1", code: "GNC", name: "G & Nestahs Bank" },
    permissions: mocks.permissions,
    hasModule: () => mocks.hasModule,
  }),
}));

vi.mock("@/hooks/use-strategy-batches", () => ({
  useStrategyBatch: () => mocks.batch,
  useBatchDecision: () => ({ mutateAsync: mocks.mutateAsync, isPending: mocks.isPending }),
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/governance/strategy-formulation/batches/b1"]}>
        <Routes>
          <Route path="/governance/strategy-formulation/batches/:batchId" element={<StrategyBatchReview />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("StrategyBatchReview page", () => {
  beforeEach(() => {
    mocks.batch = { data: liveBatchDetail, isPending: false, isError: false, error: null, refetch: vi.fn() };
    mocks.mutateAsync.mockReset().mockResolvedValue(undefined);
    mocks.isPending = false;
    mocks.permissions = ["strategy.approve"];
    mocks.hasModule = true;
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("renders the batch, its status and the review controls", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "GNB FY2027 Strategy Plan" })).toBeInTheDocument();
    expect(screen.getByText("Awaiting decision")).toBeInTheDocument();
    expect(screen.getByText(/Create only · 4 elements/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to bulk import/ })).toHaveAttribute(
      "href",
      "/governance/strategy-formulation?tab=bulk",
    );
  });

  it("records a decision and confirms it", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Comments"), { target: { value: "The target needs a source." } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        batchId: liveBatchDetail.id,
        decision: "REJECT",
        comments: "The target needs a source.",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Decision recorded.");
  });

  it("shows a conflict from the server and keeps the reviewer on the page", async () => {
    mocks.mutateAsync.mockRejectedValue({
      response: { status: 409, data: { message: "The organization changed since submission." } },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText("Comments"), { target: { value: "Approved." } });
    fireEvent.click(screen.getByRole("button", { name: "Request revision" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The organization changed since submission.");
    expect(toast.error).toHaveBeenCalled();
  });

  it("explains a 403 without signing the user out", async () => {
    mocks.mutateAsync.mockRejectedValue({ response: { status: 403, data: {} } });
    renderPage();

    fireEvent.change(screen.getByLabelText("Comments"), { target: { value: "Approved." } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/maker-checker/);
  });

  it("shows a skeleton while the batch loads", () => {
    mocks.batch = { data: undefined, isPending: true, isError: false, error: null, refetch: vi.fn() };
    renderPage();

    expect(screen.getByText("Loading the batch")).toBeInTheDocument();
  });

  it("treats a missing batch as unavailable, with no pointless retry", () => {
    mocks.batch = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new AxiosError("missing", "404", undefined, undefined, { status: 404 } as never),
      refetch: vi.fn(),
    };
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("This batch isn't available here");
    expect(screen.queryByRole("button", { name: /Try again/ })).not.toBeInTheDocument();
  });

  it("does not show decision controls to a reader", () => {
    mocks.permissions = [];
    renderPage();

    expect(screen.queryByRole("button", { name: "Approve and apply" })).not.toBeInTheDocument();
    expect(screen.getByText(/Deciding it needs the Strategy Approver role/)).toBeInTheDocument();
  });
});
