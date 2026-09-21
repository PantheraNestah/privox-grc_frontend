import { fireEvent, render, screen, within } from "@testing-library/react";
import { FormulationInsights } from "./FormulationInsights";
import { newInitiative, newObjective, type StrategyConfig } from "@/data/strategyStore";
import type { OrgNode } from "@/data/orgStore";

const node: OrgNode = { id: "n1", name: "Head Office", type: "company", parentId: null, objectiveIds: [] };

function config(): StrategyConfig {
  const objective = { ...newObjective("p1"), title: "Grow NPS", linkedOrgNodeIds: ["n1"] };
  objective.initiatives = [
    { ...newInitiative(), id: "i1", name: "Digital onboarding", owner: "Ada", startDate: "2020-01-01", expectedCompletion: "2020-06-30" },
  ];
  return { pillars: [{ id: "p1", name: "Customer", description: "" }], objectives: [objective] };
}

describe("FormulationInsights", () => {
  it("asks for pillars before showing a roll-up", () => {
    render(<FormulationInsights cfg={{ pillars: [], objectives: [] }} orgNodes={[]} />);

    expect(screen.getByText("No insights yet")).toBeInTheDocument();
  });

  it("summarises each pillar and flags overdue initiatives", () => {
    render(<FormulationInsights cfg={config()} orgNodes={[node]} />);

    expect(screen.getByRole("button", { name: "Customer summary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 overdue/ })).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
  });

  it("drills into a pillar's initiatives in a side panel", async () => {
    render(<FormulationInsights cfg={config()} orgNodes={[node]} />);

    fireEvent.click(screen.getByRole("button", { name: "Customer summary" }));

    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText("1 initiative.")).toBeInTheDocument();
    expect(within(panel).getByText("Digital onboarding")).toBeInTheDocument();
  });
});
