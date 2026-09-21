import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import StrategyFormulation from "./StrategyFormulation";
import { loadStrategy, newObjective, saveStrategy } from "@/data/strategyStore";

const session = vi.hoisted(() => ({ role: "admin" as string }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/hooks/use-active-user", () => ({
  useActiveUser: () => ({ id: "u1", name: "Ada Admin", email: "ada@example.com", role: session.role }),
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <StrategyFormulation />
      </MemoryRouter>
    </HelmetProvider>,
  );

const openTab = (name: RegExp | string) => fireEvent.mouseDown(screen.getByRole("tab", { name }));

const seedPillar = (name = "Customer") => {
  const pillar = { id: "pil-1", name, description: "" };
  saveStrategy({ pillars: [pillar], objectives: [] });
  return pillar;
};

describe("StrategyFormulation", () => {
  beforeEach(() => {
    localStorage.clear();
    session.role = "admin";
    vi.clearAllMocks();
  });

  it("lets an administrator create the first pillar and persists it", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Add first pillar/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Pillar name *"), { target: { value: "Customer Experience" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Customer Experience")).toBeInTheDocument();
    expect(loadStrategy().pillars.map((p) => p.name)).toEqual(["Customer Experience"]);
    expect(toast.success).toHaveBeenCalledWith("Pillar added");
  });

  it("keeps the dialog open and reports a missing pillar name", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Add first pillar/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(toast.error).toHaveBeenCalledWith("Pillar name required");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(loadStrategy().pillars).toHaveLength(0);
  });

  it("gives non-admins a read-only pillar catalogue", () => {
    session.role = "input_user";
    seedPillar();
    renderPage();

    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.getByText(/Read-only catalogue defined by the Administrator/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add pillar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit pillar/ })).not.toBeInTheDocument();
  });

  it("adds an objective under a pillar and removes it after confirmation", async () => {
    seedPillar();
    renderPage();

    openTab(/Objectives/);
    fireEvent.click(screen.getByRole("button", { name: /Add objective/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Objective title *"), { target: { value: "Grow NPS" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Grow NPS")).toBeInTheDocument();
    expect(loadStrategy().objectives.map((o) => o.title)).toEqual(["Grow NPS"]);

    fireEvent.click(screen.getByRole("button", { name: "Delete objective Grow NPS" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText(/All initiatives, activities, outcomes and KPIs/)).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByText("Grow NPS")).not.toBeInTheDocument());
    expect(loadStrategy().objectives).toHaveLength(0);
  });

  it("removes a pillar together with its objectives", async () => {
    const pillar = seedPillar();
    saveStrategy({ pillars: [pillar], objectives: [{ ...newObjective(pillar.id), title: "Grow NPS" }] });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Delete pillar Customer" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(loadStrategy()).toEqual({ pillars: [], objectives: [] }));
  });

  it("shows plan totals scoped to what the viewer can see", () => {
    const pillar = seedPillar();
    saveStrategy({ pillars: [pillar], objectives: [{ ...newObjective(pillar.id), title: "Grow NPS" }] });
    renderPage();

    const objectives = screen.getByText("Objectives", { selector: "p" });
    expect(objectives.nextElementSibling).toHaveTextContent("1");
  });
});
