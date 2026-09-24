import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  strategyFormulationKeys,
  useRecordStrategyProgress,
  useStrategyElements,
  useStrategyProgressHistory,
} from "./use-strategy-formulation";
import * as strategyFormulation from "@/lib/strategy-formulation";

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("Strategy Formulation hooks", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shares cached element queries for equivalent filters", async () => {
    const element = {
      id: "element-1",
      organizationId: "org-1",
      orgNodeId: null,
      parentElementId: null,
      type: "PILLAR" as const,
      versionId: "version-1",
      version: 1,
      current: true,
      title: "Digital transformation",
      description: "Modernize strategic capabilities",
      outcomeSummary: null,
      targetValue: null,
      unit: null,
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      status: "PUBLISHED" as const,
      elementCreatedByUserId: "user-1",
      elementCreatedAt: "2026-09-23T10:00:00Z",
      versionCreatedByUserId: "user-1",
      versionCreatedAt: "2026-09-23T10:00:00Z",
    };
    vi.spyOn(strategyFormulation, "fetchStrategyElements").mockResolvedValue([element]);

    const { result } = renderHook(
      () => ({
        first: useStrategyElements("org-1", { type: "PILLAR" }),
        second: useStrategyElements("org-1", { type: "PILLAR" }),
      }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.first.isSuccess).toBe(true));
    expect(strategyFormulation.fetchStrategyElements).toHaveBeenCalledTimes(1);
    expect(result.current.first.data).toEqual([element]);
    expect(result.current.second.data).toEqual([element]);
    expect(strategyFormulationKeys.elements("org-1", { type: "PILLAR" })).not.toEqual(
      strategyFormulationKeys.elements("org-2", { type: "PILLAR" }),
    );
  });

  it("does not request resources until organization and element IDs exist", () => {
    vi.spyOn(strategyFormulation, "fetchStrategyElements").mockResolvedValue([]);
    vi.spyOn(strategyFormulation, "fetchStrategyProgressHistory").mockResolvedValue([]);

    renderHook(
      () => ({
        elements: useStrategyElements(undefined),
        progress: useStrategyProgressHistory(undefined, undefined),
      }),
      { wrapper: wrapper() },
    );

    expect(strategyFormulation.fetchStrategyElements).not.toHaveBeenCalled();
    expect(strategyFormulation.fetchStrategyProgressHistory).not.toHaveBeenCalled();
  });

  it("primes progress cache and refreshes related formulation data after recording", async () => {
    const previous = {
      id: "progress-1",
      strategyElementId: "kpi-1",
      reportedValue: 50,
      note: null,
      recordedByUserId: "user-1",
      recordedAt: "2026-09-23T10:00:00Z",
    };
    const recorded = {
      id: "progress-2",
      strategyElementId: "kpi-1",
      reportedValue: 63.5,
      note: "Improved",
      recordedByUserId: "user-1",
      recordedAt: "2026-09-24T10:00:00Z",
    };
    vi.spyOn(strategyFormulation, "fetchStrategyProgressHistory")
      .mockResolvedValueOnce([previous])
      .mockResolvedValueOnce([recorded, previous]);
    vi.spyOn(strategyFormulation, "recordStrategyProgress").mockResolvedValue(recorded);

    const { result } = renderHook(
      () => ({
        history: useStrategyProgressHistory("org-1", "kpi-1"),
        record: useRecordStrategyProgress("org-1"),
      }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.history.data).toEqual([previous]));
    await act(async () => {
      await result.current.record.mutateAsync({
        elementId: "kpi-1",
        body: { reportedValue: 63.5, note: "Improved" },
      });
    });

    await waitFor(() => expect(result.current.history.data).toEqual([recorded, previous]));
    expect(strategyFormulation.recordStrategyProgress).toHaveBeenCalledWith(
      "org-1",
      "kpi-1",
      { reportedValue: 63.5, note: "Improved" },
    );
  });
});
