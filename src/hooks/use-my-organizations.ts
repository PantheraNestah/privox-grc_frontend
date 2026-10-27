/**
 * `GET /v1/me/organizations` — the organizations the signed-in user can move
 * between. Shared by the header switcher; cached so opening the menu does not
 * refetch, but explicitly refetched when the menu opens.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MyOrganizationsResponse } from "@/lib/auth-types";

export const myOrganizationKeys = {
  all: ["me", "organizations"] as const,
};

export async function fetchMyOrganizations(): Promise<MyOrganizationsResponse> {
  const { data } = await api.get<MyOrganizationsResponse>("/v1/me/organizations");
  return {
    currentOrganizationId: data.currentOrganizationId,
    organizations: data.organizations ?? [],
  };
}

export function useMyOrganizations(enabled = true) {
  return useQuery({
    queryKey: myOrganizationKeys.all,
    queryFn: fetchMyOrganizations,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
