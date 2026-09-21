import { fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { StrategyEntryForm } from "./StrategyEntryForm";
import { saveStrategy } from "@/data/strategyStore";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/hooks/use-active-user", () => ({
  useActiveUser: () => ({ id: "u1", name: "Ada Admin", email: "ada@example.com", role: "admin" }),
}));

const openTab = (name: RegExp | string) => fireEvent.mouseDown(screen.getByRole("tab", { name }));

describe("StrategyEntryForm", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("explains that pillars are needed before anything can be logged", () => {
    render(<StrategyEntryForm />);

    expect(screen.getByText("No strategic pillars defined yet")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("sends the user back to the first incomplete step when submitting", () => {
    saveStrategy({ pillars: [{ id: "p1", name: "Customer", description: "" }], objectives: [] });
    render(<StrategyEntryForm />);

    openTab("Timeline");
    fireEvent.click(screen.getByRole("button", { name: /Submit entry/ }));

    expect(toast.error).toHaveBeenCalledWith("Pick a strategic pillar");
    expect(screen.getByRole("tab", { name: "Basic info" })).toHaveAttribute("data-state", "active");
  });

  it("walks through the steps with Next and shows labelled fields", () => {
    saveStrategy({ pillars: [{ id: "p1", name: "Customer", description: "" }], objectives: [] });
    render(<StrategyEntryForm />);

    expect(screen.getByLabelText("Strategic initiative *")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByLabelText("KPI name *")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByLabelText("Start date *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit entry/ })).toBeInTheDocument();
  });
});
