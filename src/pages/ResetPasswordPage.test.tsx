import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ResetPasswordPage from "./ResetPasswordPage";

const mocks = vi.hoisted(() => ({
  reset: vi.fn(),
}));

vi.mock("@/lib/password-reset", () => ({
  resetPassword: mocks.reset,
  errorMessage: (_error: unknown, fallback: string) => fallback,
}));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<div>Sign in page</div>} />
      </Routes>
    </MemoryRouter>,
  );

const fill = (password: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
};

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explains that the link is incomplete when there is no token", () => {
    renderAt("/reset-password");

    expect(screen.getByText("Invalid reset link")).toBeInTheDocument();
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("checks length and confirmation before calling the server", () => {
    renderAt("/reset-password?token=abc");

    fill("short", "short");
    expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();

    fill("LongEnough1!", "different");
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("submits the token and password, then confirms the change", async () => {
    mocks.reset.mockResolvedValue({ message: "Password has been reset successfully." });
    renderAt("/reset-password?token=abc");

    fill("LongEnough1!", "LongEnough1!");

    await waitFor(() => expect(screen.getByText("Password updated")).toBeInTheDocument());
    expect(mocks.reset).toHaveBeenCalledWith({
      token: "abc",
      newPassword: "LongEnough1!",
      confirmPassword: "LongEnough1!",
    });
  });

  it("shows the failure when the link is invalid or expired", async () => {
    mocks.reset.mockRejectedValue(new Error("expired"));
    renderAt("/reset-password?token=old");

    fill("LongEnough1!", "LongEnough1!");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This reset link is invalid or has expired",
    );
    expect(screen.queryByText("Password updated")).not.toBeInTheDocument();
  });
});
