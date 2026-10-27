import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { test, expect } from "./support/fixtures";
import {
  PASSWORD,
  USER,
  expiresAt,
  meResponse,
  modulesFor,
  organizationCards,
  signIn,
  stubSessionRestore,
} from "./support/auth";

/**
 * Demo + regression for the client-approved hierarchy design (the ICEA LION
 * chart): navy group root, pale blue business units, lavender group functions,
 * green 2nd line / red 3rd line, navy elbow connectors and the in-canvas legend.
 *
 * The ICEA LION sample data is stubbed, so this also produces the client
 * screenshot without a live backend:
 *   docs/screenshots/org-map-hierarchy.png
 */

const org = { id: "org-icea", code: "ICEA", name: "ICEA LION Group" };

type NodeSeed = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  lineOfDefense?: 1 | 2 | 3;
};

/** Mirrors the client's chart, including both internal-control owners. */
const ORG_TREE: NodeSeed[] = [
  { id: "icea", name: "ICEA LION Group", type: "GROUP", parentId: null },
  { id: "life", name: "ICEA LION Life Assurance", type: "COMPANY", parentId: "icea" },
  { id: "general", name: "ICEA LION General Assurance", type: "COMPANY", parentId: "icea" },
  { id: "bd", name: "Business Development", type: "DEPARTMENT", parentId: "general" },
  { id: "motor", name: "Motor Insurance", type: "SECTION", parentId: "bd" },
  { id: "non-motor", name: "Non Motor Insurance", type: "SECTION", parentId: "bd" },
  { id: "trust", name: "ICEA LION Trust Services", type: "COMPANY", parentId: "icea" },
  { id: "asset", name: "ICEA LION Asset Management", type: "COMPANY", parentId: "icea" },
  { id: "ceo", name: "Group CEO Office", type: "DEPARTMENT", parentId: "icea" },
  { id: "hr", name: "Group Human Resources", type: "DEPARTMENT", parentId: "ceo" },
  { id: "finance", name: "Group Finance", type: "DEPARTMENT", parentId: "ceo" },
  {
    id: "audit",
    name: "Group Internal Audit",
    type: "DEPARTMENT",
    parentId: "ceo",
    lineOfDefense: 3,
  },
  {
    id: "audit-control",
    name: "Internal Control",
    type: "SECTION",
    parentId: "audit",
    lineOfDefense: 3,
  },
  {
    id: "risk",
    name: "Group Risk and Compliance",
    type: "DEPARTMENT",
    parentId: "ceo",
    lineOfDefense: 2,
  },
  {
    id: "risk-control",
    name: "Internal Control",
    type: "SECTION",
    parentId: "risk",
    lineOfDefense: 2,
  },
];

const orgNodeResponse = ({ lineOfDefense, ...node }: NodeSeed) => ({
  id: node.id,
  organizationId: org.id,
  parentId: node.parentId,
  name: node.name,
  type: node.type,
  description: null,
  headcount: null,
  location: null,
  riskRating: null,
  regulatoryBody: null,
  contactEmail: null,
  costCenterCode: null,
  metadata: lineOfDefense ? { lineOfDefense } : null,
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  effectiveTo: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

/** Workspace endpoints shared by both cases (auth, shell and org data). */
function stubWorkspace(stubs: Parameters<typeof stubSessionRestore>[0]) {
  stubSessionRestore(stubs, () => org);

  stubs.on("GET", "/v1/me/organizations", ({ route }) => {
    stubs.json(route, {
      currentOrganizationId: org.id,
      organizations: organizationCards().slice(0, 1),
    });
  });
  stubs.on("GET", "/v1/organizations/:orgId/modules", ({ route }) => {
    stubs.json(route, modulesFor(["CORE", "GOVERNANCE", "RISK_MANAGEMENT", "USER_MANAGEMENT"]));
  });
  stubs.on("GET", "/v1/organizations/:orgId/org-nodes", ({ route }) => {
    stubs.json(route, ORG_TREE.map(orgNodeResponse));
  });
  stubs.on("GET", "/v1/organizations/:orgId/strategy-formulation/tree", ({ route }) => {
    stubs.json(route, []);
  });
  stubs.on("GET", "/v1/me", ({ route }) => {
    stubs.json(route, {
      ...meResponse(org),
      permissions: ["organization.manage"],
    });
  });
  stubs.on("POST", "/v1/auth/login", ({ route }) => {
    stubs.json(route, {
      status: "AUTHENTICATED",
      accessToken: "access-icea",
      refreshToken: "refresh-icea",
      tokenType: "Bearer",
      expiresIn: 3600,
      accessTokenExpiresAt: expiresAt(),
      user: USER,
      organization: org,
      permissions: ["organization.manage"],
      allocatedModules: ["CORE", "GOVERNANCE", "RISK_MANAGEMENT", "USER_MANAGEMENT"],
      orgNodeIds: [],
    });
  });
}

async function openMap(page: Parameters<typeof signIn>[0]) {
  await signIn(page, { password: PASSWORD });
  await page.goto("/governance/risk-governance");
  const card = page.getByTestId("organisation-map-card");
  await expect(card.getByRole("heading", { name: "Organisation Map" })).toBeVisible();
  // The canvas is mounted when it approaches the viewport (DeferredRender), so
  // scroll to it exactly as a user would before driving it.
  await card.scrollIntoViewIfNeeded();
  return card;
}

test.describe("organisation map hierarchy", () => {
  test.use({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });

  test("renders the client's chart and captures the map", async ({ page, stubs }) => {
    stubWorkspace(stubs);

    const card = await openMap(page);

    // The client's structure is on the canvas, with both control functions.
    await expect(card.getByText("ICEA LION Group", { exact: true })).toBeVisible();
    await expect(card.getByText("ICEA LION General Assurance", { exact: true })).toBeVisible();
    await expect(card.getByText("Group Risk and Compliance", { exact: true })).toBeVisible();
    await expect(card.getByText("Group Internal Audit", { exact: true })).toBeVisible();
    await expect(card.getByText("Internal Control", { exact: true })).toHaveCount(2);

    // The in-canvas legend uses the client's wording.
    await expect(card.getByText("2nd Line of Defence (Internal Control)")).toBeVisible();
    await expect(card.getByText("3rd Line of Defence (Internal Control)")).toBeVisible();
    await expect(card.getByText("Other Departments / Business Units")).toBeVisible();

    // Sibling order follows creation order (dagre used to scramble it).
    const names = await card.locator(".react-flow__node").allInnerTexts();
    expect(names.findIndex((t) => t.includes("Life Assurance")))
      .toBeLessThan(names.findIndex((t) => t.includes("General Assurance")));
    expect(names.findIndex((t) => t.includes("CEO Office")))
      .toBeGreaterThan(names.findIndex((t) => t.includes("Asset Management")));

    // Connectors paint: the global `svg { max-width: 100% }` used to clamp the
    // zero-width edge layer and hide every line.
    await expect(card.locator(".react-flow__edge-path")).toHaveCount(14);

    // Let React Flow finish its fitView animation before capturing.
    await page.waitForTimeout(900);

    const canvas = page.getByTestId("organisation-map-canvas");
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    await mkdir(dirname("docs/screenshots/org-map-hierarchy.png"), { recursive: true });
    await canvas.screenshot({ path: "docs/screenshots/org-map-hierarchy.png" });
  });

  test("tree and focus views still render their lane bands", async ({ page, stubs }) => {
    stubWorkspace(stubs);

    const card = await openMap(page);
    await card.getByRole("button", { name: "Tree" }).click();

    await expect(card.getByText("Unclassified — assign a Line of Defense")).toBeVisible();
    await expect(card.locator(".react-flow__edge-path").first()).toBeVisible();

    await card.getByRole("button", { name: "Focus" }).click();
    await expect(card.getByRole("button", { name: "Select units" })).toBeVisible();
  });

  test("keeps the map out of the login and dashboard path", async ({ page, stubs }) => {
    stubWorkspace(stubs);

    // Record every script/module the page pulls, starting before first paint.
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script" || request.url().includes("/src/")) {
        scripts.push(request.url());
      }
    });

    await signIn(page, { password: PASSWORD });
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForLoadState("networkidle");

    // React Flow + dagre (~90 kB gzip) are behind the lazily imported map, so
    // signing in must never download them. This is the guard against the map
    // drifting back into the entry chunk.
    expect(scripts.filter((url) => /OrgMapGraph|vendor-graph|RiskGovernance/.test(url))).toEqual([]);
  });
});
