import { render, screen } from "@testing-library/react";
import { ShareLinksDialog } from "./ShareLinksDialog";
import type { Survey } from "@/data/surveyStore";

const survey = {
  id: "s1",
  title: "Vendor controls",
  category: "vendor",
  scoring: "none",
  questions: [],
  audiences: [
    { type: "roles", values: ["admin"] },
    { type: "external", values: ["vendor@example.com"] },
  ],
  status: "draft",
  createdByUserId: "u1",
  createdAt: "2026-01-01T00:00:00Z",
} as unknown as Survey;

describe("ShareLinksDialog", () => {
  it("labels the internal link as local-only and withholds non-functional external links", () => {
    render(<ShareLinksDialog survey={survey} onClose={() => {}} />);

    expect(screen.getByText(/only works in this browser/)).toBeInTheDocument();
    expect(screen.getByText("External party links are not available yet")).toBeInTheDocument();
    expect(screen.queryByLabelText(/vendor@example.com link/)).not.toBeInTheDocument();
  });
});
