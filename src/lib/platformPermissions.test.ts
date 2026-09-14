import { canAnyPlatform, canPlatform, PLATFORM_PERMISSIONS } from "./platformPermissions";

describe("canPlatform", () => {
  it("matches an exact permission code", () => {
    expect(canPlatform(["platform.organization.view"], PLATFORM_PERMISSIONS.organizationView)).toBe(true);
    expect(canPlatform(["platform.organization.view"], PLATFORM_PERMISSIONS.organizationApprove)).toBe(false);
  });

  it("is false for missing permissions", () => {
    expect(canPlatform(null, PLATFORM_PERMISSIONS.moduleAssign)).toBe(false);
    expect(canPlatform(undefined, PLATFORM_PERMISSIONS.moduleAssign)).toBe(false);
    expect(canPlatform([], PLATFORM_PERMISSIONS.moduleAssign)).toBe(false);
  });
});

describe("canAnyPlatform", () => {
  it("is true when at least one permission is held", () => {
    expect(
      canAnyPlatform(["platform.module.assign"], [
        PLATFORM_PERMISSIONS.organizationApprove,
        PLATFORM_PERMISSIONS.moduleAssign,
      ]),
    ).toBe(true);
  });

  it("is false when none are held", () => {
    expect(
      canAnyPlatform(["user.invite"], [
        PLATFORM_PERMISSIONS.organizationApprove,
        PLATFORM_PERMISSIONS.moduleAssign,
      ]),
    ).toBe(false);
  });
});
