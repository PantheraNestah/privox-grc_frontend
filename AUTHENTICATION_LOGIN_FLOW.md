# Authentication & Login Flow — Technical Architecture & Implementation Guide

**Scope:** End-to-end tracing of authentication, multitenant organization login, platform-admin login, JWT token issuance, session lifecycle management, refresh token rotation, current user context resolution, and authorization primitives.

**Codebase:** `privox-grc-api` (Spring Boot 3.4+, Spring Security 6, Spring Data JPA, Hibernate 6, Nimbus JOSE JWT, PostgreSQL 16).

---

## 0. End-to-End Flows Overview

### 0.1 Login Flow (`POST /api/v1/auth/login`)

```
POST /api/v1/auth/login
  │  @Valid LoginRequest { identifier, password, organizationId (optional), rememberMe }
  ▼
AuthenticationController.login(request, HttpServletRequest)
  │  Resolves client InetAddress (request.getRemoteAddr()) and User-Agent header
  ▼
AuthenticationService.login(request, ipAddress, userAgent)   [@Transactional]
  │
  ├── 1. authenticationManager.authenticate(UsernamePasswordAuthenticationToken(identifier.trim(), password))
  │        ├── Backed by DaoAuthenticationProvider with BCryptPasswordEncoder (cost 12)
  │        └── Backed by DatabaseUserDetailsService.loadUserByUsername(identifier)
  │              ├── Case-insensitive lookup by email OR username in global.users
  │              └── Returns PrivoxUserPrincipal (status must be ACTIVE; lockedUntil not expired; 0 authorities)
  │
  ├── 2. userRepository.findById(principal.userId())
  │        └── Fails with BadCredentialsException("Invalid login credentials") if not found
  │
  ├── 3. Branching on request.organizationId():
  │     ├── [IF organizationId != null]  --> Explicit Organization-Scoped Login:
  │     │     a. organizationRepository.findById(orgId) (must exist, status == OrganizationStatus.ACTIVE)
  │     │     b. organizationUserRepository.findByOrganization_IdAndUser_Id(orgId, userId)
  │     │          └── Membership must exist and have membershipStatus == MembershipStatus.ACTIVE
  │     │     c. permissions = groupPermissionRepository.findEffectivePermissionCodes(userId, orgId)
  │     │          └── Resolves org groups + platform groups, with organization_modules enablement gating
  │     │
  │     └── [IF organizationId == null]  --> Smart Server-Side Auto-Resolution Branch:
  │           a. Queries user's active memberships in active organizations:
  │                organizationUserRepository.findAllActiveMembershipsWithOrganization(userId, ACTIVE)
  │                (eagerly fetches organization; ordered by primary DESC, createdAt DESC)
  │           b. Queries platform permissions:
  │                groupPermissionRepository.findPlatformEffectivePermissionCodes(userId)
  │           c. Resolution Decision:
  │                i.   [Active Org Memberships present & Platform Permissions empty]:
  │                     --> Regular Tenant User (Single-Org or Multi-Org):
  │                     Auto-binds to the primary organization (or the most recently joined if none marked primary).
  │                     organization = selectedMembership.getOrganization()
  │                     permissions = groupPermissionRepository.findEffectivePermissionCodes(userId, organization.getId())
  │                ii.  [Platform Permissions present]:
  │                     --> Platform Administrator:
  │                     Logs in without an organization context (organization = null).
  │                     permissions = platformPermissions
  │                iii. [Both Active Memberships and Platform Permissions empty]:
  │                     --> Unassigned User:
  │                     Throws BadCredentialsException("Invalid login credentials")
  │
  ├── 4. Token Generation & Session Persistence:
  │        a. secureTokenGenerator.generate() -> rawRefreshToken (secure random base64 string)
  │        b. tokenHasher.hash(rawRefreshToken) -> refreshTokenHash (SHA-256 hex string)
  │        c. sessionLifetime = rememberMe ? sessionProperties.rememberMeTtl() (30d) : sessionProperties.refreshTokenTtl() (1d)
  │        d. UserSession.issue(user, organization, refreshTokenHash, rememberMe, sessionLifetime, ip, userAgent)
  │             └── activeOrganization is null for platform logins; non-null for org logins
  │        e. userSessionRepository.saveAndFlush(userSession)
  │
  ├── 5. Access Token Issuance:
  │        a. jwtTokenService.issueAccessToken(userId, session.getId(), organizationId, permissions)
  │             └── Signs RS256 JWT; includes claims: sub, sid, token_type="access", permissions; includes 'org' only if orgId != null
  │
  └── 6. Build LoginResponse:
           └── Returns accessToken, rawRefreshToken, tokenType="Bearer", expiresIn, accessTokenExpiresAt,
               UserSummary, OrganizationSummary (null if platform login), permissions
```

---

### 0.2 Refresh Token Flow (`POST /api/v1/auth/refresh`)

```
POST /api/v1/auth/refresh
  │  @Valid RefreshTokenRequest { refreshToken }
  ▼
AuthenticationController.refreshToken(request)
  ▼
RefreshTokenService.refresh(request)   [@Transactional]
  │
  ├── 1. tokenHasher.hash(request.refreshToken()) -> submittedTokenHash
  ├── 2. userSessionRepository.findActiveByRefreshTokenHashForUpdate(submittedTokenHash)
  │        └── PESSIMISTIC_WRITE lock, JOIN FETCH session.user, LEFT JOIN FETCH session.activeOrganization
  ├── 3. validateSession(session, now):
  │        └── Must be usable: !isRevoked() && expiresAt.isAfter(now)
  ├── 4. validateUser(user):
  │        └── user.status == UserStatus.ACTIVE && (lockedUntil == null || !lockedUntil.isAfter(now))
  ├── 5. validateOrganization(session.getActiveOrganization()):
  │        └── If non-null: organization.status == OrganizationStatus.ACTIVE (null is valid for platform sessions)
  ├── 6. Permission Resolution & Membership Check:
  │     ├── [IF session.getActiveOrganization() != null]:
  │     │     a. validateMembership(user.getId(), orgId): membership must exist and be ACTIVE
  │     │     b. permissions = groupPermissionRepository.findEffectivePermissionCodes(userId, orgId)
  │     └── [IF session.getActiveOrganization() == null]:
  │           a. permissions = groupPermissionRepository.findPlatformEffectivePermissionCodes(userId)
  │           b. If permissions.isEmpty(): throws BadCredentialsException
  ├── 7. Refresh Token Rotation:
  │        a. secureTokenGenerator.generate() -> newRawRefreshToken
  │        b. tokenHasher.hash(newRawRefreshToken) -> newRefreshTokenHash
  │        c. session.rotateRefreshToken(newRefreshTokenHash) -> replaces hash, updates lastSeenAt
  │        d. userSessionRepository.saveAndFlush(session)
  ├── 8. Access Token Issuance:
  │        └── jwtTokenService.issueAccessToken(user.getId(), session.getId(), organizationId, permissions)
  └── 9. Build RefreshTokenResponse:
           └── Returns accessToken, newRawRefreshToken, tokenType="Bearer", expiresIn, accessTokenExpiresAt, permissions
```

---

### 0.3 Logout Flow (`POST /api/v1/auth/logout`)

```
POST /api/v1/auth/logout
  │  Authorization: Bearer <accessToken>
  ▼
AuthenticationController.logout(@AuthenticationPrincipal Jwt jwt)
  ▼
LogoutService.logout(jwt)   [@Transactional]
  │
  ├── 1. validateAccessToken(jwt): token_type claim must equal "access"
  ├── 2. Extract sub (authenticatedUserId) and sid (sessionId) claims
  ├── 3. userSessionRepository.findByIdForUpdate(sessionId) (PESSIMISTIC_WRITE lock)
  ├── 4. Ownership verification: session.getUser().getId().equals(authenticatedUserId)
  ├── 5. session.revoke(): stamps revokedAt = Instant.now() (idempotent)
  └── 6. userSessionRepository.saveAndFlush(session)
  ▼
HTTP 204 No Content
```

---

### 0.4 Downstream JWT Consumers Matrix

| Consumer | Reads From JWT | Behavior with Org-Scoped Token | Behavior with Platform Token (`org == null`) |
|---|---|---|---|
| [`OrganizationAccessChecker.matches(orgId, auth)`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authorization/OrganizationAccessChecker.java#L11-L35) | `org` claim | Compares token `org` with target `organizationId` | Returns `false` (fails closed) — prevents platform tokens from bypassing org isolation |
| [`CurrentUserService.getCurrentUser(Jwt)`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/application/CurrentUserService.java#L44-L77) (`GET /api/v1/me`) | `sub`, `org`, `permissions` | Returns [`CurrentUserResponse`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/api/dto/CurrentUserResponse.java) with user and org summary | ⚠️ **Throws `BadCredentialsException("Required JWT claim is missing: org")`** (surfaces as 401). See §10.1 |
| [`CurrentUserService.changePassword(Jwt, req)`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/application/CurrentUserService.java#L80-L144) (`POST /api/v1/me/change-password`) | `sub`, `token_type` | Verifies current password, updates BCrypt hash | Works identically for both org and platform users |
| [`LogoutService.logout(Jwt)`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/application/LogoutService.java#L22-L47) | `sub`, `sid`, `token_type` | Soft-revokes session in DB | Works identically for both org and platform users |
| [`JwtAuthenticationConverter`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/jwt/JwtConfiguration.java#L58-L69) | `permissions` claim | Converts permission codes into `GrantedAuthority` without prefix | Works identically for all scopes (e.g., `hasAuthority('platform.organization.approve')`) |
| Platform Controllers (e.g. [`PlatformOrganizationController`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java)) | `@AuthenticationPrincipal Jwt`, authorities | Checked via `@PreAuthorize("hasAuthority('platform...')")` | Authorized via platform permission authorities |
| [`NodeScopeAuthorization`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authorization/NodeScopeAuthorization.java) | `sub` claim (via `JwtAuthenticationToken`) | Checks node placement + group membership in DB | Evaluated per node in organization context |

---

## 1. [`LoginRequest.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/api/dto/LoginRequest.java)

**Path:** `src/main/java/com/privox_grc_api/usermanagement/authentication/api/dto/LoginRequest.java`

### Purpose
Java `record` representing the body of `POST /api/v1/auth/login`. Validated by Spring's `@Valid` at the [`AuthenticationController`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java) boundary.

### Fields
| Component | Type | Validation Constraints | Description |
|---|---|---|---|
| `identifier` | `String` | `@NotBlank(message = "Email or username is required")`, `@Size(max = 255)` | Email or username, resolved case-insensitively. |
| `password` | `String` | `@NotBlank(message = "Password is required")`, `@Size(max = 255)` | Raw plaintext password. |
| `organizationId` | `UUID` | *None* (**Optional**) | If present, explicitly requests login to that organization. If `null`, triggers **Smart Server-Side Auto-Resolution**: auto-binds to the user's primary/active organization, or issues a platform session for platform administrators. |
| `rememberMe` | `boolean` | *None* | Defaults to `false`. Selects between 1-day standard TTL and 30-day extended session TTL. |

> [!NOTE]
> `organizationId` is completely optional. Users belonging to organizations do not need to supply or remember their organization UUID; the backend automatically resolves their active organization on login.

---

## 2. [`LoginResponse.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/api/dto/LoginResponse.java)

**Path:** `src/main/java/com/privox_grc_api/usermanagement/authentication/api/dto/LoginResponse.java`

### Purpose
Response DTO returned on successful login. Contains authentication credentials, session expiry metadata, identity summaries, and effective permissions.

### Components
| Component | Type | Description |
|---|---|---|
| `accessToken` | `String` | RS256-signed JWT token string. |
| `refreshToken` | `String` | Raw cryptographically secure random token string, returned exactly once upon creation or rotation. |
| `tokenType` | `String` | Literal string `"Bearer"`. |
| `expiresIn` | `long` | Access token lifespan in seconds (from `app.security.jwt.access-token-ttl`, default 900 seconds / 15 minutes). |
| `accessTokenExpiresAt` | `Instant` | Exact UTC expiration instant of the issued access token. |
| `user` | [`UserSummary`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/api/dto/LoginResponse.java#L10) | Nested record: `(UUID id, String email, String username, String fullName)`. |
| `organization` | [`OrganizationSummary`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/api/dto/LoginResponse.java#L13) | Nested record: `(UUID id, String code, String name)`. **Nullable**: populated for organization logins, `null` for platform-admin logins. |
| `permissions` | `List<String>` | Immutable list of effective permission codes granted to the user for the current session. |

---

## 3. [`AuthenticationService.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/application/AuthenticationService.java)

**Path:** `src/main/java/com/privox_grc_api/usermanagement/authentication/application/AuthenticationService.java`

### Dependencies
Injected via constructor:
1. `AuthenticationManager` — delegates to Spring Security's [`DaoAuthenticationProvider`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/configuration/SecurityConfiguration.java#L31-L38).
2. [`UserRepository`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/infrastructure/UserRepository.java) — loads the JPA [`User`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/domain/User.java) entity.
3. [`OrganizationRepository`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/infrastructure/OrganizationRepository.java) — validates active organizations.
4. [`OrganizationUserRepository`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/infrastructure/OrganizationUserRepository.java) — verifies active organization membership.
5. [`UserSessionRepository`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/infrastructure/UserSessionRepository.java) — persists session records in `global.sessions`.
6. [`SecureTokenGenerator`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/shared/crypto/SecureTokenGenerator.java) — generates opaque tokens via `SecureRandom`.
7. [`TokenHasher`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/shared/crypto/TokenHasher.java) — hashes raw tokens using SHA-256 hex encoding.
8. [`JwtTokenService`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/jwt/JwtTokenService.java) — encodes RS256 JWT access tokens.
9. [`SessionProperties`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authentication/SessionProperties.java) — reads configured session TTLs (`refreshTokenTtl`, `rememberMeTtl`).
10. [`GroupPermissionRepository`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/infrastructure/GroupPermissionRepository.java) — resolves effective permission codes via native SQL.

### Execution Walkthrough

```java
@Transactional
public LoginResponse login(LoginRequest request, InetAddress ipAddress, String userAgent)
```

1. **Credential Authentication:**
   Constructs `UsernamePasswordAuthenticationToken(request.identifier().trim(), request.password())`. Passes to `authenticationManager.authenticate(...)`.
   - Backed by [`DatabaseUserDetailsService`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authentication/DatabaseUserDetailsService.java) which calls `userRepository.findByEmailIgnoreCaseOrUsernameIgnoreCase(...)`.
   - Encapsulated into [`PrivoxUserPrincipal`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authentication/PrivoxUserPrincipal.java).
   - Validates `status == UserStatus.ACTIVE` and account is not locked (`lockedUntil == null || !lockedUntil.isAfter(now)`).
   - Authorities returned at this stage are empty (`List.of()`); permission authorities are assigned via JWT upon session issuance.
2. **User Retrieval:**
   `userRepository.findById(principal.userId())`. Throws `BadCredentialsException` if not found.
3. **Contextual Branching & Smart Auto-Resolution:**
   - **Explicit Organization-Scoped Login (`request.organizationId() != null`):**
     - Finds organization: `organizationRepository.findById(request.organizationId())`.
     - Validates status: `organization.getStatus() == OrganizationStatus.ACTIVE`.
     - Finds membership: `organizationUserRepository.findByOrganization_IdAndUser_Id(organization.getId(), user.getId())`.
     - Validates membership status: `membership.getMembershipStatus() == MembershipStatus.ACTIVE`.
     - Loads permissions: `groupPermissionRepository.findEffectivePermissionCodes(user.getId(), organization.getId())`.
   - **Smart Server-Side Auto-Resolution (`request.organizationId() == null`):**
     - Queries all active memberships for the user in active organizations:
       `organizationUserRepository.findAllActiveMembershipsWithOrganization(user.getId(), MembershipStatus.ACTIVE)`
       (ordered by `primary DESC, createdAt DESC`, eagerly fetching the organization).
     - Queries platform permissions: `groupPermissionRepository.findPlatformEffectivePermissionCodes(user.getId())`.
     - **Decision:**
       1. **Regular Organization User (`!activeMemberships.isEmpty() && platformPermissions.isEmpty()`):**
          Auto-binds to `activeMemberships.get(0)`. If one organization is designated as primary (`is_primary = true`), it is selected first; otherwise, the user's most recently joined active organization is selected. Loads organization-scoped permissions via `findEffectivePermissionCodes(...)`.
       2. **Platform Administrator (`!platformPermissions.isEmpty()`):**
          Logs in without an organization context (`organization = null`). Grants effective platform permissions.
       3. **Unassigned User (`activeMemberships.isEmpty() && platformPermissions.isEmpty()`):**
          Throws `invalidCredentials()` (`BadCredentialsException("Invalid login credentials")`). Protects against logins by accounts with no active tenant memberships and no platform rights.
4. **Session Creation & Refresh Token Generation:**
   - Generates raw refresh token via `secureTokenGenerator.generate()`.
   - Hashes raw token with SHA-256 via `tokenHasher.hash(...)`.
   - Evaluates lifetime: `request.rememberMe() ? sessionProperties.rememberMeTtl() : sessionProperties.refreshTokenTtl()`.
   - Instantiates [`UserSession.issue(...)`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/domain/UserSession.java#L98) with `organization` (or `null` if platform).
   - Persists immediately via `userSessionRepository.saveAndFlush(userSession)` to ensure the database-generated `id` is present.
5. **Access Token Issuance:**
   - Calls `jwtTokenService.issueAccessToken(user.getId(), userSession.getId(), organizationId, permissions)`.
6. **Response Assembly:**
   - If `organization != null`, creates `LoginResponse.OrganizationSummary(organization.getId(), organization.getCode(), organization.getName())`; otherwise `null`.
   - Returns complete [`LoginResponse`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/api/dto/LoginResponse.java).

---

## 4. [`UserSession.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/domain/UserSession.java)

**Path:** `src/main/java/com/privox_grc_api/usermanagement/authentication/domain/UserSession.java`
**Table:** `global.sessions`

### Entity Schema & Mapping
| Property | Column | Type | Nullable | Notes |
|---|---|---|---|---|
| `id` | `id` | `UUID` | No | PK, generated via `GenerationType.UUID`. Used as JWT `sid` claim. |
| `user` | `user_id` | `UUID` | No | Foreign key to `global.users(id)`. Lazy fetch. |
| `activeOrganization` | `active_organization_id` | `UUID` | **Yes** | Foreign key to `global.organizations(id)`. **Null for platform-only sessions.** |
| `refreshTokenHash` | `refresh_token_hash` | `VARCHAR(255)` | No | SHA-256 hex digest of the refresh token. The raw token is never stored. |
| `rememberMe` | `remember_me` | `BOOLEAN` | No | Distinguishes normal vs remember-me session TTLs. |
| `issuedAt` | `issued_at` | `TIMESTAMPTZ` | No | Initial issuance timestamp. |
| `expiresAt` | `expires_at` | `TIMESTAMPTZ` | No | Absolute expiration timestamp (`issuedAt + lifetime`). |
| `lastSeenAt` | `last_seen_at` | `TIMESTAMPTZ` | Yes | Updated upon activity and refresh token rotation. |
| `revokedAt` | `revoked_at` | `TIMESTAMPTZ` | Yes | Non-null timestamp indicates soft revocation. |
| `ipAddress` | `ip_address` | `INET` | Yes | Mapped using Hibernate `@JdbcTypeCode(SqlTypes.INET)`. |
| `userAgent` | `user_agent` | `TEXT` | Yes | Normalized HTTP User-Agent string. |
| `createdAt` | `created_at` | `TIMESTAMPTZ` | No | `@CreationTimestamp(source = SourceType.DB)`, immutable. |

### Domain Methods
- `isUsableAt(Instant time)`: Returns `!isRevoked() && !isExpiredAt(time)`.
- `rotateRefreshToken(String newRefreshTokenHash)`: Verifies `isUsableAt(now)`, updates `refreshTokenHash`, updates `lastSeenAt = now`.
- `revoke()`: Sets `revokedAt = Instant.now()` if null (idempotent).
- `recordActivity()`: Verifies usable status and bumps `lastSeenAt`.

---

## 5. [`GroupPermissionRepository.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/infrastructure/GroupPermissionRepository.java)

**Path:** `src/main/java/com/privox_grc_api/usermanagement/authorization/infrastructure/GroupPermissionRepository.java`

Provides the two core native SQL queries for resolving effective permission codes.

### 5.1 Organization-Scoped Query: `findEffectivePermissionCodes`

```sql
SELECT DISTINCT permission.code
FROM global.group_members member

INNER JOIN global.groups access_group
    ON access_group.id = member.group_id

INNER JOIN global.group_permissions group_permission
    ON group_permission.group_id = access_group.id

INNER JOIN global.permissions permission
    ON permission.id = group_permission.permission_id

LEFT JOIN global.modules module
    ON module.id = permission.module_id

WHERE member.user_id = :userId
    AND (
      access_group.organization_id = :organizationId
      OR access_group.organization_id IS NULL
    )
    AND access_group.scope_type IN ('ORGANIZATION', 'PLATFORM')
    AND access_group.is_active = TRUE
    AND permission.scope_type IN ('ORGANIZATION', 'PLATFORM', 'BOTH')
    AND permission.is_active = TRUE
    AND (
      permission.module_id IS NULL
      OR (
          module.is_active = TRUE
          AND EXISTS (
              SELECT 1
              FROM global.organization_modules organization_module
              WHERE organization_module.organization_id = :organizationId
                AND organization_module.module_id = permission.module_id
                AND organization_module.is_enabled = TRUE
          )
      )
    )
ORDER BY permission.code;
```

#### Query Semantics:
1. **Group Scope:** Includes groups belonging to the organization (`access_group.organization_id = :organizationId`) **and** system-default or platform groups without an organization ID (`access_group.organization_id IS NULL`).
2. **Permission Scope:** Allows permissions marked `ORGANIZATION`, `PLATFORM`, or `BOTH`.
3. **Module Gating:** If a permission has an associated `module_id`, the module must be globally active AND explicitly enabled for `:organizationId` in `global.organization_modules`. Core/ungated permissions (`module_id IS NULL`) are always granted.

---

### 5.2 Platform-Scoped Query: `findPlatformEffectivePermissionCodes`

```sql
SELECT DISTINCT permission.code
FROM global.group_members member

INNER JOIN global.groups access_group
    ON access_group.id = member.group_id

INNER JOIN global.group_permissions group_permission
    ON group_permission.group_id = access_group.id

INNER JOIN global.permissions permission
    ON permission.id = group_permission.permission_id

LEFT JOIN global.modules module
    ON module.id = permission.module_id

WHERE member.user_id = :userId
  AND access_group.organization_id IS NULL
  AND access_group.scope_type = 'PLATFORM'
  AND access_group.is_active = TRUE
  AND permission.scope_type IN ('PLATFORM', 'BOTH')
  AND permission.is_active = TRUE
  AND (
    permission.module_id IS NULL
    OR module.is_active = TRUE
  )
ORDER BY permission.code;
```

#### Query Semantics:
1. **Strict Platform Scoping:** Filters exclusively for groups with `organization_id IS NULL` and `scope_type = 'PLATFORM'`.
2. **Permission Scoping:** Filters for `permission.scope_type IN ('PLATFORM', 'BOTH')`.
3. **Module Independence:** Does NOT check `global.organization_modules` because platform administrators operate across all tenants and do not subscribe to individual organization modules. A module-gated platform permission is active if the module is globally active (`module.is_active = TRUE`).

---

## 6. [`JwtTokenService.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/jwt/JwtTokenService.java)

**Path:** `src/main/java/com/privox_grc_api/security/jwt/JwtTokenService.java`

### Signature
```java
public AccessToken issueAccessToken(UUID userId, UUID sessionId, UUID organizationId, Collection<String> permissions)
```

### Claims Payload
- `iss`: Configured issuer string (`app.security.jwt.issuer`, default `"privox-grc-api"`).
- `sub`: User ID as string UUID.
- `iat`: Issuance UTC instant (`Instant.now()`).
- `exp`: Expiration UTC instant (`iat + accessTokenTtl`).
- `jti`: Random unique token ID (`UUID.randomUUID().toString()`).
- `sid`: Server-side session ID (`sessionId.toString()`). Binds the stateless JWT directly to the stateful record in `global.sessions`.
- `token_type`: Constant string `"access"`.
- `permissions`: Deterministic, trimmed, de-duplicated, and sorted list of permission codes.
- `org`: **Conditionally populated.** Included as string UUID only when `organizationId != null`. Omitted completely for platform-admin tokens.

### Signing Algorithm
Signed with **RS256** (RSA signature with SHA-256) using Nimbus JOSE `JwtEncoder` with private key loaded from `classpath:keys/private.pem`.

---

## 7. [`JwtConfiguration.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/jwt/JwtConfiguration.java)

**Path:** `src/main/java/com/privox_grc_api/security/jwt/JwtConfiguration.java`

### Beans Configured
1. `jwtPublicKey` / `jwtPrivateKey`: Loads RSA keys (PKCS#8 for private key, X.509 for public key).
2. `jwtEncoder`: `NimbusJwtEncoder.withKeyPair(publicKey, privateKey)` for RS256 token issuance.
3. `jwtDecoder`: `NimbusJwtDecoder.withPublicKey(publicKey)` configured with `JwtValidators.createDefaultWithIssuer(issuer)`. Validates signature, token expiration, and issuer.
4. `jwtAuthenticationConverter`: Configures a `JwtGrantedAuthoritiesConverter`:
   - `setAuthoritiesClaimName("permissions")`: Extracts authority strings directly from the `permissions` claim.
   - `setAuthorityPrefix("")`: Removes Spring's default `SCOPE_` prefix.
   - Result: Spring Security authorities directly match permission strings (e.g., `hasAuthority("user.view")` or `hasAuthority("platform.organization.approve")`).

---

## 8. [`UserSessionRepository.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/infrastructure/UserSessionRepository.java)

**Path:** `src/main/java/com/privox_grc_api/usermanagement/authentication/infrastructure/UserSessionRepository.java`

### Locking & Concurrency Control
1. **`findActiveByRefreshTokenHashForUpdate(String refreshTokenHash)`**:
   - Uses `@Lock(LockModeType.PESSIMISTIC_WRITE)` (`SELECT ... FOR UPDATE`).
   - Uses `JOIN FETCH session.user` and **`LEFT JOIN FETCH session.activeOrganization`**.
   - The `LEFT JOIN` is critical because it seamlessly loads sessions whether `active_organization_id` is populated or `NULL`.
   - Filters out soft-revoked sessions via `session.revokedAt IS NULL`.
2. **`findByIdForUpdate(UUID sessionId)`**:
   - Uses `@Lock(LockModeType.PESSIMISTIC_WRITE)`.
   - Used by [`LogoutService`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/application/LogoutService.java) to avoid concurrent revocation races.
3. **`revokeAllActiveSessionsByUserId(UUID userId, Instant revokedAt)`**:
   - Bulk update modifying all active sessions for a user upon password reset.
   - Stamped with `@Modifying(clearAutomatically = true, flushAutomatically = true)`.

---

## 9. Supporting Authentication & Authorization Components

### 9.1 [`RefreshTokenService.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/application/RefreshTokenService.java)
- Fully supports both organization-scoped sessions and platform-only sessions.
- In `validateOrganization(Organization organization)`: explicitly documents that a `null` organization is valid for platform sessions.
- In `validateMembership(UUID userId, UUID organizationId)`: immediately returns if `organizationId == null`.
- Rotates the refresh token on every invocation (one-time use semantics).

### 9.2 [`LogoutService.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/application/LogoutService.java)
- Extracts `sub` and `sid` from the authenticated JWT.
- Performs optimistic/pessimistic lock on the session and checks user ownership before setting `revokedAt`.
- Completely org-agnostic; operates identically for platform and tenant sessions.

### 9.3 [`DatabaseUserDetailsService.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authentication/DatabaseUserDetailsService.java) & [`PrivoxUserPrincipal.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authentication/PrivoxUserPrincipal.java)
- Implements Spring Security's `UserDetailsService`.
- Looks up users by email or username ignoring case.
- [`PrivoxUserPrincipal`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authentication/PrivoxUserPrincipal.java) exposes `isEnabled()` (`status == UserStatus.ACTIVE`) and `isAccountNonLocked()` (`lockedUntil == null || !lockedUntil.isAfter(now)`).
- Intentionally assigns no granted authorities (`getAuthorities()` returns empty list). Granted authorities are resolved only after organization context is established and encoded in the JWT.

### 9.4 [`OrganizationAccessChecker.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authorization/OrganizationAccessChecker.java)
- Spring bean `@organizationAccessChecker`.
- Evaluated in route security annotations:
  ```java
  @PreAuthorize("hasAuthority('...') and @organizationAccessChecker.matches(#organizationId, authentication)")
  ```
- Extracts `org` claim from `JwtAuthenticationToken`.
- If `org` claim is missing, blank, or does not equal the target `#organizationId`, it returns `false` (fails closed). This provides cryptographic tenant isolation across all org-scoped controller endpoints.

### 9.5 [`NodeScopeAuthorization.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authorization/NodeScopeAuthorization.java)
- Provides node-level authorization primitives (e.g., `@nodeScopeAuthorization.isOrgNodeLeaderAt(#orgNodeId, authentication)`).
- **Design rationale:** System-default groups like `ORG_NODE_LEADER`, `RISK_CONTRIBUTOR`, and `RISK_APPROVER` are deliberately given zero permissions in `global.group_permissions`. If permissions were attached to these groups, `findEffectivePermissionCodes` would promote those permissions into org-wide JWT claims at login, granting members tree-wide administrative authority. Instead, these groups are evaluated at runtime by checking direct group membership combined with placement in `global.org_node_members`.

### 9.6 [`PasswordRecoveryService.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/application/PasswordRecoveryService.java)
- Handles `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password`.
- Uses SHA-256 token hashing (`PasswordResetToken`). Token lifetime configured via `app.security.password-reset-token-ttl` (default 30 minutes).
- Security feature: Upon successful password reset, `userSessionRepository.revokeAllActiveSessionsByUserId(user.getId(), currentTime)` immediately soft-revokes all existing sessions across all devices.

### 9.7 [`OrganizationInvitationService.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/application/OrganizationInvitationService.java) & [`InvitationAcceptanceController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/InvitationAcceptanceController.java)
- Manages user invitations (`global.invitations`).
- `GET /api/v1/auth/invitations/{token}`: Public token inspection.
- `POST /api/v1/auth/invitations/{token}/accept`: Accepts invitation, registers new user if needed, creates active membership in `global.organization_users`, and assigns the designated access group. Note: acceptance does not return JWT tokens directly; the user must follow up with `POST /api/v1/auth/login`.

### 9.8 [`AuthenticationExceptionHandler.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/shared/exception/AuthenticationExceptionHandler.java)
- Catches all Spring Security `AuthenticationException` instances (such as `BadCredentialsException` or `UsernameNotFoundException`).
- Uniformly maps them to HTTP 401 with payload:
  ```json
  {
    "timestamp": "2026-09-18T12:00:00Z",
    "status": 401,
    "code": "INVALID_CREDENTIALS",
    "message": "The login credentials are invalid.",
    "path": "/api/v1/auth/login"
  }
  ```
- Prevents username enumeration by obscuring whether the user exists, whether the password was incorrect, or whether membership was inactive.

---

## 10. Implementation Status & Flagged Observations

### 10.1 Status of Platform-Admin Login
Platform-admin authentication without an organization context **has been successfully implemented and integrated** across the login, refresh, session, and permission layers:
- `LoginRequest.organizationId` is optional.
- `AuthenticationService.login` implements the platform branch when `organizationId == null`.
- `GroupPermissionRepository.findPlatformEffectivePermissionCodes` resolves platform permissions without tenant module gating.
- `RefreshTokenService` rotates and refreshes platform sessions without requiring an organization context.
- Unit and integration tests in [`AuthenticationIntegrationTest.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/test/java/com/privox_grc_api/usermanagement/authentication/AuthenticationIntegrationTest.java) verify both valid platform logins and 401 rejections for non-platform users.

---

### 10.2 Flagged Architecture & Implementation Findings

> [!CAUTION]
> **Finding 1: `GET /api/v1/me` breaks for Platform Administrators**
>
> In [`CurrentUserService.java` (line 49)](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/application/CurrentUserService.java#L49):
> ```java
> UUID organizationId = parseRequiredUuid(jwt.getClaimAsString("org"), "org");
> ```
> Because platform access tokens omit the `org` claim, calling `GET /api/v1/me` throws `BadCredentialsException("Required JWT claim is missing: org")`. Handled by [`AuthenticationExceptionHandler`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/shared/exception/AuthenticationExceptionHandler.java), this returns HTTP 401 `INVALID_CREDENTIALS` to authenticated platform admins.
>
> **Recommended Remediation:**
> In `CurrentUserService.getCurrentUser`:
> 1. Parse `org` as optional.
> 2. If `org` claim is null, skip `organizationRepository` and `organizationUserRepository` lookups and return `CurrentUserResponse` with `organization = null`.
> 3. Ensure `CurrentUserResponse.OrganizationSummary` is nullable.

> [!WARNING]
> **Finding 2: Account Lockout & Failed Login Counting Not Incremented**
>
> The [`User`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/domain/User.java#L49-L53) entity defines `failedLoginCount` and `lockedUntil`, and [`PrivoxUserPrincipal.isAccountNonLocked()`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authentication/PrivoxUserPrincipal.java#L62-L64) inspects `lockedUntil`. However, neither [`AuthenticationService`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/application/AuthenticationService.java) nor an `AuthenticationFailureBadCredentialsEvent` listener increments `failedLoginCount` or locks the account upon successive failed login attempts. Account lockout is therefore non-operational.

> [!NOTE]
> **Finding 3: `User.lastLoginAt` Is Never Updated**
>
> Column `global.users.last_login_at` exists in the database schema and in the [`User`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/domain/User.java#L55-L56) entity, but is never updated inside [`AuthenticationService.login`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/application/AuthenticationService.java#L74-L146). While `UserSession.issuedAt` tracks session creation in `global.sessions`, the user profile field remains null.

> [!NOTE]
> **Finding 4: Client IP Resolution Behind Reverse Proxies**
>
> [`AuthenticationController.resolveIpAddress`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java#L95-L101) directly calls `request.getRemoteAddr()`. In environments running behind a reverse proxy, load balancer, or API gateway (e.g. Nginx, AWS ALB, Cloudflare), `request.getRemoteAddr()` returns the internal proxy IP rather than the client's real IP address unless Spring Boot is configured with `server.forward-headers-strategy=framework` or `native` and `X-Forwarded-For` is trusted.

> [!NOTE]
> **Finding 5: Unused Import in `LoginRequest.java`**
>
> In [`LoginRequest.java` (line 6)](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/api/dto/LoginRequest.java#L6), `import jakarta.validation.constraints.NotNull;` remains present as dead code following the removal of `@NotNull` on `organizationId`.

> [!NOTE]
> **Finding 6: Platform Session Querying & Revocation**
>
> [`UserSessionRepository`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/infrastructure/UserSessionRepository.java) provides `findAllByActiveOrganization_IdAndRevokedAtIsNull(UUID organizationId)` for org-wide session termination, but does not provide an equivalent method for listing or revoking platform-only sessions (`activeOrganization IS NULL`). Individual user session revocation via `revokeAllActiveSessionsByUserId` remains fully functional.
