import { api } from "./api";
import {
  createRiskStrategyVersion,
  decideRiskStrategyVersion,
  fetchCurrentRiskStrategy,
  fetchRiskStrategyHistory,
} from "./riskStrategy";

describe("fetchCurrentRiskStrategy", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches the current version for an org", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: { id: "config-1", current: true } });

    await expect(fetchCurrentRiskStrategy("org-1")).resolves.toEqual({
      id: "config-1",
      current: true,
    });
    expect(api.get).toHaveBeenCalledWith(
      "/v1/organizations/org-1/risk-strategy/current",
      { params: undefined },
    );
  });
});

describe("fetchRiskStrategyHistory", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches version history ordered newest first", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [{ id: "config-2", version: 2 }] });

    await expect(fetchRiskStrategyHistory("org-1")).resolves.toEqual([
      { id: "config-2", version: 2 },
    ]);
    expect(api.get).toHaveBeenCalledWith(
      "/v1/organizations/org-1/risk-strategy/history",
      { params: undefined },
    );
  });
});

describe("createRiskStrategyVersion", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts a new version request", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { id: "config-1", current: false } });

    const body = { levels: 3 as const, likelihoodMode: "BOTH" as const, reviewFrequency: "ANNUALLY" as const };
    await expect(createRiskStrategyVersion("org-1", body)).resolves.toEqual({
      id: "config-1",
      current: false,
    });
    expect(api.post).toHaveBeenCalledWith("/v1/organizations/org-1/risk-strategy", body);
  });
});

describe("decideRiskStrategyVersion", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts an approval decision", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { id: "config-1", current: true } });

    await expect(
      decideRiskStrategyVersion("org-1", "config-1", { decision: "APPROVE" }),
    ).resolves.toEqual({ id: "config-1", current: true });
    expect(api.post).toHaveBeenCalledWith(
      "/v1/organizations/org-1/risk-strategy/config-1/decision",
      { decision: "APPROVE" },
    );
  });
});
