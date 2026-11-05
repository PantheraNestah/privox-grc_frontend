import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthScreen } from "./AuthScreen";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  login: vi.fn(),
  authNotice: null as string | null,
  clearAuthNotice: vi.fn(),
}));

vi.mock("@/lib/password-reset", () => ({
  requestPasswordReset: mocks.request,
  errorMessage: (_error: unknown, fallback: string) => fallback,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mocks.login,
    authNotice: mocks.authNotice,
    clearAuthNotice: mocks.clearAuthNotice,
  }),
}));

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

describe("AuthScreen password reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.request.mockResolvedValue({ message: "If an account exists..." });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<AuthScreen />} />
        </Routes>
      </MemoryRouter>,
    );
  });

  // The view change animates for 200 ms; wait for the form before using it.
  const openForgot = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    await screen.findByLabelText("Email address");
  };

  it("rejects an invalid email without calling the server", async () => {
    await openForgot();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("requests the reset link and shows the same confirmation whatever the account state", async () => {
    await openForgot();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: " jane@org.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() => expect(screen.getByText("Check your email")).toBeInTheDocument());
    expect(mocks.request).toHaveBeenCalledWith("jane@org.com");
  });

  it("keeps the user on the form and shows the error when the request fails", async () => {
    mocks.request.mockRejectedValue(new Error("offline"));
    await openForgot();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@org.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not send the reset link");
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });
});
