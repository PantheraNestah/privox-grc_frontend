import { renderHook } from "@testing-library/react";
import { useActiveUser } from "./use-active-user";

const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  user: { id: "u1", fullName: "Ada Lovelace", email: "ada@org.com" },
  permissions: [] as string[],
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

describe("useActiveUser role derivation (V3 SoD model)", () => {
  const roleFor = (permissions: string[]) => {
    auth.permissions = permissions;
    return renderHook(() => useActiveUser()).result.current.role;
  };

  it("maps organization.manage to admin", () => {
    expect(roleFor(["organization.manage"])).toBe("admin");
  });

  it("maps approval permissions to approver", () => {
    expect(roleFor(["strategy.approve"])).toBe("approver");
    expect(roleFor(["orgnode.approve"])).toBe("approver");
  });

  it("maps contribution permissions to input_user", () => {
    expect(roleFor(["strategy.contribute"])).toBe("input_user");
    expect(roleFor(["orgnode.contribute"])).toBe("input_user");
  });

  it("defaults to input_user with no elevated permissions", () => {
    expect(roleFor([])).toBe("input_user");
  });

  it("prefers the admin role when several permissions are present", () => {
    expect(roleFor(["organization.manage", "strategy.approve", "strategy.contribute"])).toBe("admin");
  });
});
