import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthScreen } from "./AuthScreen";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

const advance = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

describe("AuthScreen forgot-password flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    render(
      <MemoryRouter>
        <AuthScreen />
      </MemoryRouter>,
    );
  });

  afterEach(() => vi.useRealTimers());

  const openForgot = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    await advance(300);
  };

  it("rejects an invalid email before continuing", async () => {
    await openForgot();

    fireEvent.change(screen.getByLabelText("Organisation email address"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));

    expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
  });

  it("walks email → code → new password and validates each step", async () => {
    await openForgot();

    fireEvent.change(screen.getByLabelText("Organisation email address"), { target: { value: "jane@org.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));
    await advance(1100 + 300);

    expect(screen.getByText("Enter the code")).toBeInTheDocument();
    "123456".split("").forEach((digit, i) => {
      fireEvent.change(screen.getByLabelText(`Digit ${i + 1}`), { target: { value: digit } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify Code" }));
    await advance(900 + 300);

    expect(screen.getByText("Set a new password")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Str0ng!pass" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "Str0ng!pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
    await advance(1100 + 300);

    expect(screen.getByText("Password updated")).toBeInTheDocument();
  });

  it("flags a wrong verification code", async () => {
    await openForgot();
    fireEvent.change(screen.getByLabelText("Organisation email address"), { target: { value: "jane@org.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Verification Code" }));
    await advance(1100 + 300);

    "000000".split("").forEach((digit, i) => {
      fireEvent.change(screen.getByLabelText(`Digit ${i + 1}`), { target: { value: digit } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify Code" }));
    await advance(900);

    expect(screen.getByRole("alert")).toHaveTextContent("Incorrect or expired code");
  });
});
