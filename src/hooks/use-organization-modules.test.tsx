import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEnabledModules, useModuleAccess, useOrganizationModules } from "./use-organization-modules";
import * as organizationModules from "@/lib/organizationModules";

const rows: organizationModules.OrganizationModuleStatus[] = [
  { id: "1", moduleId: "m1", code: "GOVERNANCE", name: "Governance", enabled: true },
  { id: "2", moduleId: "m2", code: "USER_MANAGEMENT", name: "Users", enabled: false },
];

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("organization module hooks", () => {
  beforeEach(() => {
    vi.spyOn(organizationModules, "fetchOrganizationModules").mockResolvedValue(rows);
  });

  afterEach(() => vi.restoreAllMocks());

  it("shares one cached request between the list, enabled and access hooks", async () => {
    const { result } = renderHook(
      () => ({
        list: useOrganizationModules("org-1"),
        enabled: useEnabledModules("org-1"),
        access: useModuleAccess("org-1"),
      }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(organizationModules.fetchOrganizationModules).toHaveBeenCalledTimes(1);
    expect(result.current.enabled.data?.map((m) => m.id)).toEqual(["governance"]);
    expect(result.current.access.isModuleEnabled("governance")).toBe(true);
    expect(result.current.access.isModuleEnabled("settings")).toBe(false);
  });

  it("treats modules as enabled until the lookup resolves, and never fetches without an org", () => {
    const { result } = renderHook(() => useModuleAccess(undefined), { wrapper: wrapper() });

    expect(result.current.isModuleEnabled("governance")).toBe(true);
    expect(organizationModules.fetchOrganizationModules).not.toHaveBeenCalled();
  });
});
