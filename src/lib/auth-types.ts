/** DTO matching the backend auth API responses */

export interface LoginRequest {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

export interface UserDto {
  id: string;
  email: string;
  username: string;
  fullName: string;
}

export interface OrganizationDto {
  id: string;
  code: string;
  name: string;
}

export interface OrganizationDetailDto extends OrganizationDto {
  description?: string;
  status?: string;
  active?: boolean;
  industry?: string;
  sector?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  website?: string;
  domain?: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  accessTokenExpiresAt: string;
  user: UserDto;
  organization: OrganizationDto;
  permissions: string[];
}

export interface MeResponse {
  id: string;
  email: string;
  username: string;
  fullName: string;
  organization: OrganizationDto;
  permissions: string[];
  accessTokenExpiresAt: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  accessTokenExpiresAt: string;
}

export interface LogoutRequest {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: UserDto | null;
  organization: OrganizationDto | null;
  permissions: string[];
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─── Organization / Members / Groups ────────────────────

export interface OrganizationMember {
  membershipId: string;
  userId: string;
  email: string;
  username: string;
  fullName: string;
  membershipStatus: string;
  primary: boolean;
  joinedAt: string;
}

export interface OrganizationGroup {
  id: string;
  code?: string;
  name: string;
  description?: string;
  memberCount?: number;
  active?: boolean;
  status?: string;
}

export interface OrganizationPermission {
  id: string;
  code: string;
  name: string;
  description?: string;
  scopeType: string;
}

export interface OrganizationGroupDetail extends OrganizationGroup {
  memberCount: number;
  permissions: OrganizationPermission[];
}

export interface GroupMember {
  userId: string;
  membershipId?: string;
  email: string;
  username: string;
  fullName: string;
  membershipStatus?: string;
  joinedAt?: string;
}

export interface CreateOrganizationGroupRequest {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateOrganizationGroupRequest {
  name?: string;
  description?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  slug?: string;
  planTier?: string;
  countryCode?: string;
}

export interface CreateOrganizationMemberRequest {
  email: string;
  username?: string;
  fullName: string;
  password: string;
  initialGroupId: string;
}

/** Backend UserGroupResponse (§3.6) — uses groupId, not id. */
export interface UserGroupAssignment {
  groupMembershipId: string;
  groupId: string;
  code?: string;
  name: string;
  description?: string;
  scopeType?: string;
  systemDefault?: boolean;
  active?: boolean;
  addedByUserId?: string;
  assignedAt?: string;
}

/** Backend InvitationResponse (§3.3). */
export interface Invitation {
  id: string;
  organizationId: string;
  userId?: string | null;
  email: string;
  initialGroupId?: string | null;
  invitedByUserId?: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED" | string;
  expiresAt?: string;
  createdAt?: string;
}

export interface CreateInvitationRequest {
  email: string;
  initialGroupId?: string;
}
