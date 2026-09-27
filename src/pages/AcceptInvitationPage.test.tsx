import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AcceptInvitationPage from "./AcceptInvitationPage";
import type { InvitationDetailsResponse } from "@/lib/auth-types";

const mocks = vi.hoisted(() => ({
  invitation: {
    data: undefined as InvitationDetailsResponse | undefined,
    isLoading: false,
    isError: false,
    error: undefined as unknown,
  },
  accept: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  user: null as { email: string; fullName: string } | null,
  isAuthenticated: false,
}));

vi.mock("@/hooks/use-organization", () => ({
  useInvitationDetails: () => mocks.invitation,
  useAcceptInvitation: () => ({ mutateAsync: mocks.accept, isPending: false }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: mocks.isAuthenticated,
    user: mocks.user,
    login: mocks.login,
    logout: mocks.logout,
    refreshSession: mocks.refreshSession,
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const details: InvitationDetailsResponse = {
  id: "inv-1",
  organizationId: "org-1",
  organizationName: "Savanna Insurance Co.",
  email: "jane.doe@savanna.co.ke",
  existingUser: false,
  initialGroupId: null,
  expiresAt: "2026-10-02T15:47:00Z",
};

function renderPage(path = "/signup?token=abc") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/signup" element={<AcceptInvitationPage />} />
        <Route path="/dashboard" element={<div>Dashboard home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function resetInvitation(overrides: Partial<typeof mocks.invitation> = {}) {
  mocks.invitation.data = undefined;
  mocks.invitation.isLoading = false;
  mocks.invitation.isError = false;
  mocks.invitation.error = undefined;
  Object.assign(mocks.invitation, overrides);
}

describe("AcceptInvitationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accept.mockResolvedValue({ status: "ACCEPTED" });
    mocks.login.mockResolvedValue(undefined);
    mocks.logout.mockResolvedValue(undefined);
    mocks.refreshSession.mockResolvedValue(undefined);
    mocks.user = null;
    mocks.isAuthenticated = false;
    resetInvitation();
  });

  it("shows a missing-token card when no token is present", () => {
    renderPage("/signup");
    expect(screen.getByText("Missing Invitation Link")).toBeInTheDocument();
  });

  it("shows a loading shell while the token is pre-validated", () => {
    resetInvitation({ isLoading: true });
    renderPage();
    expect(screen.getByText("Verifying invitation…")).toBeInTheDocument();
  });

  it.each([
    [404, "Invalid Invitation"],
    [409, "Already Accepted"],
    [410, "Invitation Expired"],
  ])("maps a %i error to the %s card", (status, title) => {
    resetInvitation({ isError: true, error: { response: { status } } });
    renderPage();
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("renders the registration form for a new user and validates input", async () => {
    resetInvitation({ data: details });
    renderPage();

    expect(screen.getByText("Accept Invitation")).toBeInTheDocument();
    expect(screen.getByDisplayValue("jane.doe@savanna.co.ke")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /create account & join/i }));

    expect(await screen.findByText(/Full name is required/i)).toBeInTheDocument();
    expect(mocks.accept).not.toHaveBeenCalled();
  });

  it("accepts, auto-logs in and redirects a new user", async () => {
    resetInvitation({ data: details });
    renderPage();

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "SecurePass1!" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "SecurePass1!" } });
    fireEvent.click(screen.getByRole("button", { name: /create account & join/i }));

    await waitFor(() =>
      expect(mocks.accept).toHaveBeenCalledWith({
        fullName: "Jane Doe",
        username: undefined,
        password: "SecurePass1!",
        confirmPassword: "SecurePass1!",
      }),
    );
    expect(mocks.login).toHaveBeenCalledWith({
      identifier: "jane.doe@savanna.co.ke",
      password: "SecurePass1!",
      rememberMe: true,
    });
    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
  });

  it("blocks a mismatched signed-in account with a conflict notice", () => {
    mocks.isAuthenticated = true;
    mocks.user = { email: "john@other.com", fullName: "John" };
    resetInvitation({ data: { ...details, existingUser: true } });
    renderPage();

    expect(screen.getByText("Account Conflict")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out & switch account/i })).toBeInTheDocument();
  });

  it("offers one-click acceptance for a matching signed-in account", async () => {
    mocks.isAuthenticated = true;
    mocks.user = { email: "jane.doe@savanna.co.ke", fullName: "Jane Doe" };
    resetInvitation({ data: { ...details, existingUser: true } });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /accept invitation & join/i }));

    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith(undefined));
    expect(mocks.refreshSession).toHaveBeenCalled();
    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
  });
});
