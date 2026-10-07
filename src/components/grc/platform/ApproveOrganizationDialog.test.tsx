import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApproveOrganizationDialog } from "./ApproveOrganizationDialog";

const mutateAsync = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-platform-organizations", () => ({
  useApprovePlatformOrganization: () => ({ mutateAsync, isPending: false }),
}));

const renderDialog = () =>
  render(
    <ApproveOrganizationDialog
      open
      onOpenChange={vi.fn()}
      organizationId="org-1"
      organizationName="Acme"
    />,
  );

describe("ApproveOrganizationDialog", () => {
  beforeEach(() => mutateAsync.mockReset());

  it("blocks approval and explains why when the admin email is missing", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/administrator's email/i);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("blocks approval for a malformed email", async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/administrator email/i), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/valid email/i);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("submits once a valid admin email is supplied", async () => {
    mutateAsync.mockResolvedValue({});
    renderDialog();
    fireEvent.change(screen.getByLabelText(/administrator email/i), { target: { value: "admin@acme.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", body: expect.objectContaining({ adminEmail: "admin@acme.com" }) }),
    );
  });
});
