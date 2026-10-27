import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthScreen } from "./AuthScreen";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  authNotice: null as string | null,
  clearAuthNotice: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mocks.login,
    authNotice: mocks.authNotice,
    clearAuthNotice: mocks.clearAuthNotice,
  }),
}));

const advance = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

describe("AuthScreen sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.login.mockResolvedValue({ status: "authenticated" });
    sessionStorage.clear();
  });

  const renderScreen = (organizationHint?: string) =>
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<AuthScreen organizationHint={organizationHint} />} />
          <Route path="/dashboard" element={<div>Dashboard home</div>} />
          <Route path="/choose-organization" element={<div>Organization picker</div>} />
        </Routes>
      </MemoryRouter>,
    );

  const signIn = () => {
    fireEvent.change(screen.getByLabelText("Email or Username"), {
      target: { value: "jane@org.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
  };

  it("passes an organization hint from the URL through to login", async () => {
    renderScreen("org-2");
    signIn();

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: "org-2" }),
      ),
    );
    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
  });

  it("sends a multi-organization user to the picker instead of the dashboard", async () => {
    mocks.login.mockResolvedValue({ status: "organization-required" });
    renderScreen();
    signIn();

    expect(await screen.findByText("Organization picker")).toBeInTheDocument();
  });

  it("shows the auth notice and clears it when the user edits", () => {
    mocks.authNotice = "Your organization selection expired. Please sign in again.";
    renderScreen();

    expect(screen.getByText(/organization selection expired/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email or Username"), {
      target: { value: "jane@org.com" },
    });
    expect(mocks.clearAuthNotice).toHaveBeenCalled();
  });
});

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

    expect(screen.getByText("No password was changed")).toBeInTheDocument();
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
