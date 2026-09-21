import { fireEvent, render, screen, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import SurveyManagement from "./SurveyManagement";
import { loadSurveys, newSurvey, saveSurveys } from "@/data/surveyStore";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const user = vi.hoisted(() => ({ role: "admin" as string }));
vi.mock("@/hooks/use-active-user", () => ({
  useActiveUser: () => ({ id: "u1", name: "Ada Admin", email: "ada@x.co", role: user.role, title: "", createdAt: "" }),
}));

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <SurveyManagement />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("SurveyManagement", () => {
  beforeEach(() => {
    localStorage.clear();
    user.role = "admin";
  });

  it("shows an empty state with a create action for managers", () => {
    renderPage();

    expect(screen.getByText("No surveys yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /New survey/ }).length).toBeGreaterThan(0);
  });

  it("designs a survey with a question and lists it after saving", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /New survey/ })[0]);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Design the questions, choose who receives it, then preview it as a respondent.")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Vendor controls" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add question/ }));
    fireEvent.change(within(dialog).getByLabelText("Question 1 text"), { target: { value: "Is MFA enforced?" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save survey" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Vendor controls")).toBeInTheDocument();
    const [saved] = loadSurveys();
    expect(saved.title).toBe("Vendor controls");
    expect(saved.questions[0].text).toBe("Is MFA enforced?");
  });

  it("lists stored surveys with their status and counts", () => {
    saveSurveys([
      { ...newSurvey("u1"), id: "a", title: "Draft one", status: "draft" },
      { ...newSurvey("u1"), id: "b", title: "Live one", status: "published" },
    ]);
    renderPage();

    expect(screen.getByText("Draft one")).toBeInTheDocument();
    expect(screen.getByText("Live one")).toBeInTheDocument();
    expect(screen.getByText("Published", { selector: "span, div" })).toBeInTheDocument();
  });

  it("is read-only for roles that cannot manage surveys", () => {
    user.role = "input_user";
    renderPage();

    expect(screen.getByText("Read-only view")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New survey/ })).not.toBeInTheDocument();
  });
});
