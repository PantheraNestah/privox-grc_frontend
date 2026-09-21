import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import RiskStrategy from "./RiskStrategy";
import * as riskStrategyApi from "@/lib/riskStrategy";
import type { RiskStrategyConfigResponse } from "@/lib/governance-types";

const session = vi.hoisted(() => ({ role: "admin" as string }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ organization: { id: "org-1", code: "ORG", name: "Org" } }),
}));
vi.mock("@/hooks/use-active-user", () => ({
  useActiveUser: () => ({ id: "u1", name: "Ada", role: session.role }),
}));

const saved = {
  id: "cfg-1",
  organizationId: "org-1",
  orgNodeId: null,
  version: 1,
  current: true,
  levels: 3,
  likelihoodMode: "BOTH",
  toleranceThreshold: null,
  reviewFrequency: "ANNUALLY",
  lastReviewedAt: null,
  approvedByUserId: null,
  approvedAt: null,
  createdByUserId: "u1",
  createdAt: "2026-09-01T00:00:00Z",
  appetiteCategories: [{ id: "a1", name: "Strategic", statement: "Low appetite" }],
  likelihoodBands: { probability: [], timeline: [] },
  impactParameters: [],
} as unknown as RiskStrategyConfigResponse;

const httpError = (status: number) =>
  new AxiosError("failed", String(status), undefined, undefined, { status } as AxiosResponse);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter>
          <RiskStrategy />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

describe("RiskStrategy", () => {
  beforeEach(() => {
    session.role = "admin";
    vi.spyOn(riskStrategyApi, "fetchCurrentRiskStrategy").mockResolvedValue(saved);
    vi.spyOn(riskStrategyApi, "createRiskStrategyVersion").mockResolvedValue({ ...saved, id: "cfg-2", version: 2 });
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows the saved configuration read-only to non-admins", async () => {
    session.role = "input_user";
    renderPage();

    expect(await screen.findByDisplayValue("Low appetite")).toBeDisabled();
    expect(screen.getByText("Read-only view")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
  });

  it("starts from the default categories when no version has been approved yet", async () => {
    vi.mocked(riskStrategyApi.fetchCurrentRiskStrategy).mockRejectedValue(httpError(404));
    renderPage();

    expect(await screen.findByDisplayValue("Cyber & Information Security")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save/ })).toBeEnabled();
  });

  it("refuses to show editable defaults when loading fails for another reason", async () => {
    vi.mocked(riskStrategyApi.fetchCurrentRiskStrategy).mockRejectedValue(httpError(500));
    renderPage();

    expect(await screen.findByText("Couldn't load the risk strategy")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/ })).not.toBeInTheDocument();
  });

  it("tracks unsaved edits and saves them as a new version", async () => {
    renderPage();
    const statement = await screen.findByDisplayValue("Low appetite");
    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();

    fireEvent.change(statement, { target: { value: "Very low appetite" } });
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() =>
      expect(riskStrategyApi.createRiskStrategyVersion).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          appetiteCategories: [{ name: "Strategic", statement: "Very low appetite" }],
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
  });

  it("asks for confirmation before resetting to defaults", async () => {
    renderPage();
    await screen.findByDisplayValue("Low appetite");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(riskStrategyApi.createRiskStrategyVersion).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "Reset" }).at(-1)!);

    await waitFor(() =>
      expect(riskStrategyApi.createRiskStrategyVersion).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({ appetiteCategories: expect.arrayContaining([{ name: "Compliance", statement: "" }]) }),
      ),
    );
    expect(dialog).toBeDefined();
  });
});
