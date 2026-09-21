import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import { OrgNodeInsightsPanel } from "./OrgNodeInsightsPanel";
import * as orgNodes from "@/lib/orgNodes";
import type { OrgNode } from "@/data/orgStore";
import type { OrgNodeMemberResponse } from "@/lib/governance-types";

const node: OrgNode = { id: "node-1", name: "Finance", type: "department", parentId: null, objectiveIds: [] };

const member = (over: Partial<OrgNodeMemberResponse>): OrgNodeMemberResponse => ({
  id: "m1",
  orgNodeId: "node-1",
  userId: "u1",
  userEmail: "leader@icea.co.ke",
  userFullName: "Division Leader",
  effectiveFrom: "2026-09-02T10:00:00Z",
  effectiveTo: null,
  createdAt: "2026-09-02T10:00:00Z",
  ...over,
});

function renderPanel(open = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrgNodeInsightsPanel
        orgId="org-1"
        node={node}
        open={open}
        onClose={vi.fn()}
        descendantIds={new Set(["node-1"])}
        documents={[]}
        strategy={{ pillars: [], objectives: [] }}
        assessments={[]}
      />
    </QueryClientProvider>,
  );
}

describe("OrgNodeInsightsPanel members", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists the people placed at the node from the API", async () => {
    const spy = vi.spyOn(orgNodes, "fetchOrgNodeMembers").mockResolvedValue([
      member({}),
      member({ id: "m2", userId: "u2", userEmail: "old@icea.co.ke", userFullName: "Former Lead", effectiveTo: "2026-01-01T00:00:00Z" }),
    ]);
    renderPanel();

    expect(await screen.findByText("Division Leader")).toBeInTheDocument();
    expect(screen.getByText("leader@icea.co.ke")).toBeInTheDocument();
    expect(screen.getByText("Former Lead")).toBeInTheDocument();
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith("org-1", "node-1");
  });

  it("shows an empty state when nobody is placed", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodeMembers").mockResolvedValue([]);
    renderPanel();

    expect(await screen.findByText("No one is placed at this unit yet.")).toBeInTheDocument();
  });

  it("explains a permission failure instead of showing an empty list", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodeMembers").mockRejectedValue(
      new AxiosError("forbidden", "403", undefined, undefined, { status: 403 } as AxiosResponse),
    );
    renderPanel();

    expect(await screen.findByText(/don't have permission to view the people/)).toBeInTheDocument();
  });

  it("does not fetch while the panel is closed", () => {
    const spy = vi.spyOn(orgNodes, "fetchOrgNodeMembers").mockResolvedValue([]);
    renderPanel(false);

    expect(spy).not.toHaveBeenCalled();
  });
});
