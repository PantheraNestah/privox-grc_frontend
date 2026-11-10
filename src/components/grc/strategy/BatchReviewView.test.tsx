import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BatchReviewView, type BatchReviewViewProps } from "./BatchReviewView";
import { liveAppliedBatchDetail, liveBatchDetail } from "@/lib/strategy-batches.fixture";
import type { BatchDetail } from "@/lib/strategy-batches";

function Harness(props: Partial<BatchReviewViewProps> & { batch: BatchDetail }) {
  const [comments, setComments] = useState("");
  return (
    <MemoryRouter>
      <BatchReviewView
        organizationName="G & Nestahs Bank"
        canApprove
        currentUserId="someone-else"
        comments={comments}
        onCommentsChange={setComments}
        onDecide={vi.fn()}
        decisionPending={false}
        decisionError={null}
        {...props}
      />
    </MemoryRouter>
  );
}

describe("BatchReviewView", () => {
  it("shows the plan, its counts and the organization units", () => {
    render(<Harness batch={liveBatchDetail} />);

    expect(screen.getAllByText("Resilient Earnings and Balance-Sheet Quality").length).toBeGreaterThan(0);
    expect(screen.getByText("Grow the quality corporate lending book")).toBeInTheDocument();
    expect(screen.getByText("Corporate credit growth programme")).toBeInTheDocument();
    expect(screen.getByText("Organization units")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("warns that the organization drifted and names the affected element", () => {
    render(<Harness batch={liveBatchDetail} />);

    expect(screen.getByText(/The organization changed after this plan was submitted/)).toBeInTheDocument();
    expect(screen.getAllByText(/Corporate credit growth programme/).length).toBeGreaterThan(1);
    expect(screen.getByText(/Corporate Credit \(reorganised\)/)).toBeInTheDocument();
  });

  it("reads an element's full detail, including inherited org unit and KPI target", () => {
    render(<Harness batch={liveBatchDetail} />);

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    fireEvent.click(screen.getByRole("button", { name: /^Median days to approve a credit facility/ }));

    expect(screen.getByText("7 days")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("Lower is better")).toBeInTheDocument();
    expect(screen.getByText("Inherited from GNB27-O1")).toBeInTheDocument();
    expect(screen.getAllByText(/Corporate Credit Department/).length).toBeGreaterThan(0);
  });

  it("offers a flat table view of the same plan", () => {
    render(<Harness batch={liveBatchDetail} />);

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Table/ }), { button: 0 });

    const table = screen.getByRole("table");
    expect(within(table).getByText("GNB27-I1-K1")).toBeInTheDocument();
    expect(within(table).getByText("Median days to approve a credit facility")).toBeInTheDocument();
    expect(within(table).getByText("7 days")).toBeInTheDocument();
  });

  it("filters by search and explains when nothing matches", () => {
    render(<Harness batch={liveBatchDetail} />);

    fireEvent.change(screen.getByLabelText("Search elements"), { target: { value: "no such element" } });
    expect(screen.getByText("No elements match")).toBeInTheDocument();
  });

  it("reads only for a user without the approver role", () => {
    render(<Harness batch={liveBatchDetail} canApprove={false} />);

    expect(screen.queryByRole("button", { name: "Approve and apply" })).not.toBeInTheDocument();
    expect(screen.getByText(/Deciding it needs the Strategy Approver role/)).toBeInTheDocument();
  });

  it("requires a comment before rejecting", () => {
    const onDecide = vi.fn();
    render(<Harness batch={liveBatchDetail} onDecide={onDecide} />);

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Add a comment");
    expect(onDecide).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Comments"), { target: { value: "The KPI target is wrong." } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(onDecide).toHaveBeenCalledWith("REJECT");
  });

  it("confirms before publishing the plan", () => {
    const onDecide = vi.fn();
    render(<Harness batch={liveBatchDetail} onDecide={onDecide} />);

    fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/Publishes 4 elements to G & Nestahs Bank/)).toBeInTheDocument();
    expect(within(dialog).getByText(/cannot be deleted, only archived/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Approve and apply" }));
    expect(onDecide).toHaveBeenCalledWith("APPROVE");
  });

  it("tells the submitter that maker-checker may refuse their decision", () => {
    render(<Harness batch={liveBatchDetail} currentUserId={liveBatchDetail.createdBy} />);

    expect(screen.getByText(/If maker-checker is enabled/)).toBeInTheDocument();
  });

  it("shows the applied outcome and hides the decision bar after a decision", () => {
    render(<Harness batch={liveAppliedBatchDetail} />);

    expect(screen.getByText(/The plan is published/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve and apply" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Create").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unchanged").length).toBeGreaterThan(0);
  });

  it("shows the server's decision error inline", () => {
    render(<Harness batch={liveBatchDetail} decisionError="The organization changed. Re-check the plan." />);

    expect(screen.getByRole("alert")).toHaveTextContent("The organization changed");
  });
});
