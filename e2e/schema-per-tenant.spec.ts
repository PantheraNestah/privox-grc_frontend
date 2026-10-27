import { ApiStubs } from "./support/api-stub";
import { test, expect } from "./support/fixtures";
import {
  ORGANIZATIONS,
  PASSWORD,
  USER,
  authenticatedSession,
  modulesFor,
  organizationCards,
  selectionRequiredResponse,
  signIn,
  stubSessionRestore,
  type OrganizationFixture,
} from "./support/auth";

/**
 * Multi-organization selection and switching (issues #29–#35).
 *
 * The suite is hermetic: `/v1/**` is stubbed in `support/api-stub.ts`, so no
 * staging credentials or seeded data are required. For a live smoke run
 * against `feature/schema-per-tenant`, set `E2E_PASSWORD` and point
 * `VITE_API_URL` at that backend — see the last describe block.
 */

const SIC = ORGANIZATIONS.sic;
const GNC = ORGANIZATIONS.gnc;

/** Per-test backend state, shared by both tabs like the real server would be. */
function createTenantBackend(stubs: ApiStubs) {
  let current: OrganizationFixture = SIC;

  stubs.on("GET", "/v1/me/organizations", ({ route }) => {
    stubs.json(route, {
      currentOrganizationId: current.id,
      organizations: organizationCards(),
    });
  });

  stubs.on("GET", "/v1/organizations/:orgId/modules", ({ route, params }) => {
    const codes =
      params.orgId === GNC.id ? ["CORE", "RISK_MANAGEMENT"] : ["CORE", "GOVERNANCE"];
    stubs.json(route, modulesFor(codes));
  });

  return {
    get current() {
      return current;
    },
    set current(organization: OrganizationFixture) {
      current = organization;
    },
  };
}

function stubSwitch(stubs: ApiStubs, backend: ReturnType<typeof createTenantBackend>) {
  stubs.on("POST", "/v1/auth/switch-organization", ({ route, call }) => {
    const body = call.body as { organizationId: string };
    const target = body.organizationId === GNC.id ? GNC : SIC;
    backend.current = target;
    stubs.json(route, authenticatedSession(target));
  });
}

test.describe("multi-organization login", () => {
  test("shows the picker, then opens the chosen organization", async ({ page, stubs }) => {
    const backend = createTenantBackend(stubs);
    stubSessionRestore(stubs, () => backend.current);

    stubs.on("POST", "/v1/auth/login", ({ route }) => {
      stubs.json(route, selectionRequiredResponse());
    });

    stubs.on("POST", "/v1/auth/select-organization", ({ route, call }) => {
      const body = call.body as { selectionToken: string; organizationId: string };
      expect(body.selectionToken).toBe("selection-token-1");
      expect(body.organizationId).toBe(GNC.id);
      backend.current = GNC;
      stubs.json(route, authenticatedSession(GNC));
    });

    await signIn(page);

    // Two cards; the primary and the most recently used are both labelled.
    await expect(page).toHaveURL(/\/choose-organization/);
    await expect(page.getByRole("heading", { name: "Choose an organization" })).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(2);
    await expect(page.getByRole("button", { name: /Savanna Insurance/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /GNC Holdings/ })).toBeVisible();
    await expect(page.getByText("Primary")).toBeVisible();
    await expect(page.getByText(/Last used /).first()).toBeVisible();
    // Never raw codes or ids.
    await expect(page.locator("body")).not.toContainText("SIC_ORG_ADMIN");
    await expect(page.locator("body")).not.toContainText("org-gnc");

    await page.getByRole("button", { name: /GNC Holdings/ }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("button", { name: /Organization: GNC Holdings/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Risk Management/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Governance Management/ })).toHaveCount(0);
  });

  test("single-organization users never see the picker", async ({ page, stubs }) => {
    const backend = createTenantBackend(stubs);
    backend.current = SIC;

    stubs.on("GET", "/v1/me/organizations", ({ route }) => {
      stubs.json(route, {
        currentOrganizationId: SIC.id,
        organizations: organizationCards().slice(0, 1),
      });
    });
    stubs.on("POST", "/v1/auth/login", ({ route }) => {
      stubs.json(route, authenticatedSession(SIC));
    });

    await signIn(page);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Choose an organization")).toHaveCount(0);
    await expect(page.getByTitle("View organization details")).toContainText(SIC.name);
    await expect(page.getByRole("button", { name: /^Governance Management/ })).toBeVisible();
  });

  test("expired selection token returns to the credentials form", async ({ page, stubs }) => {
    const backend = createTenantBackend(stubs);
    stubSessionRestore(stubs, () => backend.current);

    stubs.on("POST", "/v1/auth/login", ({ route }) => {
      stubs.json(route, selectionRequiredResponse());
    });
    stubs.fail("POST", "/v1/auth/select-organization", 401, "Selection token expired");

    await signIn(page);
    await expect(page).toHaveURL(/\/choose-organization/);

    await page.getByRole("button", { name: /GNC Holdings/ }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByText("Your organization selection expired. Please sign in again."),
    ).toBeVisible();
    // A 401 must never be retried through the refresh interceptor.
    expect(stubs.callsTo("POST", "/v1/auth/refresh")).toHaveLength(0);
  });
});

test.describe("in-app organization switching", () => {
  test("switches SIC -> GNC -> SIC without a login screen", async ({ page, stubs }) => {
    const backend = createTenantBackend(stubs);
    stubSessionRestore(stubs, () => backend.current);
    stubSwitch(stubs, backend);

    stubs.on("POST", "/v1/auth/login", ({ route }) => {
      stubs.json(route, authenticatedSession(SIC));
    });

    await signIn(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("button", { name: /^Governance Management/ })).toBeVisible();

    // SIC -> GNC
    await page.getByRole("button", { name: /Organization: Savanna Insurance/ }).click();
    await page.getByRole("button", { name: /GNC Holdings/ }).click();
    await expect(page.getByRole("heading", { name: "Switch to GNC Holdings?" })).toBeVisible();
    await page.getByRole("button", { name: "Switch organization" }).click();

    await expect(
      page.getByRole("button", { name: /Organization: GNC Holdings/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Risk Management/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Governance Management/ })).toHaveCount(0);
    await expect(page.getByText("Sign In")).toHaveCount(0);

    // The switch stored the new refresh token: a reload keeps GNC.
    expect(await page.evaluate(() => localStorage.getItem("grc_refresh_token"))).toBe(
      "refresh-gnc",
    );
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Organization: GNC Holdings/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Risk Management/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Governance Management/ })).toHaveCount(0);

    // GNC -> SIC
    await page.getByRole("button", { name: /Organization: GNC Holdings/ }).click();
    await page.getByRole("button", { name: /Savanna Insurance/ }).click();
    await page.getByRole("button", { name: "Switch organization" }).click();

    await expect(
      page.getByRole("button", { name: /Organization: Savanna Insurance/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Governance Management/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Risk Management/ })).toHaveCount(0);

    expect(stubs.callsTo("POST", "/v1/auth/switch-organization")).toHaveLength(2);
  });

  test("a 403 keeps the current session and refreshes the list", async ({ page, stubs }) => {
    const backend = createTenantBackend(stubs);
    stubSessionRestore(stubs, () => backend.current);

    stubs.on("POST", "/v1/auth/login", ({ route }) => {
      stubs.json(route, authenticatedSession(SIC));
    });
    stubs.fail("POST", "/v1/auth/switch-organization", 403, "Not a member");

    await signIn(page);
    await expect(page.getByRole("button", { name: /Organization: Savanna Insurance/ })).toBeVisible();
    const listCallsBefore = stubs.callsTo("GET", "/v1/me/organizations").length;

    await page.getByRole("button", { name: /Organization: Savanna Insurance/ }).click();
    await page.getByRole("button", { name: /GNC Holdings/ }).click();
    await page.getByRole("button", { name: "Switch organization" }).click();

    await expect(
      page.getByText("You no longer have access to that organization."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Organization: Savanna Insurance/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Governance Management/ })).toBeVisible();
    await expect
      .poll(() => stubs.callsTo("GET", "/v1/me/organizations").length)
      .toBeGreaterThan(listCallsBefore);
  });
});

test.describe("two tabs", () => {
  test("switching in tab A blocks tab B until it reloads", async ({ page, context, stubs }) => {
    const backendA = createTenantBackend(stubs);
    stubSessionRestore(stubs, () => backendA.current);
    stubSwitch(stubs, backendA);
    stubs.on("POST", "/v1/auth/login", ({ route }) => {
      stubs.json(route, authenticatedSession(SIC));
    });

    await signIn(page);
    await expect(page.getByRole("button", { name: /Organization: Savanna Insurance/ })).toBeVisible();

    // Tab B restores the same shared session from localStorage.
    const tabB = await context.newPage();
    const stubsB = new ApiStubs(tabB);
    createTenantBackend(stubsB);
    stubSessionRestore(stubsB, () => SIC);
    await tabB.goto("/dashboard");
    await expect(tabB.getByRole("button", { name: /Organization: Savanna Insurance/ })).toBeVisible();

    // Switch in tab A.
    await page.getByRole("button", { name: /Organization: Savanna Insurance/ }).click();
    await page.getByRole("button", { name: /GNC Holdings/ }).click();
    await page.getByRole("button", { name: "Switch organization" }).click();
    await expect(page.getByRole("button", { name: /Organization: GNC Holdings/ })).toBeVisible();

    // Tab B is stopped, not silently switched.
    const dialog = tabB.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("You switched to GNC Holdings in another tab");
    await expect(dialog.getByRole("button", { name: "Reload" })).toBeVisible();

    const callsBeforeReload = stubsB.calls.length;
    // Tab B never issued the switch itself: it was stopped at the boundary.
    expect(stubsB.callsTo("POST", "/v1/auth/switch-organization")).toHaveLength(0);

    await tabB.reload();
    await expect(tabB.getByRole("button", { name: /Organization: Savanna Insurance/ })).toBeVisible();
    expect(stubsB.calls.length).toBeGreaterThan(callsBeforeReload);
  });
});

/**
 * Opt-in live smoke test against a real `feature/schema-per-tenant` backend.
 * The default suite never touches the network, so `E2E_PASSWORD` is optional.
 */
test.describe("live backend smoke", () => {
  test.skip(!process.env.E2E_PASSWORD, "Set E2E_PASSWORD to run against a live backend");

  test("a multi-organization user sees the picker", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email or Username").fill(process.env.E2E_EMAIL ?? USER.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/choose-organization/);
    await expect(page.getByRole("heading", { name: "Choose an organization" })).toBeVisible();
    await expect(page.getByRole("listitem").first()).toBeVisible();
  });
});
