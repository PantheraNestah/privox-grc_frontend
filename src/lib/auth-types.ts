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
  /** `null` for platform-admin sessions. */
  organization: OrganizationDto | null;
  permissions: string[];
  /**
   * Active module codes allocated to this user in the tenant (Redesign V3).
   * Baseline read entitlement — presence means the module is visible.
   */
  allocatedModules?: string[];
}

export interface MeResponse {
  id: string;
  email: string;
  username: string;
  fullName: string;
  organization: OrganizationDto;
  permissions: string[];
  accessTokenExpiresAt: string;
  /** New in V3: active module codes allocated to this user (optional). */
  allocatedModules?: string[];
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
  /** Effective permissions at refresh time (re-resolved server-side each rotation). */
  permissions?: string[];
}

export interface LogoutRequest {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: UserDto | null;
  organization: OrganizationDto | null;
  permissions: string[];
  /** New in V3: list of allocated module codes for the tenant session. */
  allocatedModules: string[];
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
  /** System default groups are blueprints and must not be deleted/deactivated. */
  systemDefault?: boolean;
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

/** Backend UserGroupResponse — uses groupId, not id. */
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

/** Backend InvitationResponse. */
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

// ─── Organization Invitation Acceptance (public flow) ────

/**
 * Payload returned by `GET /api/v1/auth/invitations/{token}`.
 *
 * The backend has shipped both `id` and `invitationId` spellings for the
 * invitation identifier; both are declared so either contract type-checks.
 */
export interface InvitationDetailsResponse {
  id?: string;
  invitationId?: string;
  organizationId: string;
  organizationName: string;
  email: string;
  /** `false` → render the new-account registration form. */
  existingUser: boolean;
  initialGroupId: string | null;
  expiresAt: string;
}

/**
 * Payload sent to `POST /api/v1/auth/invitations/{token}/accept` for new users.
 * `confirmPassword` is sent (equal to `password`) for backends that validate it.
 */
export interface AcceptInvitationRequest {
  fullName: string;
  username?: string;
  password: string;
  confirmPassword?: string;
}

/** Payload returned by `POST /api/v1/auth/invitations/{token}/accept`. */
export interface InvitationAcceptanceResponse {
  userId: string;
  organizationId: string;
  organizationName: string;
  email: string;
  accountCreated: boolean;
  status: "ACCEPTED" | string;
}

// ─── User Module Allocations (Redesign V3) ────────────────

/** One module allocated to a user (`GET …/my-modules` item). */
export interface UserModuleDto {
  moduleId: string;
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
  allocatedAt?: string;
}

/**
 * `GET /api/v1/organizations/{orgId}/members/{userId}/modules`.
 * The backend currently returns `moduleCodes`; older docs/contracts use
 * `allocatedModuleCodes`, so both are optional and normalized by the client.
 */
export interface MemberModulesResponse {
  userId: string;
  organizationId: string;
  moduleCodes?: string[];
  allocatedModuleCodes?: string[];
}

/** `PUT /api/v1/organizations/{orgId}/members/{userId}/modules`. */
export interface UpdateMemberModulesRequest {
  moduleCodes: string[];
}
