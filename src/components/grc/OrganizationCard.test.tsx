import { fireEvent, render, screen } from "@testing-library/react";
import { OrganizationCard } from "./OrganizationCard";
import type { OrganizationOptionDto } from "@/lib/auth-types";

const organization: OrganizationOptionDto = {
  id: "org-secret-id",
  code: "GNC",
  name: "GNC Holdings",
  primary: false,
  lastUsedAt: "2026-10-27T09:00:00.000Z",
  groups: ["GNC_ORG_ADMIN"],
  modules: ["RISK_MANAGEMENT", "GOVERNANCE"],
};

const now = new Date("2026-10-27T12:00:00.000Z").getTime();

describe("OrganizationCard", () => {
  it("shows a readable card without raw codes or ids", () => {
    render(<OrganizationCard organization={organization} onSelect={vi.fn()} now={now} />);

    expect(screen.getByText("GNC Holdings")).toBeInTheDocument();
    expect(screen.getByText("GNC")).toBeInTheDocument();
    expect(screen.getByText("Organization Admin")).toBeInTheDocument();
    expect(screen.getByText("Risk Management")).toBeInTheDocument();
    expect(screen.getByText("Last used 3 hrs ago")).toBeInTheDocument();

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("org-secret-id");
    expect(text).not.toContain("GNC_ORG_ADMIN");
    expect(text).not.toContain("RISK_MANAGEMENT");
  });

  it("selects on click and on the keyboard", () => {
    const onSelect = vi.fn();
    render(<OrganizationCard organization={organization} onSelect={onSelect} now={now} />);

    const card = screen.getByRole("button", { name: /GNC Holdings/ });
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(1);

    // A native button activates on Enter/Space; verify it stays focusable.
    card.focus();
    expect(card).toHaveFocus();
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("marks primary, current and loading states accessibly", () => {
    render(
      <OrganizationCard
        organization={{ ...organization, primary: true }}
        current
        loading
        onSelect={vi.fn()}
        now={now}
      />,
    );

    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    const card = screen.getByRole("button", { name: /GNC Holdings/ });
    expect(card).toHaveAttribute("aria-current", "true");
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(card).toBeDisabled();
  });
});
