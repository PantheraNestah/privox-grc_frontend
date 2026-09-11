import { platformApi } from "./api";
import {
  approvePlatformOrganization,
  createPlatformOrganization,
  disablePlatformOrganizationModule,
  enablePlatformOrganizationModule,
  getPlatformOrganization,
  listPlatformModules,
  listPlatformOrganizationModules,
  listPlatformOrganizations,
  loginPlatformAdmin,
  reactivatePlatformOrganization,
  suspendPlatformOrganization,
} from "./platformAdmin";

afterEach(() => vi.restoreAllMocks());

describe("platform organizations", () => {
  it("registers a tenant", async () => {
    vi.spyOn(platformApi, "post").mockResolvedValue({ data: { id: "org-1" } });
    const body = {
      name: "G & Nestahs Co.",
      code: "GNC",
      slug: "g-nestahs-co",
      countryCode: "KE",
      planTier: "STANDARD",
    };

    await expect(createPlatformOrganization(body)).resolves.toEqual({ id: "org-1" });
    expect(platformApi.post).toHaveBeenCalledWith("/v1/platform/organizations", body);
  });

  it("lists tenants without a status filter", async () => {
    vi.spyOn(platformApi, "get").mockResolvedValue({ data: [{ id: "org-1" }] });

    await expect(listPlatformOrganizations()).resolves.toEqual([{ id: "org-1" }]);
    expect(platformApi.get).toHaveBeenCalledWith("/v1/platform/organizations", {
      params: undefined,
    });
  });

  it("lists tenants filtered by status", async () => {
    vi.spyOn(platformApi, "get").mockResolvedValue({ data: [] });

    await listPlatformOrganizations({ status: "PENDING_VALIDATION" });
    expect(platformApi.get).toHaveBeenCalledWith("/v1/platform/organizations", {
      params: { status: "PENDING_VALIDATION" },
    });
  });

  it("fetches one tenant", async () => {
    vi.spyOn(platformApi, "get").mockResolvedValue({ data: { id: "org-1" } });

    await expect(getPlatformOrganization("org-1")).resolves.toEqual({ id: "org-1" });
    expect(platformApi.get).toHaveBeenCalledWith("/v1/platform/organizations/org-1");
  });

  it("approves a tenant", async () => {
    vi.spyOn(platformApi, "post").mockResolvedValue({ data: { id: "org-1" } });
    const body = { adminEmail: "admin@privox.io", notes: "Verified." };

    await approvePlatformOrganization("org-1", body);
    expect(platformApi.post).toHaveBeenCalledWith(
      "/v1/platform/organizations/org-1/approve",
      body,
    );
  });

  it("suspends and reactivates a tenant", async () => {
    const post = vi.spyOn(platformApi, "post").mockResolvedValue({ data: { id: "org-1" } });

    await suspendPlatformOrganization("org-1");
    await reactivatePlatformOrganization("org-1");

    expect(post).toHaveBeenNthCalledWith(1, "/v1/platform/organizations/org-1/suspend");
    expect(post).toHaveBeenNthCalledWith(2, "/v1/platform/organizations/org-1/reactivate");
  });
});

describe("platform modules", () => {
  it("lists the module catalogue", async () => {
    vi.spyOn(platformApi, "get").mockResolvedValue({ data: [{ id: "mod-1" }] });

    await expect(listPlatformModules()).resolves.toEqual([{ id: "mod-1" }]);
    expect(platformApi.get).toHaveBeenCalledWith("/v1/platform/modules");
  });

  it("lists an organization's module assignments", async () => {
    vi.spyOn(platformApi, "get").mockResolvedValue({ data: [] });

    await listPlatformOrganizationModules("org-1");
    expect(platformApi.get).toHaveBeenCalledWith("/v1/platform/organizations/org-1/modules");
  });

  it("enables and disables a module for an organization", async () => {
    const post = vi.spyOn(platformApi, "post").mockResolvedValue({ data: { enabled: true } });

    await enablePlatformOrganizationModule("org-1", "mod-1");
    await disablePlatformOrganizationModule("org-1", "mod-1");

    expect(post).toHaveBeenNthCalledWith(
      1,
      "/v1/platform/organizations/org-1/modules/mod-1/enable",
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/v1/platform/organizations/org-1/modules/mod-1/disable",
    );
  });
});

describe("loginPlatformAdmin", () => {
  it("omits organizationId so the backend mints a platform token", async () => {
    vi.spyOn(platformApi, "post").mockResolvedValue({ data: { accessToken: "token" } });

    await loginPlatformAdmin({ identifier: "giftadmin@privox.io", password: "pw" });

    expect(platformApi.post).toHaveBeenCalledWith("/v1/auth/login", {
      identifier: "giftadmin@privox.io",
      password: "pw",
      rememberMe: false,
    });
  });
});
