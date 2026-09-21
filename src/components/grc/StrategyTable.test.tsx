import { render, screen } from "@testing-library/react";
import { StrategyTable } from "./StrategyTable";
import { newInitiative, newKpi, newObjective, type StrategyConfig } from "@/data/strategyStore";
import type { OrgNode } from "@/data/orgStore";

const node: OrgNode = { id: "n1", name: "Head Office", type: "company", parentId: null, objectiveIds: [] };

function config(): StrategyConfig {
  const objective = { ...newObjective("p1"), title: "Grow NPS", linkedOrgNodeIds: ["n1"] };
  objective.initiatives = [
    {
      ...newInitiative(),
      id: "i1",
      name: "Digital onboarding",
      owner: "Ada",
      startDate: "2026-01-01",
      expectedCompletion: "2026-06-30",
      kpis: [{ ...newKpi("quantitative"), name: "NPS", target: "50", unit: "pts" }],
    },
  ];
  return { pillars: [{ id: "p1", name: "Customer", description: "" }], objectives: [objective] };
}

describe("StrategyTable", () => {
  it("renders one row per initiative with responsibility, KPIs and status", () => {
    render(<StrategyTable variant="formulation" cfg={config()} orgNodes={[node]} />);

    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    expect(screen.getByText("Digital onboarding")).toBeInTheDocument();
    expect(screen.getByText("Owner: Ada")).toBeInTheDocument();
    expect(screen.getByText("Head Office")).toBeInTheDocument();
    expect(screen.getByText(/target 50 pts/)).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows workflow and progress status in the assessment variant", () => {
    render(<StrategyTable variant="assessment" cfg={config()} orgNodes={[node]} assessments={[]} />);

    expect(screen.getByText("Workflow / progress")).toBeInTheDocument();
    expect(screen.getByText("Not started", { selector: "span.italic" })).toBeInTheDocument();
  });
});
