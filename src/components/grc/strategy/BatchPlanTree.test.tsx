import { fireEvent, render, screen } from "@testing-library/react";
import { BatchPlanTree } from "./BatchPlanTree";
import { liveAppliedBatchDetail, liveBatchDetail } from "@/lib/strategy-batches.fixture";

describe("BatchPlanTree", () => {
  it("shows every staged element without inventing a verdict badge", () => {
    render(<BatchPlanTree nodes={liveBatchDetail.plan} />);

    expect(screen.getByText("Resilient Earnings and Balance-Sheet Quality")).toBeInTheDocument();
    expect(screen.getByText("Grow the quality corporate lending book")).toBeInTheDocument();
    expect(screen.getByText("Corporate credit growth programme")).toBeInTheDocument();
    expect(screen.getByText("Median days to approve a credit facility")).toBeInTheDocument();

    // Plan nodes have no action or status, so neither badge may appear.
    expect(screen.queryByText("Warning")).not.toBeInTheDocument();
    expect(screen.queryByText("Error")).not.toBeInTheDocument();
  });

  it("says where an inherited org unit came from", () => {
    render(<BatchPlanTree nodes={liveBatchDetail.plan} />);

    expect(screen.getAllByText(/inherited from GNB27-O1/)).toHaveLength(2);
  });

  it("shows the new path when an org unit drifted after submission", () => {
    render(<BatchPlanTree nodes={liveBatchDetail.plan} />);

    expect(screen.getByText("Org path changed")).toBeInTheDocument();
    expect(screen.getByText(/Corporate Credit \(reorganised\)/)).toBeInTheDocument();
  });

  it("shows what applying the batch did to each node", () => {
    render(<BatchPlanTree nodes={liveAppliedBatchDetail.plan} result={liveAppliedBatchDetail.result} />);

    expect(screen.getAllByText("Create").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unchanged").length).toBeGreaterThan(0);
  });

  it("hides a collapsed subtree and brings it back when toggled", () => {
    const { rerender } = render(
      <BatchPlanTree nodes={liveBatchDetail.plan} expandedKeys={new Set()} onToggle={vi.fn()} />,
    );

    expect(screen.getByText("Resilient Earnings and Balance-Sheet Quality")).toBeInTheDocument();
    expect(screen.queryByText("Grow the quality corporate lending book")).not.toBeInTheDocument();

    rerender(<BatchPlanTree nodes={liveBatchDetail.plan} expandedKeys={new Set(["0"])} onToggle={vi.fn()} />);
    expect(screen.getByText("Grow the quality corporate lending book")).toBeInTheDocument();
    expect(screen.queryByText("Corporate credit growth programme")).not.toBeInTheDocument();
  });

  it("selects a row by click and marks it current", () => {
    const onSelect = vi.fn();
    render(<BatchPlanTree nodes={liveBatchDetail.plan} onSelect={onSelect} selectedKey="0/0" />);

    const selected = screen.getByRole("button", { name: /^Grow the quality corporate lending book/ });
    expect(selected).toHaveAttribute("aria-current", "true");

    fireEvent.click(screen.getByRole("button", { name: /^Corporate credit growth programme/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ key: "0/0/0" }));
  });

  it("focuses the next row with the arrow keys", () => {
    render(<BatchPlanTree nodes={liveBatchDetail.plan} onSelect={vi.fn()} />);

    const first = screen.getByRole("button", { name: /^Resilient Earnings/ });
    first.focus();
    fireEvent.keyDown(screen.getByRole("tree"), { key: "ArrowDown" });

    expect(screen.getByRole("button", { name: /^Grow the quality corporate lending book/ })).toHaveFocus();
  });

  it("explains an empty plan instead of showing a blank box", () => {
    render(<BatchPlanTree nodes={[]} />);
    expect(screen.getByText("This plan has no elements.")).toBeInTheDocument();
  });
});
