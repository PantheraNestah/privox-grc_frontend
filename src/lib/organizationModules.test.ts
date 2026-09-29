import { toEnabledModules, type OrganizationModuleStatus } from "./organizationModules";

const row = (over: Partial<OrganizationModuleStatus>): OrganizationModuleStatus => ({
  id: "m1",
  moduleId: "m1",
  code: "GOVERNANCE",
  name: "Governance",
  enabled: true,
  ...over,
});

describe("toEnabledModules", () => {
  it("maps known codes to static catalogue entries", () => {
    expect(toEnabledModules([row({ code: "GOVERNANCE" })]).map((m) => m.id)).toEqual(["governance"]);
  });

  it("surfaces unknown platform codes generically instead of dropping them", () => {
    const mods = toEnabledModules([
      row({ code: "THIRD_PARTY_RISK", name: "Third Party Risk", description: "Vendor risk" }),
    ]);

    expect(mods).toHaveLength(1);
    expect(mods[0]).toMatchObject({
      id: "third_party_risk",
      name: "Third Party Risk",
      desc: "Vendor risk",
    });
  });

  it("excludes disabled modules and de-duplicates colliding static ids", () => {
    const mods = toEnabledModules([
      row({ code: "CORE", enabled: true }),
      row({ code: "REPORTING", enabled: true }),
      row({ code: "RISK_MANAGEMENT", enabled: false }),
    ]);

    expect(mods.map((m) => m.id)).toEqual(["dashboard"]);
  });
});
