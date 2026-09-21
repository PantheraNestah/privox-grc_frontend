import {
  deriveGroupCode,
  formatDate,
  isInactiveStatus,
  permissionName,
  permissionScope,
  statusLabel,
} from "./user-management-utils";

describe("user-management-utils", () => {
  it("derives an upper-snake group code from a display name", () => {
    expect(deriveGroupCode("Risk Owners")).toBe("RISK_OWNERS");
    expect(deriveGroupCode("  riskOwners & Co. ")).toBe("RISK_OWNERS_CO");
  });

  it("prefers the boolean active flag over the status string", () => {
    expect(statusLabel("ACTIVE", false)).toBe("inactive");
    expect(isInactiveStatus("active", false)).toBe(true);
    expect(isInactiveStatus("inactive", true)).toBe(false);
  });

  it("treats lifecycle end-states as inactive", () => {
    for (const status of ["inactive", "Deactivated", "SUSPENDED", "revoked", "expired"]) {
      expect(isInactiveStatus(status)).toBe(true);
    }
    expect(isInactiveStatus("active")).toBe(false);
    expect(isInactiveStatus(undefined)).toBe(false);
  });

  it("falls back for missing or invalid dates", () => {
    expect(formatDate(undefined)).toBe("Unknown");
    expect(formatDate("not-a-date")).toBe("Unknown");
    expect(formatDate("2026-07-01T00:00:00Z")).not.toBe("Unknown");
  });

  it("handles string and object permissions", () => {
    expect(permissionName("user.view")).toBe("user.view");
    expect(permissionScope("user.view")).toBe("");
    expect(
      permissionName({ id: "1", code: "user.view", name: "", scopeType: "ORG" }),
    ).toBe("user.view");
  });
});
