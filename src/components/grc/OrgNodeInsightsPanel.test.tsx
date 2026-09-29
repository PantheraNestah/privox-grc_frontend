import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import { OrgNodeInsightsPanel } from "./OrgNodeInsightsPanel";
import * as orgNodes from "@/lib/orgNodes";
import * as organization from "@/lib/organization";
import type { OrgNode } from "@/data/orgStore";
import type { OrganizationMember } from "@/lib/auth-types";
import type { OrgNodeMemberResponse } from "@/lib/governance-types";
import type { OrgNodeStrategyRollup } from "@/lib/org-node-rollup";

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

const orgMember = (over: Partial<OrganizationMember>): OrganizationMember => ({
  membershipId: "mem-1",
  userId: "u1",
  email: "leader@icea.co.ke",
  username: "leader",
  fullName: "Division Leader",
  membershipStatus: "ACTIVE",
  primary: false,
  joinedAt: "2026-01-01T00:00:00Z",
  ...over,
});

function renderPanel(open = true, canManageMembers = false, rollup?: OrgNodeStrategyRollup) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrgNodeInsightsPanel
        orgId="org-1"
        node={node}
        open={open}
        onClose={vi.fn()}
        descendantIds={new Set(["node-1"])}
        rollup={rollup}
        canManageMembers={canManageMembers}
      />
    </QueryClientProvider>,
  );
}

describe("OrgNodeInsightsPanel strategy roll-up", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows an empty strategy section when the unit has nothing linked", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodeMembers").mockResolvedValue([]);
    renderPanel();

    expect(
      await screen.findByText("No objectives or initiatives linked to this unit."),
    ).toBeInTheDocument();
  });

  it("renders the objective and initiative counts and the approval breakdown", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodeMembers").mockResolvedValue([]);
    renderPanel(true, false, {
      objectiveCount: 3,
      initiativeCount: 7,
      approved: 4,
      awaitingApproval: 2,
      revisionRequested: 1,
      rejected: 0,
      draft: 0,
    });

    // MiniStat renders the label above the value.
    const objectives = (await screen.findByText("Objectives")).parentElement!;
    expect(objectives).toHaveTextContent("Objectives3");
    const initiatives = screen.getByText("Initiatives").parentElement!;
    expect(initiatives).toHaveTextContent("Initiatives7");

    const progress = screen.getByText("Approved").closest("div")!;
    expect(progress).toHaveTextContent("Approved4");
    expect(screen.getByText("Awaiting approval").closest("div")).toHaveTextContent("2");
    expect(screen.getByText("Revision requested").closest("div")).toHaveTextContent("1");
    // 4 of 7 approved.
    expect(progress).toHaveTextContent("(57%)");
  });
});

/** Names currently rendered in the open picker, ignoring hidden filtered-out rows. */
const visiblePeople = () =>
  screen.queryAllByRole("option")
    .filter((o) => o.getAttribute("aria-disabled") !== "true" && o.dataset.state !== "hidden")
    .map((o) => o.querySelector("span.truncate")?.textContent ?? "");

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

describe("OrgNodeInsightsPanel placements", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hides the placement editor when the user cannot manage members", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodeMembers").mockResolvedValue([]);
    const roster = vi.spyOn(organization, "fetchOrganizationMembers").mockResolvedValue([]);
    renderPanel(true, false);

    expect(await screen.findByText("No one is placed at this unit yet.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    // The org-wide roster is only needed to populate the editor.
    expect(roster).not.toHaveBeenCalled();
  });

  it("offers a searchable picker of users not already placed, and only allows placing once one is chosen", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodeMembers").mockResolvedValue([member({})]);
    const roster = vi.spyOn(organization, "fetchOrganizationMembers").mockResolvedValue([
      orgMember({ userId: "u1" }),
      orgMember({ membershipId: "mem-2", userId: "u2", email: "new@icea.co.ke", username: "new", fullName: "New Hire" }),
      orgMember({ membershipId: "mem-3", userId: "u3", email: "ops@icea.co.ke", username: "ops", fullName: "Ops Person" }),
    ]);
    renderPanel(true, true);

    expect(await screen.findByText("Division Leader")).toBeInTheDocument();
    const place = await screen.findByRole("button", { name: /place/i });
    expect(place).toBeDisabled();

    fireEvent.click(screen.getByRole("combobox"));
    const search = await screen.findByPlaceholderText("Search by name or email…");

    // The already-placed user is filtered out of the picker.
    expect(visiblePeople()).toEqual(["New Hire", "Ops Person"]);

    fireEvent.change(search, { target: { value: "ops" } });
    expect(visiblePeople()).toEqual(["Ops Person"]);

    fireEvent.change(search, { target: { value: "new@" } });
    expect(visiblePeople()).toEqual(["New Hire"]);

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(await screen.findByText("No matching person.")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "new hire" } });
    fireEvent.click(await screen.findByText("New Hire"));
    await waitFor(() => expect(place).toBeEnabled());
    expect(roster).toHaveBeenCalledWith("org-1");
  });

  it("disables the picker when every org member is already placed", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodeMembers").mockResolvedValue([member({})]);
    vi.spyOn(organization, "fetchOrganizationMembers").mockResolvedValue([orgMember({ userId: "u1" })]);
    renderPanel(true, true);

    expect(await screen.findByText("Everyone is already placed here")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("ends an active placement when Remove is clicked", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodeMembers").mockResolvedValue([member({})]);
    vi.spyOn(organization, "fetchOrganizationMembers").mockResolvedValue([]);
    const remove = vi.spyOn(orgNodes, "removeOrgNodeMember").mockResolvedValue();
    renderPanel(true, true);

    fireEvent.click(await screen.findByRole("button", { name: /remove/i }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("org-1", "node-1", "u1"));
  });

  it("does not offer Remove for a placement that already ended", async () => {
    vi.spyOn(orgNodes, "fetchOrgNodeMembers").mockResolvedValue([
      member({ effectiveTo: "2026-01-01T00:00:00Z" }),
    ]);
    vi.spyOn(organization, "fetchOrganizationMembers").mockResolvedValue([]);
    renderPanel(true, true);

    expect(await screen.findByText("Ended")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });
});
