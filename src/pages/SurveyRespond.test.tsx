import { fireEvent, render, screen, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import SurveyRespond from "./SurveyRespond";
import { loadResponses, newQuestion, newSurvey, saveSurveys, type Survey } from "@/data/surveyStore";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/use-active-user", () => ({
  useActiveUser: () => ({ id: "u1", name: "Ada Admin", email: "ada@x.co", role: "admin", title: "", createdAt: "" }),
}));

const seed = (patch: Partial<Survey> = {}): Survey => {
  const survey: Survey = {
    ...newSurvey("u1"),
    id: "s1",
    title: "Culture pulse",
    status: "published",
    questions: [
      {
        ...newQuestion(),
        id: "q1",
        text: "Do we escalate risks early?",
        type: "yes_no",
        required: true,
        options: [
          { id: "yes", label: "Yes", score: 1 },
          { id: "no", label: "No", score: 0 },
        ],
      },
    ],
    ...patch,
  };
  saveSurveys([survey]);
  return survey;
};

const renderAt = (url: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/surveys/:surveyId/respond" element={<SurveyRespond />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("SurveyRespond", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("blocks submission until required questions are answered, then records the response", () => {
    seed();
    renderAt("/surveys/s1/respond");

    fireEvent.click(screen.getByRole("button", { name: "Submit response" }));
    expect(toast.error).toHaveBeenCalledWith('Please answer: "Do we escalate risks early?"');
    expect(screen.queryByText("Thank you!")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    expect(screen.getByText("1 of 1 answered")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit response" }));

    expect(screen.getByText("Thank you!")).toBeInTheDocument();
    const [stored] = loadResponses();
    expect(stored.submittedAt).toBeTruthy();
    expect(stored.answers).toEqual([{ questionId: "q1", value: "yes" }]);
  });

  it("asks external respondents for their name before submitting", () => {
    seed();
    renderAt("/surveys/s1/respond?token=abc&email=vendor%40acme.co");

    expect(screen.getByText("vendor@acme.co")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit response" }));
    expect(toast.error).toHaveBeenCalledWith("Please enter your name to submit");

    fireEvent.change(screen.getByLabelText("Your name *"), { target: { value: "Vee Vendor" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit response" }));
    expect(screen.getByText("Thank you!")).toBeInTheDocument();
    expect(loadResponses()[0].respondentName).toBe("Vee Vendor");
  });

  it("does not offer a survey that is not published", () => {
    seed({ status: "closed" });
    renderAt("/surveys/s1/respond");

    expect(screen.getByText("Survey is not open")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit response" })).not.toBeInTheDocument();
  });

  it("reports an unknown survey", () => {
    seed();
    renderAt("/surveys/missing/respond");

    const notice = screen.getByText("Survey not found").closest("div")!;
    expect(within(notice).getByText(/invalid or removed/)).toBeInTheDocument();
  });
});
