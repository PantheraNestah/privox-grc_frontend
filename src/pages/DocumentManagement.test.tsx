import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import DocumentManagement from "./DocumentManagement";
import { newDocument, type PolicyDocument } from "@/data/documentsStore";
import type { UserRole } from "@/data/userStore";

const session = vi.hoisted(() => ({ role: "admin" as string }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/hooks/use-active-user", () => ({
  useActiveUser: () => ({
    id: "u1",
    name: "Ada Admin",
    email: "ada@example.com",
    role: session.role as UserRole,
    title: "Admin",
    createdAt: "",
  }),
}));

const seed = (docs: PolicyDocument[]) => localStorage.setItem("rsolve.documents.v1", JSON.stringify(docs));
const stored = (): PolicyDocument[] => JSON.parse(localStorage.getItem("rsolve.documents.v1") ?? "[]");

const doc = (overrides: Partial<PolicyDocument>): PolicyDocument => ({ ...newDocument("policy"), ...overrides });

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <DocumentManagement />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("DocumentManagement", () => {
  beforeEach(() => {
    localStorage.clear();
    session.role = "admin";
    vi.clearAllMocks();
    seed([
      doc({ id: "d1", title: "Password Policy", description: "Rules for passwords", owner: "CISO" }),
      doc({ id: "d2", title: "Backup Procedure", type: "procedure" }),
    ]);
  });

  it("lists the stored documents with their details", () => {
    renderPage();

    expect(screen.getByText("Password Policy")).toBeInTheDocument();
    expect(screen.getByText("Backup Procedure")).toBeInTheDocument();
    expect(screen.getByText("Rules for passwords")).toBeInTheDocument();
  });

  it("filters the list by search text and offers a way out when nothing matches", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Search documents"), { target: { value: "backup" } });
    expect(screen.queryByText("Password Policy")).not.toBeInTheDocument();
    expect(screen.getByText("Backup Procedure")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search documents"), { target: { value: "zzz" } });
    expect(screen.getByText("No documents match these filters")).toBeInTheDocument();
  });

  it("requires a title before creating a document", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /New document/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(toast.error).toHaveBeenCalledWith("Title required");
    expect(stored()).toHaveLength(2);
  });

  it("creates a document from the dialog and persists it", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /New document/ }));
    fireEvent.change(await screen.findByLabelText("Document title (policy name) *"), {
      target: { value: "Acceptable Use Policy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(toast.success).toHaveBeenCalledWith("Document created");
    expect(await screen.findByText("Acceptable Use Policy")).toBeInTheDocument();
    expect(stored().map((d) => d.title)).toContain("Acceptable Use Policy");
  });

  it("deletes a document after confirmation", async () => {
    renderPage();

    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for Password Policy" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/ }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Password Policy")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByText("Rules for passwords")).not.toBeInTheDocument());
    expect(stored().map((d) => d.id)).toEqual(["d2"]);
  });

  it("locks authoring for read-only roles", () => {
    session.role = "executive";
    renderPage();

    expect(screen.getByText("Read-only view")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New document/ })).not.toBeInTheDocument();
    expect(screen.getByText("Password Policy")).toBeInTheDocument();
  });

  it("shows only documents in the user's scope for non-global roles", () => {
    session.role = "input_user";
    renderPage();

    expect(screen.queryByText("Password Policy")).not.toBeInTheDocument();
    expect(screen.getByText("No documents yet")).toBeInTheDocument();
  });
});
