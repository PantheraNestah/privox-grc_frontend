import { render, screen } from "@testing-library/react";
import { SessionConflictOverlay } from "./SessionConflictOverlay";

const mocks = vi.hoisted(() => ({
  conflict: null as
    | { kind: "switched" | "login"; organizationName?: string }
    | null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ sessionConflict: mocks.conflict }),
}));

describe("SessionConflictOverlay", () => {
  beforeEach(() => {
    mocks.conflict = null;
  });

  it("renders nothing when the tab owns the current session", () => {
    const { container } = render(<SessionConflictOverlay />);
    expect(container).toBeEmptyDOMElement();
  });

  it("blocks the tab with a non-dismissable reload prompt after a switch", () => {
    mocks.conflict = { kind: "switched", organizationName: "GNC Holdings" };
    render(<SessionConflictOverlay />);

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("This tab is out of date")).toBeInTheDocument();
    expect(
      screen.getByText(/You switched to GNC Holdings in another tab/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
    // No dismiss/close affordance: reload is the only way forward.
    expect(screen.queryByRole("button", { name: /close|dismiss|cancel/i })).not.toBeInTheDocument();
  });

  it("explains a conflicting login from another tab", () => {
    mocks.conflict = { kind: "login" };
    render(<SessionConflictOverlay />);

    expect(screen.getByText("A different account signed in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
  });
});
