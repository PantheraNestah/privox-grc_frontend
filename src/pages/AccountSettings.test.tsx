import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { AxiosError, type AxiosResponse } from "axios";
import AccountSettings from "./AccountSettings";
import * as me from "@/lib/me";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const httpError = (status: number) =>
  new AxiosError("failed", String(status), undefined, undefined, { status, data: {} } as AxiosResponse);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <HelmetProvider>
        <MemoryRouter>
          <AccountSettings />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
}

describe("AccountSettings", () => {
  beforeEach(() => {
    vi.spyOn(me, "changePassword").mockResolvedValue({ message: "Password changed successfully." });
  });

  afterEach(() => vi.restoreAllMocks());

  it("validates mismatched passwords before calling the API", () => {
    renderPage();
    fill("OldPass@123", "NewPass@123", "different");
    fireEvent.click(screen.getByRole("button", { name: /Update password/ }));

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(me.changePassword).not.toHaveBeenCalled();
  });

  it("submits the password change payload", async () => {
    renderPage();
    fill("OldPass@123", "NewPass@123", "NewPass@123");
    fireEvent.click(screen.getByRole("button", { name: /Update password/ }));

    await waitFor(() =>
      expect(me.changePassword).toHaveBeenCalledWith({
        currentPassword: "OldPass@123",
        newPassword: "NewPass@123",
        confirmPassword: "NewPass@123",
      }),
    );
  });

  it("flags an incorrect current password on a 400 response", async () => {
    vi.mocked(me.changePassword).mockRejectedValue(httpError(400));
    renderPage();
    fill("wrongpass", "NewPass@123", "NewPass@123");
    fireEvent.click(screen.getByRole("button", { name: /Update password/ }));

    expect(await screen.findByText("Your current password is incorrect.")).toBeInTheDocument();
  });
});
