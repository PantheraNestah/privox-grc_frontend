import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PlatformTemplateRegister from "./PlatformTemplateRegister";
import * as orgNodeTemplates from "@/lib/orgNodeTemplates";
import type { OrgTreeViewNode } from "@/components/grc/OrgTreeGraph";

const auth = vi.hoisted(() => ({ permissions: ["platform.orgnode.manage"] as string[] }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/contexts/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({ permissions: auth.permissions }),
}));

// React Flow needs real layout; the preview is exercised through this stand-in.
vi.mock("@/components/grc/OrgTreeGraph", () => ({
  colorForType: () => "231 51% 50%",
  OrgTreeGraph: ({ roots, onNodeClick }: { roots: OrgTreeViewNode[]; onNodeClick?: (id: string) => void }) => {
    const flat = (n: OrgTreeViewNode): OrgTreeViewNode[] => [n, ...n.children.flatMap(flat)];
    return (
      <ul data-testid="preview">
        {flat(roots[0]).map((n) => (
          <li key={n.id}>
            <button onClick={() => onNodeClick?.(n.id)}>{`preview:${n.name}`}</button>
          </li>
        ))}
      </ul>
    );
  },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter initialEntries={["/platform/templates/new"]}>
          <Routes>
            <Route path="/platform/templates/new" element={<PlatformTemplateRegister />} />
            <Route path="/platform/templates" element={<div>Templates catalogue</div>} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

const openTab = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }));
const previewNames = () =>
  within(screen.getByTestId("preview"))
    .getAllByRole("button")
    .map((b) => b.textContent);

describe("PlatformTemplateRegister", () => {
  beforeEach(() => {
    auth.permissions = ["platform.orgnode.manage"];
    vi.spyOn(orgNodeTemplates, "registerOrgNodeTemplate").mockResolvedValue({
      id: "template-new",
      name: "Insurance Org",
      description: null,
      rootOrgNodeId: "root-new",
      createdByUserId: "user-1",
      createdAt: "2026-09-11T00:00:00Z",
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("registers the example tree through the platform client and returns to the catalogue", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Insurance Org" } });
    fireEvent.click(screen.getByRole("button", { name: "Register template" }));

    await waitFor(() =>
      expect(orgNodeTemplates.registerOrgNodeTemplate).toHaveBeenCalledWith(
        {
          name: "Insurance Org",
          description: null,
          rootNode: expect.objectContaining({ name: "Group", type: "GROUP" }),
        },
        "platform",
      ),
    );
    expect(await screen.findByText("Templates catalogue")).toBeInTheDocument();
  });

  it("rejects invalid JSON before calling the API", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Broken" } });
    openTab("JSON");
    fireEvent.change(screen.getByLabelText("Template JSON"), { target: { value: "{ not json" } });
    fireEvent.click(screen.getByRole("button", { name: "Register template" }));

    expect(await screen.findByText("Root node is not valid JSON")).toBeInTheDocument();
    expect(orgNodeTemplates.registerOrgNodeTemplate).not.toHaveBeenCalled();
  });

  it("flags an unnamed node inline and does not call the API", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Broken" } });
    const [rootNameInput] = screen.getAllByPlaceholderText("Node name");
    fireEvent.change(rootNameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Register template" }));

    expect(await screen.findByText("root needs a name")).toBeInTheDocument();
    expect(screen.getByText("A name is required.")).toBeInTheDocument();
    expect(orgNodeTemplates.registerOrgNodeTemplate).not.toHaveBeenCalled();
  });

  it("keeps the live preview in sync as nodes are added", () => {
    renderPage();
    expect(previewNames()).toEqual([
      "preview:Group",
      "preview:Finance",
      "preview:Operations",
      "preview:Claims Processing",
    ]);

    fireEvent.click(screen.getAllByRole("button", { name: "Add child node" })[0]);

    expect(previewNames()).toHaveLength(5);
    expect(previewNames()).toContain("preview:Untitled");
  });

  it("hides and reveals children with collapse controls", () => {
    renderPage();
    expect(screen.getAllByPlaceholderText("Node name")).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.getAllByPlaceholderText("Node name")).toHaveLength(3);
    expect(screen.getByText("1 hidden node")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getAllByPlaceholderText("Node name")).toHaveLength(4);
  });

  it("jumps to a node in the builder when it is clicked in the preview", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByDisplayValue("Claims Processing")).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId("preview")).getByText("preview:Claims Processing"));

    expect(screen.getByDisplayValue("Claims Processing")).toBeInTheDocument();
  });

  it("previews JSON edits live and returns to the builder with them applied", () => {
    renderPage();
    openTab("JSON");
    fireEvent.change(screen.getByLabelText("Template JSON"), {
      target: { value: JSON.stringify({ name: "Solo", type: "GROUP" }) },
    });
    expect(previewNames()).toEqual(["preview:Solo"]);

    openTab("Builder");
    expect(screen.getByDisplayValue("Solo")).toBeInTheDocument();
  });

  it("sends users without template permission back to the catalogue", () => {
    auth.permissions = [];
    renderPage();

    expect(screen.getByText("Templates catalogue")).toBeInTheDocument();
  });
});
