import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CredentialsForm } from "./CredentialsForm";
import { PortalMismatchError } from "@/lib/auth-session";

function setup(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <CredentialsForm
      identifierPlaceholder="you@org.com"
      failureLabel="Login failed"
      onSubmit={onSubmit}
      onForgotPassword={vi.fn()}
    />,
  );
  return onSubmit;
}

describe("CredentialsForm", () => {
  it("requires an identifier and password before submitting", () => {
    const onSubmit = setup();
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(screen.getByText("Email or username is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed credentials with the remember-me default", async () => {
    const onSubmit = setup();
    fireEvent.change(screen.getByLabelText("Email or Username"), { target: { value: "  a@b.com " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ identifier: "a@b.com", password: "secret", rememberMe: true }),
    );
  });

  it("shows the portal mismatch message returned by the auth context", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new PortalMismatchError("Wrong portal for this account."));
    setup(onSubmit);
    fireEvent.change(screen.getByLabelText("Email or Username"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong portal for this account.");
  });
});
