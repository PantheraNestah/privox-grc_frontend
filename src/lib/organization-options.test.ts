import {
  clearLastOrganization,
  formatGroupLabel,
  formatLastUsed,
  formatModuleLabel,
  getLastOrganization,
  mostRecentlyUsed,
  rememberLastOrganization,
  toGroupLabels,
  toModuleLabels,
} from "./organization-options";

describe("organization option labels", () => {
  it("turns group codes into labels and keeps org prefixes out of the UI", () => {
    expect(formatGroupLabel("ORG_ADMIN")).toBe("Organization Admin");
    expect(formatGroupLabel("GNC_ORG_ADMIN")).toBe("Organization Admin");
    expect(formatGroupLabel("SIC_GOVERNANCE_APPROVER")).toBe("Governance Approver");
    expect(formatGroupLabel("risk_contributor")).toBe("Risk Contributor");
    expect(formatGroupLabel("CUSTOM_GROUP")).toBe("Custom Group");
    expect(toGroupLabels(["ORG_ADMIN", "ORG_ADMIN", "ORG_MEMBER"])).toEqual([
      "Organization Admin",
      "Organization Member",
    ]);
  });

  it("maps module codes to catalogue names and never returns the raw code", () => {
    expect(formatModuleLabel("RISK_MANAGEMENT")).toBe("Risk Management");
    expect(formatModuleLabel("CORE")).toBe("Dashboard & Reporting");
    expect(formatModuleLabel("SOMETHING_NEW")).toBe("Something New");
    expect(toModuleLabels(["GOVERNANCE", "GOVERNANCE"])).toEqual([
      "Governance Management",
    ]);
  });
});

describe("formatLastUsed", () => {
  const now = new Date("2026-10-27T12:00:00.000Z").getTime();
  const at = (iso: string) => formatLastUsed(iso, now);

  it("describes recent use in human units", () => {
    expect(at("2026-10-27T11:59:40.000Z")).toBe("Last used just now");
    expect(at("2026-10-27T11:55:00.000Z")).toBe("Last used 5 min ago");
    expect(at("2026-10-27T09:00:00.000Z")).toBe("Last used 3 hrs ago");
    expect(at("2026-10-25T12:00:00.000Z")).toBe("Last used 2 days ago");
  });

  it("falls back to a date for old or missing timestamps", () => {
    expect(at("2026-09-01T12:00:00.000Z")).toMatch(/^Last used /);
    expect(formatLastUsed(undefined, now)).toBe("");
    expect(formatLastUsed("not-a-date", now)).toBe("");
  });
});

describe("mostRecentlyUsed", () => {
  it("picks the card with the newest lastUsedAt", () => {
    const recent = mostRecentlyUsed([
      { id: "o1", code: "SIC", name: "Savanna", primary: true, lastUsedAt: "2026-10-20T10:00:00Z" },
      { id: "o2", code: "GNC", name: "GNC", primary: false, lastUsedAt: "2026-10-26T10:00:00Z" },
      { id: "o3", code: "XYZ", name: "No activity", primary: false },
    ]);
    expect(recent?.id).toBe("o2");
  });

  it("returns undefined when no card has activity", () => {
    expect(mostRecentlyUsed([{ id: "o1", code: "SIC", name: "Savanna", primary: true }])).toBeUndefined();
  });
});

describe("last organization hint", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => clearLastOrganization());

  it("round-trips a non-secret hint", () => {
    rememberLastOrganization({ id: "o2", code: "GNC", name: "GNC Holdings" });
    expect(getLastOrganization()).toEqual({ id: "o2", code: "GNC", name: "GNC Holdings" });
  });

  it("clears the hint and ignores malformed values", () => {
    localStorage.setItem("grc_last_organization", "{not json");
    expect(getLastOrganization()).toBeNull();
    clearLastOrganization();
    expect(getLastOrganization()).toBeNull();
  });
});
