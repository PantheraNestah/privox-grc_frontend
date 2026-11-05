import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApprovalRoutingDialog } from "./ApprovalRoutingDialog";
import type { ApprovalLevelRule } from "@/lib/governance-types";

const mocks = vi.hoisted(() => ({
  rules: [] as ApprovalLevelRule[],
  upsert: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/hooks/use-org-nodes", () => ({
  useApprovalLevelRules: () => ({ data: mocks.rules, isPending: false, error: null }),
  useUpsertApprovalLevelRule: () => ({ mutateAsync: mocks.upsert, isPending: false }),
  useDeleteApprovalLevelRule: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderDialog = (canEdit = true) =>
  render(<ApprovalRoutingDialog orgId="org-1" open onOpenChange={() => {}} canEdit={canEdit} />);

describe("ApprovalRoutingDialog", () => {
  beforeEach(() => {
    mocks.rules = [];
    mocks.upsert.mockReset();
    mocks.remove.mockReset();
  });

  it("defaults every level to the immediate parent when no rules exist", () => {
    renderDialog();
    expect(screen.getByLabelText("Approver for Department")).toHaveValue("PARENT");
  });

  it("shows an existing rule and replaces it when another level is chosen", async () => {
    mocks.rules = [{ sourceNodeType: "DEPARTMENT", targetNodeType: "DIVISION" }];
    mocks.upsert.mockResolvedValue({});
    renderDialog();

    expect(screen.getByLabelText("Approver for Department")).toHaveValue("DIVISION");

    fireEvent.change(screen.getByLabelText("Approver for Department"), { target: { value: "GROUP" } });
    await waitFor(() =>
      expect(mocks.upsert).toHaveBeenCalledWith({ sourceNodeType: "DEPARTMENT", targetNodeType: "GROUP" }),
    );
  });

  it("removes the rule when the parent option is chosen", async () => {
    mocks.rules = [{ sourceNodeType: "DEPARTMENT", targetNodeType: "DIVISION" }];
    mocks.remove.mockResolvedValue(undefined);
    renderDialog();

    fireEvent.change(screen.getByLabelText("Approver for Department"), { target: { value: "PARENT" } });
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("DEPARTMENT"));
  });

  it("is read-only without permission", () => {
    renderDialog(false);
    expect(screen.getByLabelText("Approver for Department")).toBeDisabled();
  });
});
