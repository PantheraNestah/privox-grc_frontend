# Privox GRC API — Comprehensive Endpoints Reference Specification

This document provides complete technical documentation for all HTTP REST API endpoints available in the `privox-grc-api` service.

All endpoints adhere to REST conventions:
- **Base URL:** `http://localhost:8080` (default)
- **JSON Convention:** Request and response bodies are JSON formatted with timestamps in ISO-8601 UTC format.
- **Multitenancy Isolation:** Organization tenant endpoints use the path prefix `/api/v1/organizations/{organizationId}` and enforce tenant boundary matching via `@organizationAccessChecker.matches(#organizationId, authentication)` against the JWT `org` claim.
- **Platform Endpoints:** Platform administration endpoints use the path prefix `/api/v1/platform` and require platform-scoped authorities granted through platform access groups (`organization_id IS NULL`).

---

## High-Level API Directory

| Section | Route Prefix | Scope | Functional Groups |
|---|---|---|---|
| **[1. Authentication & Session Management](#1-authentication--session-management-apiv1auth)** | `/api/v1/auth` | Public & Authenticated | Login, Token Refresh, Logout, Password Recovery, Invitation Inspection & Acceptance |
| **[2. Platform Administration](#2-platform-administration-apiv1platform)** | `/api/v1/platform` | Platform Admin | Platform Organization Lifecycle, Platform Modules Catalog, Org Module Subscriptions, Org-Node Templates |
| **[3. Organization Tenant Operations](#3-organization-tenant-operations-apiv1organizations)** | `/api/v1/organizations` | Tenant Scoped | Organization Profile, Members, Invitations, Access Groups, Group Memberships, Module Visibility, Org Tree Hierarchy, Approval Level Rules, Node Placement, Risk Strategy Formulation |
| **[4. General & System Services](#4-general--system-services)** | `/api/v1`, `/actuator` | User & Public | Current User (`/me`), Password Change, Permissions Catalog (`/permissions`), Health Checks |
| **[5. Common Data Structures & Error Shapes](#5-common-data-structures--error-shapes)** | Cross-cutting | System-wide | JWT Token Format, Standard Error Responses, Validation Error Formats |
| **[6. Flagged Issues & Architectural Concerns](#6-flagged-issues--architectural-concerns)** | Codebase Audit | Quality & Security | Discovered implementation bugs, dead code, and inconsistencies |

---

## 1. Authentication & Session Management (`/api/v1/auth`)

### 1.1 Credentials & Tokens

#### `POST /api/v1/auth/login`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java#L52-L60)
- **Authentication:** Public (`permitAll`)
- **Description:** Authenticates a user by email/username and password. If `organizationId` is supplied, issues an organization-scoped session and JWT token. If `organizationId` is omitted (`null`), issues a platform-admin session and JWT token without an `org` claim (requires user to possess active platform permissions).

**Request Body (`LoginRequest`):**
```json
{
  "identifier": "admin@icea.co.ke",
  "password": "Password@123",
  "organizationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "rememberMe": false
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `identifier` | `String` | Required, max 255 | User email or username (case-insensitive). |
| `password` | `String` | Required, max 255 | Plaintext password. |
| `organizationId` | `UUID` | Optional | Target organization ID. Omit for platform-admin login. |
| `rememberMe` | `boolean` | Optional (default: `false`) | When `true`, session TTL is 30 days (`rememberMeTtl`). When `false`, TTL is 1 day (`refreshTokenTtl`). |

**Response Body (`LoginResponse` — Status `200 OK`):**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "48b6c4b2-4d2c-473d-bc8e-940713b1f13b",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "accessTokenExpiresAt": "2026-09-18T13:15:00Z",
  "user": {
    "id": "278ec11f-82db-424f-9e79-5da709d17d0c",
    "email": "admin@icea.co.ke",
    "username": "icea.admin",
    "fullName": "ICEA Administrator"
  },
  "organization": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "code": "ICEA",
    "name": "ICEA Lion Group"
  },
  "permissions": [
    "orgnode.manage",
    "orgnode.view",
    "riskstrategy.manage",
    "riskstrategy.view",
    "user.view"
  ]
}
```
*Note: For platform-admin logins, `"organization"` is `null`.*

---

#### `POST /api/v1/auth/refresh`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java#L61-L68)
- **Authentication:** Public (`permitAll`)
- **Description:** Rotates the refresh token and mints a new RS256 JWT access token. Validates that the existing session is active and not soft-revoked. Previous refresh token is invalidated immediately upon rotation (single-use semantics).

**Request Body (`RefreshTokenRequest`):**
```json
{
  "refreshToken": "48b6c4b2-4d2c-473d-bc8e-940713b1f13b"
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `refreshToken` | `String` | Required, max 500 | Raw refresh token string provided at login or previous refresh. |

**Response Body (`RefreshTokenResponse` — Status `200 OK`):**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "a73ef4d1-8178-4395-8ba9-03c61309fec9",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "accessTokenExpiresAt": "2026-09-18T13:30:00Z",
  "permissions": [
    "orgnode.view",
    "riskstrategy.view"
  ]
}
```

---

#### `POST /api/v1/auth/logout`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java#L70-L74)
- **Authentication:** Authenticated (`Bearer <accessToken>`)
- **Description:** Soft-revokes the server-side session associated with the access token's `sid` claim. Sets `revoked_at = Instant.now()` in `global.sessions`. Ensures the caller cannot revoke sessions belonging to other users.
- **Request Body:** None
- **Response:** Status `204 No Content`

---

### 1.2 Password Recovery

#### `POST /api/v1/auth/forgot-password`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java#L76-L85)
- **Authentication:** Public (`permitAll`)
- **Description:** Initiates a password reset. If the user exists and is active/suspended, generates a secure random token, stores its SHA-256 hash in `global.password_reset_tokens` (TTL: 30 minutes), and sends the raw reset token via email. Returns a constant generic message to prevent email enumeration.

**Request Body (`ForgotPasswordRequest`):**
```json
{
  "email": "user@example.com"
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `email` | `String` | Required, valid email, max 255 | Registered account email address. |

**Response Body (`ForgotPasswordResponse` — Status `200 OK`):**
```json
{
  "message": "If an account exists for that email, password reset instructions have been sent."
}
```

---

#### `POST /api/v1/auth/reset-password`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java#L87-L93)
- **Authentication:** Public (`permitAll`)
- **Description:** Resets the account password using the token sent via email. Validates token freshness and unused status, encodes the new password via BCrypt (cost 12), marks the token as used, invalidates all other unused reset tokens for that user, and **revokes all existing active sessions** in `global.sessions`.

**Request Body (`ResetPasswordRequest`):**
```json
{
  "token": "d87a4bf0c9f143a598...",
  "newPassword": "NewSecurePassword@123",
  "confirmPassword": "NewSecurePassword@123"
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `token` | `String` | Required | Raw reset token from the email link. |
| `newPassword` | `String` | Required, 8–100 chars | New password string. |
| `confirmPassword` | `String` | Required, 8–100 chars | Password confirmation (must match `newPassword`). |

**Response Body (`ResetPasswordResponse` — Status `200 OK`):**
```json
{
  "message": "Password has been reset successfully. Please sign in again."
}
```

---

### 1.3 Public Invitation Inspection & Acceptance

#### `GET /api/v1/auth/invitations/{token}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/InvitationAcceptanceController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/InvitationAcceptanceController.java#L30-L36)
- **Authentication:** Public (`permitAll`)
- **Description:** Inspects details of a pending organization invitation given its raw token.
- **Path Variable:** `token` (String, required)

**Response Body (`InvitationDetailsResponse` — Status `200 OK`):**
```json
{
  "id": "98765432-1234-5678-90ab-cdef12345678",
  "organizationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "organizationName": "ICEA Lion Group",
  "email": "invited.user@icea.co.ke",
  "existingUser": false,
  "initialGroupId": "11111111-2222-3333-4444-555555555555",
  "expiresAt": "2026-09-25T12:00:00Z"
}
```

---

#### `POST /api/v1/auth/invitations/{token}/accept`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/InvitationAcceptanceController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/InvitationAcceptanceController.java#L38-L51)
- **Authentication:** Public (`permitAll`). May optionally include `Authorization: Bearer <token>` if the invited user is already authenticated.
- **Description:** Accepts an invitation. For new users, creates and activates a global `User` account. For existing users, joins them into the organization. Adds an active `OrganizationUser` membership and assigns the `initialGroupId`.
- **Path Variable:** `token` (String, required)

**Request Body (`AcceptInvitationRequest` — Optional if user already has an active account):**
```json
{
  "password": "Password@123",
  "confirmPassword": "Password@123",
  "fullName": "Jane Doe",
  "username": "jane.doe"
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `password` | `String` | Required for new users, 8–100 chars | Initial password. |
| `confirmPassword` | `String` | Required for new users | Password confirmation. |
| `fullName` | `String` | Required for new users, max 150 | Display full name. |
| `username` | `String` | Optional, max 100 | Desired username. |

**Response Body (`InvitationAcceptanceResponse` — Status `200 OK`):**
```json
{
  "userId": "278ec11f-82db-424f-9e79-5da709d17d0c",
  "organizationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "organizationName": "ICEA Lion Group",
  "email": "invited.user@icea.co.ke",
  "accountCreated": true,
  "status": "ACCEPTED"
}
```

---

## 2. Platform Administration (`/api/v1/platform`)

### 2.1 Platform Organizations

#### `POST /api/v1/platform/organizations`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java#L44-L51)
- **Authentication:** Public / Platform Admin
- **Description:** Registers an organization in `PENDING_VALIDATION` status. Duplicate codes or slugs are rejected with `409 Conflict`.

**Request Body (`RegisterOrganizationRequest`):**
```json
{
  "name": "Savanna Insurance Company",
  "code": "SIC",
  "slug": "savanna-insurance",
  "countryCode": "KE",
  "planTier": "ENTERPRISE"
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `name` | `String` | Required, max 200 | Organization corporate name. |
| `code` | `String` | Required, max 50 | Unique uppercase organization identifier code. |
| `slug` | `String` | Required, max 100, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` | URL-safe unique identifier. |
| `countryCode` | `String` | Required, exactly 2 chars | ISO 3166-1 alpha-2 country code (e.g. `KE`, `US`). |
| `planTier` | `String` | Optional, max 30 | Subscription tier. |

**Response Body (`PlatformOrganizationResponse` — Status `201 Created`):**
```json
{
  "id": "e4b6c31a-5f90-4e31-897b-9d620573eef0",
  "name": "Savanna Insurance Company",
  "code": "SIC",
  "slug": "savanna-insurance",
  "planTier": "ENTERPRISE",
  "countryCode": "KE",
  "status": "PENDING_VALIDATION",
  "validatedByUserId": null,
  "validatedAt": null,
  "validationNotes": null,
  "createdAt": "2026-09-18T10:00:00Z",
  "updatedAt": "2026-09-18T10:00:00Z",
  "deactivatedAt": null
}
```

---

#### `GET /api/v1/platform/organizations`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java#L54-L60)
- **Authorization:** `@PreAuthorize("hasAuthority('platform.organization.view')")`
- **Description:** Lists all registered organizations across the platform.
- **Query Parameter:** `status` (Enum: `PENDING_VALIDATION`, `ACTIVE`, `SUSPENDED`, `REJECTED`, `DEACTIVATED` — Optional filter)
- **Response Body:** `List<PlatformOrganizationResponse>` (Status `200 OK`)

---

#### `GET /api/v1/platform/organizations/{organizationId}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java#L62-L67)
- **Authorization:** `@PreAuthorize("hasAuthority('platform.organization.view')")`
- **Description:** Retrieves detailed platform view of an organization by its ID.
- **Path Variable:** `organizationId` (UUID, required)
- **Response Body:** `PlatformOrganizationResponse` (Status `200 OK`)

---

#### `POST /api/v1/platform/organizations/{organizationId}/approve`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java#L70-L80)
- **Authorization:** `@PreAuthorize("hasAuthority('platform.organization.approve')")`
- **Description:** Approves a pending organization (`PENDING_VALIDATION` -> `ACTIVE`), records approval metadata, and automatically issues an invitation to the initial organization administrator.
- **Path Variable:** `organizationId` (UUID, required)

**Request Body (`ApproveOrganizationRequest`):**
```json
{
  "adminEmail": "admin@savanna.co.ke",
  "initialGroupId": "11111111-2222-3333-4444-555555555555",
  "notes": "KYC verified. Approved for onboarding."
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `adminEmail` | `String` | Required, valid email, max 255 | Email of the designated primary organization administrator. |
| `initialGroupId` | `UUID` | Optional | Initial access group to assign (defaults to `ORG_ADMIN`). |
| `notes` | `String` | Optional, max 1000 | Validation/audit notes. |

**Response Body (`ApproveOrganizationResponse` — Status `200 OK`):**
```json
{
  "organization": {
    "id": "e4b6c31a-5f90-4e31-897b-9d620573eef0",
    "name": "Savanna Insurance Company",
    "code": "SIC",
    "slug": "savanna-insurance",
    "planTier": "ENTERPRISE",
    "countryCode": "KE",
    "status": "ACTIVE",
    "validatedByUserId": "278ec11f-82db-424f-9e79-5da709d17d0c",
    "validatedAt": "2026-09-18T10:15:00Z",
    "validationNotes": "KYC verified. Approved for onboarding.",
    "createdAt": "2026-09-18T10:00:00Z",
    "updatedAt": "2026-09-18T10:15:00Z",
    "deactivatedAt": null
  },
  "invitation": {
    "id": "78912345-6789-0123-4567-890123456789",
    "organizationId": "e4b6c31a-5f90-4e31-897b-9d620573eef0",
    "userId": null,
    "email": "admin@savanna.co.ke",
    "initialGroupId": "11111111-2222-3333-4444-555555555555",
    "invitedByUserId": "278ec11f-82db-424f-9e79-5da709d17d0c",
    "status": "PENDING",
    "expiresAt": "2026-09-25T10:15:00Z",
    "createdAt": "2026-09-18T10:15:00Z"
  }
}
```

---

#### `POST /api/v1/platform/organizations/{organizationId}/reject`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java#L83-L93)
- **Authorization:** `@PreAuthorize("hasAuthority('platform.organization.reject')")`
- **Description:** Rejects an organization registration (`PENDING_VALIDATION` -> `REJECTED`).

**Request Body (`RejectOrganizationRequest`):**
```json
{
  "reason": "Failed regulatory documentation verification."
}
```
- **Response Body:** `PlatformOrganizationResponse` (Status `200 OK`)

---

#### `POST /api/v1/platform/organizations/{organizationId}/suspend`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java#L96-L101)
- **Authorization:** `@PreAuthorize("hasAuthority('platform.organization.suspend')")`
- **Description:** Suspends an active organization (`ACTIVE` -> `SUSPENDED`). Member logins are rejected while suspended.
- **Response Body:** `PlatformOrganizationResponse` (Status `200 OK`)

---

#### `POST /api/v1/platform/organizations/{organizationId}/reactivate`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java#L104-L109)
- **Authorization:** `@PreAuthorize("hasAuthority('platform.organization.reactivate')")`
- **Description:** Reactivates a suspended organization (`SUSPENDED` -> `ACTIVE`).
- **Response Body:** `PlatformOrganizationResponse` (Status `200 OK`)

---

#### `POST /api/v1/platform/organizations/{organizationId}/deactivate`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/PlatformOrganizationController.java#L112-L117)
- **Authorization:** `@PreAuthorize("hasAuthority('platform.organization.deactivate')")`
- **Description:** Permanently deactivates an organization (`DEACTIVATED`). Stamps `deactivated_at`. Terminal lifecycle state.
- **Response Body:** `PlatformOrganizationResponse` (Status `200 OK`)

---

### 2.2 Platform Modules Catalog

#### `GET /api/v1/platform/modules`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/module/apis/PlatformModuleController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/module/apis/PlatformModuleController.java#L23-L26)
- **Authorization:** `@PreAuthorize("isAuthenticated()")`
- **Description:** Lists all available modules in the global system catalog ordered by sort order.

**Response Body (`List<SystemModuleResponse>` — Status `200 OK`):**
```json
[
  {
    "id": "11111111-0000-0000-0000-000000000001",
    "code": "USER_MANAGEMENT",
    "name": "User Management",
    "description": "Core identity and access management",
    "active": true,
    "sortOrder": 1,
    "createdAt": "2026-07-18T10:00:00Z"
  },
  {
    "id": "11111111-0000-0000-0000-000000000002",
    "code": "GOVERNANCE",
    "name": "Governance & Risk Strategy",
    "description": "Organizational tree and risk strategy formulation",
    "active": true,
    "sortOrder": 2,
    "createdAt": "2026-07-18T10:00:00Z"
  }
]
```

---

### 2.3 Platform Organization Module Subscriptions

#### `GET /api/v1/platform/organizations/{organizationId}/modules`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/module/apis/PlatformOrganizationModuleController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/module/apis/PlatformOrganizationModuleController.java#L30-L36)
- **Authorization:** `@PreAuthorize("hasAuthority('platform.organization.view')")`
- **Description:** Returns all modules with enablement status for a specific organization from a platform admin perspective.
- **Path Variable:** `organizationId` (UUID, required)

**Response Body (`List<OrganizationModuleResponse>` — Status `200 OK`):**
```json
[
  {
    "id": "99999999-1111-2222-3333-444444444444",
    "moduleId": "11111111-0000-0000-0000-000000000002",
    "code": "GOVERNANCE",
    "name": "Governance & Risk Strategy",
    "description": "Organizational tree and risk strategy formulation",
    "sortOrder": 2,
    "enabled": true,
    "enabledAt": "2026-09-02T12:00:00Z",
    "disabledAt": null
  }
]
```

---

#### `POST /api/v1/platform/organizations/{organizationId}/modules/{moduleId}/enable`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/module/apis/PlatformOrganizationModuleController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/module/apis/PlatformOrganizationModuleController.java#L39-L49)
- **Authorization:** `@PreAuthorize("hasAuthority('platform.module.assign')")`
- **Description:** Enables a module subscription for an organization. Creates or updates `global.organization_modules`.
- **Path Variables:** `organizationId` (UUID), `moduleId` (UUID)
- **Response Body:** `OrganizationModuleResponse` (Status `200 OK`)

---

#### `POST /api/v1/platform/organizations/{organizationId}/modules/{moduleId}/disable`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/module/apis/PlatformOrganizationModuleController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/module/apis/PlatformOrganizationModuleController.java#L52-L59)
- **Authorization:** `@PreAuthorize("hasAuthority('platform.module.assign')")`
- **Description:** Disables a module for an organization. Org members lose module-gated permissions on their next token refresh.
- **Path Variables:** `organizationId` (UUID), `moduleId` (UUID)
- **Response Body:** `OrganizationModuleResponse` (Status `200 OK`)

---

### 2.4 Platform Org-Node Templates

#### `GET /api/v1/platform/org-node-templates`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/PlatformOrgNodeTemplateController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/PlatformOrgNodeTemplateController.java#L39-L44)
- **Authorization:** `@PreAuthorize("isAuthenticated()")`
- **Description:** Lists all platform org-node hierarchy templates available for organizations to clone.

**Response Body (`List<OrgNodeTemplateResponse>` — Status `200 OK`):**
```json
[
  {
    "id": "55555555-4444-3333-2222-111111111111",
    "name": "Standard Financial Institution Hierarchy",
    "description": "Board -> Executive -> Divisions -> Departments",
    "rootNodeId": "66666666-5555-4444-3333-222222222222",
    "createdAt": "2026-09-03T16:00:00Z"
  }
]
```

---

#### `GET /api/v1/platform/org-node-templates/{id}/preview`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/PlatformOrgNodeTemplateController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/PlatformOrgNodeTemplateController.java#L46-L52)
- **Authorization:** `@PreAuthorize("isAuthenticated()")`
- **Description:** Returns the nested tree representation of a template's node structure for frontend visualization.
- **Path Variable:** `id` (UUID, template ID)

**Response Body (`OrgNodeTemplatePreviewResponse` — Status `200 OK`):**
```json
{
  "id": "55555555-4444-3333-2222-111111111111",
  "name": "Standard Financial Institution Hierarchy",
  "description": "Standard bank / insurer hierarchy",
  "tree": {
    "name": "Group Holding Board",
    "type": "GROUP",
    "description": "Top-level board",
    "children": [
      {
        "name": "Retail Banking Company",
        "type": "COMPANY",
        "description": "Operating entity",
        "children": [
          {
            "name": "Credit Risk Department",
            "type": "DEPARTMENT",
            "description": "Risk division",
            "children": []
          }
        ]
      }
    ]
  }
}
```

---

#### `POST /api/v1/platform/org-node-templates`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/PlatformOrgNodeTemplateController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/PlatformOrgNodeTemplateController.java#L54-L67)
- **Authorization:** `@PreAuthorize("hasAuthority('platform.orgnode.manage')")`
- **Description:** Registers a new platform hierarchy template and creates its system-default nodes (`organization_id IS NULL`, `is_system_default = true`).

**Request Body (`RegisterOrgNodeTemplateRequest`):**
```json
{
  "name": "Insurance Enterprise Template",
  "description": "Standard insurance company structure",
  "rootNode": {
    "name": "Executive Board",
    "type": "GROUP",
    "description": "Board of directors",
    "children": [
      {
        "name": "Life Assurance Business Unit",
        "type": "COMPANY",
        "description": "Life insurance division",
        "children": []
      }
    ]
  }
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `name` | `String` | Required | Template name. |
| `description` | `String` | Optional | Template description. |
| `rootNode` | `OrgNodeTemplateNodeRequest` | Required | Root node structure and recursively nested children. |

- **Response:** Status `201 Created` with `Location` header to `.../{id}/preview` and body `OrgNodeTemplateResponse`.

---

## 3. Organization Tenant Operations (`/api/v1/organizations`)

### 3.1 Organization Profile

#### `POST /api/v1/organizations` (Public Self-Registration)
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/OrganizationRegistrationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/OrganizationRegistrationController.java#L27-L34)
- **Authentication:** Public (`permitAll`)
- **Description:** Public registration endpoint. Accepts `RegisterOrganizationRequest` and creates an organization in `PENDING_VALIDATION` status.
- **Response Body:** `PlatformOrganizationResponse` (Status `201 Created`)

---

#### `GET /api/v1/organizations/{organizationId}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/OrganizationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/OrganizationController.java#L30-L35)
- **Authorization:** `@PreAuthorize("hasAuthority('organization.view') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Retrieves the organization profile for the authenticated tenant.
- **Path Variable:** `organizationId` (UUID, required)

**Response Body (`OrganizationResponse` — Status `200 OK`):**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "ICEA Lion Group",
  "code": "ICEA",
  "slug": "icea-lion-group",
  "planTier": "ENTERPRISE",
  "countryCode": "KE",
  "status": "ACTIVE",
  "validatedAt": "2026-08-01T10:00:00Z",
  "validationNotes": "Initial verified setup",
  "createdAt": "2026-08-01T09:00:00Z",
  "updatedAt": "2026-08-01T10:00:00Z"
}
```

---

#### `PATCH /api/v1/organizations/{organizationId}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/OrganizationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/OrganizationController.java#L38-L45)
- **Authorization:** `@PreAuthorize("hasAuthority('organization.update') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Updates allowed profile attributes (name, slug, planTier, countryCode). Immutable: `code` and `schemaName`.

**Request Body (`UpdateOrganizationRequest`):**
```json
{
  "name": "ICEA Lion Insurance Holdings",
  "slug": "icea-lion-holdings",
  "planTier": "ENTERPRISE",
  "countryCode": "KE"
}
```
- **Response Body:** `OrganizationResponse` (Status `200 OK`)

---

### 3.2 Organization Members

#### `GET /api/v1/organizations/{organizationId}/members`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/OrganizationMemberController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/OrganizationMemberController.java#L24-L30)
- **Authorization:** `@PreAuthorize("hasAuthority('user.view') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Lists all members enrolled in the organization.
- **Path Variable:** `organizationId` (UUID, required)

**Response Body (`List<OrganizationMemberResponse>` — Status `200 OK`):**
```json
[
  {
    "membershipId": "aabbccdd-1111-2222-3333-444455556666",
    "organizationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "userId": "278ec11f-82db-424f-9e79-5da709d17d0c",
    "email": "admin@icea.co.ke",
    "username": "icea.admin",
    "fullName": "ICEA Administrator",
    "userStatus": "ACTIVE",
    "membershipStatus": "ACTIVE",
    "primary": true,
    "joinedAt": "2026-08-01T10:00:00Z",
    "suspendedAt": null,
    "deactivatedAt": null,
    "userVersion": 1,
    "membershipVersion": 1,
    "userCreatedAt": "2026-08-01T10:00:00Z",
    "userUpdatedAt": "2026-08-01T10:00:00Z",
    "membershipCreatedAt": null,
    "membershipUpdatedAt": null
  }
]
```

---

#### `POST /api/v1/organizations/{organizationId}/members`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/user/apis/OrganizationMemberManagementController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/apis/OrganizationMemberManagementController.java#L32-L41)
- **Authorization:** `@PreAuthorize("hasAuthority('user.create') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Directly provisions an active user and active organization membership without going through the invitation flow. Automatically assigns the specified initial access group.

**Request Body (`CreateOrganizationMemberRequest`):**
```json
{
  "email": "officer@icea.co.ke",
  "username": "icea.officer",
  "fullName": "Compliance Officer",
  "password": "TempPassword@123",
  "initialGroupId": "11111111-2222-3333-4444-555555555555"
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `email` | `String` | Required, valid email, max 255 | User email address. |
| `username` | `String` | Optional, max 100 | Unique username. |
| `fullName` | `String` | Required, max 150 | User full name. |
| `password` | `String` | Required, 8–100 chars | Initial account password. |
| `initialGroupId` | `UUID` | Required | Group ID to assign. |

- **Response Body:** `OrganizationMemberResponse` (Status `201 Created`)

---

#### `PUT /api/v1/organizations/{organizationId}/members/{userId}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/user/apis/OrganizationMemberManagementController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/apis/OrganizationMemberManagementController.java#L43-L48)
- **Authorization:** `@PreAuthorize("hasAuthority('user.update') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Updates member profile details (email, username, full name). Deactivated members cannot be edited.

**Request Body (`UpdateOrganizationMemberRequest`):**
```json
{
  "email": "officer.updated@icea.co.ke",
  "username": "icea.officer.new",
  "fullName": "Senior Compliance Officer"
}
```
- **Response Body:** `OrganizationMemberResponse` (Status `200 OK`)

---

#### Member Lifecycle Transitions (`activate`, `suspend`, `reactivate`, `deactivate`)
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/user/apis/OrganizationMemberManagementController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/apis/OrganizationMemberManagementController.java#L50-L78)
- **Security Safeguard:** Users cannot suspend or deactivate their own membership (`authenticatedUserId != userId`).

| Endpoint | HTTP Method | Required Authority | Description |
|---|---|---|---|
| `.../members/{userId}/activate` | `POST` | `user.activate` | Activates pending membership (`PENDING` -> `ACTIVE`). Requires global user account to be active. |
| `.../members/{userId}/suspend` | `POST` | `user.suspend` | Suspends active member (`ACTIVE` -> `SUSPENDED`). Member cannot log into this organization. |
| `.../members/{userId}/reactivate` | `POST` | `user.reactivate` | Restores suspended member (`SUSPENDED` -> `ACTIVE`). |
| `.../members/{userId}/deactivate` | `POST` | `user.deactivate` | Permanently terminates member (`ACTIVE`/`SUSPENDED` -> `DEACTIVATED`). |

- **Response Body for all:** `OrganizationMemberResponse` (Status `200 OK`)

---

### 3.3 Organization Invitations

#### `POST /api/v1/organizations/{organizationId}/invitations`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/OrganizationInvitationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/OrganizationInvitationController.java#L34-L43)
- **Authorization:** `@PreAuthorize("hasAuthority('user.invite') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Issues an invitation to an email address. Rejects if the user already has active membership or an active pending invitation. Sends raw token via email.

**Request Body (`CreateOrganizationInvitationRequest`):**
```json
{
  "email": "new.analyst@icea.co.ke",
  "initialGroupId": "11111111-2222-3333-4444-555555555555"
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `email` | `String` | Required, valid email, max 255 | Invitee email address. |
| `initialGroupId` | `UUID` | Optional | Group to assign upon acceptance (defaults to `ORG_MEMBER`). |

**Response Body (`InvitationResponse` — Status `201 Created`):**
```json
{
  "id": "12345678-abcd-ef01-2345-6789abcdef01",
  "organizationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "userId": null,
  "email": "new.analyst@icea.co.ke",
  "initialGroupId": "11111111-2222-3333-4444-555555555555",
  "invitedByUserId": "278ec11f-82db-424f-9e79-5da709d17d0c",
  "status": "PENDING",
  "expiresAt": "2026-09-25T12:00:00Z",
  "createdAt": "2026-09-18T12:00:00Z"
}
```

---

#### `GET /api/v1/organizations/{organizationId}/invitations`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/OrganizationInvitationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/OrganizationInvitationController.java#L45-L52)
- **Authorization:** `@PreAuthorize("hasAuthority('user.view') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Query Parameter:** `status` (Enum: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED` — Optional)
- **Response Body:** `List<InvitationResponse>` (Status `200 OK`)

---

#### `POST /api/v1/organizations/{organizationId}/invitations/{invitationId}/resend`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/OrganizationInvitationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/OrganizationInvitationController.java#L54-L64)
- **Authorization:** `@PreAuthorize("hasAuthority('user.invite') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Revokes the existing pending invitation and generates a brand new invitation with a fresh 7-day token.
- **Response Body:** `InvitationResponse` (Status `201 Created`)

---

#### `POST /api/v1/organizations/{organizationId}/invitations/{invitationId}/revoke`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/OrganizationInvitationController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/OrganizationInvitationController.java#L66-L73)
- **Authorization:** `@PreAuthorize("hasAuthority('user.invite') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Revokes a pending invitation (`REVOKED`). It can no longer be accepted.
- **Response Body:** `InvitationResponse` (Status `200 OK`)

---

### 3.4 Access Groups & Permissions

#### `GET /api/v1/organizations/{organizationId}/groups`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java#L39-L45)
- **Authorization:** `@PreAuthorize("hasAuthority('group.view') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Lists all groups visible in the organization, including custom organization groups and globally available system-default template groups.

**Response Body (`List<AccessGroupResponse>` — Status `200 OK`):**
```json
[
  {
    "id": "11111111-2222-3333-4444-555555555555",
    "code": "ORG_ADMIN",
    "name": "Organization Administrator",
    "description": "Full administrative rights within the organization",
    "scopeType": "ORGANIZATION",
    "systemDefault": true,
    "active": true,
    "memberCount": 2
  },
  {
    "id": "22222222-3333-4444-5555-666666666666",
    "code": "RISK_AUDITORS",
    "name": "Risk Audit Team",
    "description": "Read-only access to risk configurations",
    "scopeType": "ORGANIZATION",
    "systemDefault": false,
    "active": true,
    "memberCount": 5
  }
]
```

---

#### `GET /api/v1/organizations/{organizationId}/groups/{groupId}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java#L47-L52)
- **Authorization:** `@PreAuthorize("hasAuthority('group.view') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Returns group metadata and its assigned permissions.

**Response Body (`AccessGroupDetailResponse` — Status `200 OK`):**
```json
{
  "id": "22222222-3333-4444-5555-666666666666",
  "code": "RISK_AUDITORS",
  "name": "Risk Audit Team",
  "description": "Read-only access to risk configurations",
  "scopeType": "ORGANIZATION",
  "systemDefault": false,
  "active": true,
  "memberCount": 5,
  "permissions": [
    {
      "id": "33333333-4444-5555-6666-777777777777",
      "code": "riskstrategy.view",
      "name": "View Risk Strategy",
      "scopeType": "ORGANIZATION"
    }
  ]
}
```

---

#### `POST /api/v1/organizations/{organizationId}/groups`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java#L54-L68)
- **Authorization:** `@PreAuthorize("hasAuthority('group.create') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Creates a custom access group scoped to the organization.

**Request Body (`CreateAccessGroupRequest`):**
```json
{
  "code": "RISK_COMMITTEE",
  "name": "Risk Oversight Committee",
  "description": "Executive committee reviewing high-impact risks"
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `code` | `String` | Required, max 100, regex `^[A-Za-z][A-Za-z0-9_]*$` | Unique code within organization. |
| `name` | `String` | Required, max 150 | Descriptive name. |
| `description` | `String` | Optional | Detailed description. |

- **Response:** Status `201 Created` with body `AccessGroupResponse`. *(See §6.2 regarding `Location` header issue)*.

---

#### `PATCH /api/v1/organizations/{organizationId}/groups/{groupId}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java#L70-L77)
- **Authorization:** `@PreAuthorize("hasAuthority('group.update') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Updates group name and description. System-default groups cannot be modified.

**Request Body (`UpdateAccessGroupRequest`):**
```json
{
  "name": "Updated Risk Committee",
  "description": "Updated committee scope"
}
```
- **Response Body:** `AccessGroupResponse` (Status `200 OK`)

---

#### `POST /api/v1/organizations/{organizationId}/groups/{groupId}/activate` & `deactivate`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java#L79-L93)
- **Authorization:** `@PreAuthorize("hasAuthority('group.activate')")` / `hasAuthority('group.deactivate')`
- **Description:** Toggles active status of custom groups. Deactivated groups grant no permissions during token issuance.
- **Response Body:** `AccessGroupResponse` (Status `200 OK`)

---

#### `GET /api/v1/organizations/{organizationId}/groups/{groupId}/permissions`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java#L95-L102)
- **Authorization:** `@PreAuthorize("hasAuthority('group.view') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Lists permissions assigned to the group.

**Response Body (`List<PermissionResponse>` — Status `200 OK`):**
```json
[
  {
    "id": "33333333-4444-5555-6666-777777777777",
    "moduleId": "11111111-0000-0000-0000-000000000002",
    "code": "riskstrategy.view",
    "name": "View Risk Strategy",
    "description": "Allows viewing risk strategy configs",
    "scopeType": "ORGANIZATION"
  }
]
```

---

#### `PUT /api/v1/organizations/{organizationId}/groups/{groupId}/permissions`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java#L104-L115)
- **Authorization:** `@PreAuthorize("hasAuthority('group.assign_permissions') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Replaces all permissions assigned to a group atomically. System-default groups cannot have permissions reassigned via this endpoint.

**Request Body (`ReplaceGroupPermissionsRequest`):**
```json
{
  "permissionIds": [
    "33333333-4444-5555-6666-777777777777",
    "44444444-5555-6666-7777-888888888888"
  ]
}
```
- **Response Body:** `List<PermissionResponse>` (Status `200 OK`)

---

### 3.5 Group Memberships

#### `POST /api/v1/organizations/{organizationId}/groups/{groupId}/members`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/GroupMemberController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/GroupMemberController.java#L34-L49)
- **Authorization:** `@PreAuthorize("hasAuthority('group.manage_members') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Enrolls an organization member into an access group.

**Request Body (`AddGroupMemberRequest`):**
```json
{
  "userId": "278ec11f-82db-424f-9e79-5da709d17d0c"
}
```
**Response Body (`GroupMemberResponse` — Status `201 Created`):**
```json
{
  "membershipId": "66666666-7777-8888-9999-000011112222",
  "groupId": "22222222-3333-4444-5555-666666666666",
  "groupCode": "RISK_AUDITORS",
  "groupName": "Risk Audit Team",
  "userId": "278ec11f-82db-424f-9e79-5da709d17d0c",
  "email": "auditor@icea.co.ke",
  "username": "icea.auditor",
  "fullName": "Senior Auditor",
  "addedByUserId": "11111111-1111-1111-1111-111111111111",
  "createdAt": "2026-09-18T13:00:00Z"
}
```

---

#### `GET /api/v1/organizations/{organizationId}/groups/{groupId}/members`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/GroupMemberController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/GroupMemberController.java#L51-L58)
- **Authorization:** `@PreAuthorize("hasAuthority('group.view') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Lists all users enrolled in the specified access group.
- **Response Body:** `List<GroupMemberResponse>` (Status `200 OK`)

---

#### `DELETE /api/v1/organizations/{organizationId}/groups/{groupId}/members/{userId}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/GroupMemberController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/GroupMemberController.java#L60-L65)
- **Authorization:** `@PreAuthorize("hasAuthority('group.manage_members') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Removes a user from an access group.
- **Response:** Status `204 No Content`

---

### 3.6 Member Group Assignments

#### `GET /api/v1/organizations/{organizationId}/members/{userId}/groups`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/OrganizationMemberGroupController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/OrganizationMemberGroupController.java#L24-L32)
- **Authorization:** `@PreAuthorize("hasAuthority('group.view') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Lists all access groups to which a specific organization member belongs.

**Response Body (`List<UserGroupResponse>` — Status `200 OK`):**
```json
[
  {
    "groupMembershipId": "66666666-7777-8888-9999-000011112222",
    "groupId": "22222222-3333-4444-5555-666666666666",
    "code": "RISK_AUDITORS",
    "name": "Risk Audit Team",
    "description": "Read-only access to risk configurations",
    "scopeType": "ORGANIZATION",
    "systemDefault": false,
    "active": true,
    "addedByUserId": "11111111-1111-1111-1111-111111111111",
    "assignedAt": "2026-09-18T13:00:00Z"
  }
]
```

---

### 3.7 Organization Modules

#### `GET /api/v1/organizations/{organizationId}/modules`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/module/apis/OrganizationModuleController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/module/apis/OrganizationModuleController.java#L25-L31)
- **Authorization:** `@PreAuthorize("hasAuthority('user.view') and @organizationAccessChecker.matches(#organizationId, authentication)")`
- **Description:** Returns all modules currently enabled for this organization.
- **Response Body:** `List<OrganizationModuleResponse>` (Status `200 OK`)

---

### 3.8 Organizational Hierarchy (`/api/v1/organizations/{organizationId}/org-nodes`)

#### `GET /api/v1/organizations/{organizationId}/org-nodes`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java#L44-L51)
- **Authorization:**
  ```java
  (hasAuthority('orgnode.view') or @nodeScopeAuthorization.isOrgNodeLeaderAt(#scopeRootNodeId, authentication))
  and @organizationAccessChecker.matches(#organizationId, authentication)
  and @organizationModuleAccessChecker.isEnabled(#organizationId, 'GOVERNANCE')
  ```
- **Description:** Lists all organizational nodes. If `scopeRootNodeId` query parameter is supplied, returns only that node and its subtree descendants.

**Response Body (`List<OrgNodeResponse>` — Status `200 OK`):**
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organizationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "parentId": null,
    "name": "ICEA Lion Holdings",
    "type": "GROUP",
    "description": "Head holding group entity",
    "headcount": 1200,
    "location": "Nairobi, Kenya",
    "riskRating": "HIGH",
    "regulatoryBody": "Insurance Regulatory Authority (IRA)",
    "contactEmail": "info@icea.co.ke",
    "costCenterCode": "CC-001",
    "metadata": { "taxId": "P051234567Z" },
    "effectiveFrom": "2026-01-01T00:00:00Z",
    "effectiveTo": null,
    "createdAt": "2026-09-02T10:00:00Z",
    "updatedAt": "2026-09-02T10:00:00Z"
  }
]
```

---

#### `GET /api/v1/organizations/{organizationId}/org-nodes/{nodeId}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java#L53-L57)
- **Authorization:** `(hasAuthority('orgnode.view') or @nodeScopeAuthorization.isOrgNodeLeaderAt(#nodeId, authentication))`
- **Description:** Returns detailed attributes for an individual organizational node.
- **Response Body:** `OrgNodeResponse` (Status `200 OK`)

---

#### `POST /api/v1/organizations/{organizationId}/org-nodes`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java#L59-L71)
- **Authorization:** `(hasAuthority('orgnode.manage') or (#request.parentId != null and @nodeScopeAuthorization.isOrgNodeLeaderAt(#request.parentId, authentication)))`
- **Description:** Creates a new organizational node. Automatically maintains the transitive closure table in `global.org_node_closure`.

**Request Body (`CreateOrgNodeRequest`):**
```json
{
  "parentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "General Insurance Division",
  "type": "COMPANY",
  "description": "General and commercial insurance operations",
  "headcount": 450,
  "location": "Nairobi, Upper Hill",
  "riskRating": "MEDIUM",
  "regulatoryBody": "IRA",
  "contactEmail": "general@icea.co.ke",
  "costCenterCode": "CC-010",
  "metadata": { "costCenter": "1002" }
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `parentId` | `UUID` | Optional | Parent node ID. When null, creates a top-level root node. |
| `name` | `String` | Required | Node name. |
| `type` | `OrgNodeType` | Required | Enum: `GROUP`, `COMPANY`, `DEPARTMENT`, `DIVISION`, `SECTION`, `PROCESS`, `SUB_PROCESS`. |
| `description` | `String` | Optional | Detailed node description. |
| `headcount` | `Integer` | Optional, min 0 | Headcount allocation. |
| `location` | `String` | Optional | Physical/geographical location. |
| `riskRating` | `RiskRating` | Optional | Enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. |
| `regulatoryBody` | `String` | Optional | Governing regulatory agency. |
| `contactEmail` | `String` | Optional, valid email | Contact email. |
| `costCenterCode` | `String` | Optional | Cost center code. |
| `metadata` | `Map<String, Object>` | Optional | Key-value extensible attributes. |

- **Response:** Status `201 Created` with `Location` header to `.../org-nodes/{nodeId}` and body `OrgNodeResponse`.

---

#### `PATCH /api/v1/organizations/{organizationId}/org-nodes/{nodeId}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java#L73-L81)
- **Authorization:** `(hasAuthority('orgnode.manage') or @nodeScopeAuthorization.isOrgNodeLeaderAt(#nodeId, authentication))`
- **Description:** Updates non-structural metadata of an existing node.

**Request Body (`UpdateOrgNodeRequest`):**
```json
{
  "name": "General & Commercial Insurance Division",
  "type": "COMPANY",
  "description": "Expanded commercial insurance operations",
  "headcount": 520,
  "location": "Nairobi, Upper Hill",
  "riskRating": "HIGH",
  "regulatoryBody": "IRA",
  "contactEmail": "commercial@icea.co.ke",
  "costCenterCode": "CC-010",
  "metadata": { "costCenter": "1002" }
}
```
- **Response Body:** `OrgNodeResponse` (Status `200 OK`)

---

#### `POST /api/v1/organizations/{organizationId}/org-nodes/clone-template`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java#L83-L95)
- **Authorization:** `@PreAuthorize("hasAuthority('orgnode.manage') and @organizationAccessChecker.matches(#targetOrganizationId, authentication) and @organizationModuleAccessChecker.isEnabled(#targetOrganizationId, 'GOVERNANCE')")`
- **Description:** Deep-copies an entire platform template subtree into the tenant organization, preserving internal hierarchies and attaching the copied root under `targetParentId`.

**Request Body (`CloneOrgNodeTemplateRequest`):**
```json
{
  "templateId": "55555555-4444-3333-2222-111111111111",
  "targetParentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `templateId` | `UUID` | Required | ID of the platform org-node template to clone. |
| `targetParentId` | `UUID` | Optional | Parent node to attach the cloned subtree under. Null attaches as a root node. |

- **Response Body:** `OrgNodeResponse` of the cloned root node (Status `201 Created`)

---

#### `POST /api/v1/organizations/{organizationId}/org-nodes/{nodeId}/move`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java#L97-L102)
- **Authorization:** `@PreAuthorize("hasAuthority('orgnode.manage')")`
- **Description:** Moves a node and its entire subtree under a new parent. Enforces cycle detection via `global.org_node_closure` (moving a node under one of its own descendants throws `409 Conflict` `ORG_NODE_CYCLE`).

**Request Body (`MoveOrgNodeRequest`):**
```json
{
  "newParentId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```
- **Response Body:** `OrgNodeResponse` (Status `200 OK`)

---

#### `DELETE /api/v1/organizations/{organizationId}/org-nodes/{nodeId}` (Soft Delete)
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java#L104-L108)
- **Authorization:** `(hasAuthority('orgnode.manage') or @nodeScopeAuthorization.isOrgNodeLeaderAt(#nodeId, authentication))`
- **Description:** Sets `effective_to = Instant.now()`. Retains history and closure records.
- **Response:** Status `204 No Content`

---

#### `POST /api/v1/organizations/{organizationId}/org-nodes/{nodeId}/hard-delete`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java#L110-L114)
- **Authorization:** `@PreAuthorize("hasAuthority('orgnode.manage')")`
- **Description:** Permanently removes node from `global.org_nodes` and cleans up all related closure entries. Fails if node has children.
- **Response:** Status `204 No Content`

---

#### `GET /api/v1/organizations/{organizationId}/org-nodes/settings` & `PUT`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgNodeController.java#L116-L126)
- **Authorization:** `GET`: `hasAuthority('orgnode.view')`; `PUT`: `hasAuthority('orgnode.manage')`
- **Description:** Gets or updates tree validation settings (such as strict type hierarchy enforcement: `GROUP` -> `COMPANY` -> `DEPARTMENT` -> `DIVISION` -> `SECTION` -> `PROCESS` -> `SUB_PROCESS`).

**PUT Request Body (`UpdateOrgTreeSettingsRequest`):**
```json
{
  "strictTypeHierarchy": true
}
```
**Response Body (`OrgTreeSettingsResponse` — Status `200 OK`):**
```json
{
  "organizationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "strictTypeHierarchy": true
}
```

---

### 3.9 Approval-Level Routing Rules

#### `GET /api/v1/organizations/{organizationId}/org-nodes/approval-level-rules`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgApprovalLevelRuleController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgApprovalLevelRuleController.java#L33-L39)
- **Authorization:** `@PreAuthorize("hasAuthority('orgnode.view') and @organizationAccessChecker.matches(#organizationId, authentication) and @organizationModuleAccessChecker.isEnabled(#organizationId, 'GOVERNANCE')")`
- **Description:** Lists all approval-level escalation routing rules (e.g. from `DEPARTMENT` to `COMPANY`).

**Response Body (`List<OrgApprovalLevelRuleResponse>` — Status `200 OK`):**
```json
[
  {
    "sourceNodeType": "SECTION",
    "targetNodeType": "DEPARTMENT"
  },
  {
    "sourceNodeType": "DEPARTMENT",
    "targetNodeType": "COMPANY"
  }
]
```

---

#### `PUT /api/v1/organizations/{organizationId}/org-nodes/approval-level-rules/{sourceNodeType}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgApprovalLevelRuleController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgApprovalLevelRuleController.java#L41-L46)
- **Authorization:** `@PreAuthorize("hasAuthority('orgnode.manage')")`
- **Description:** Sets or updates the target approval node type for a source node type.

**Request Body (`SetOrgApprovalLevelRuleRequest`):**
```json
{
  "targetNodeType": "COMPANY"
}
```
- **Response Body:** `OrgApprovalLevelRuleResponse` (Status `200 OK`)

---

#### `DELETE /api/v1/organizations/{organizationId}/org-nodes/approval-level-rules/{sourceNodeType}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgApprovalLevelRuleController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgApprovalLevelRuleController.java#L48-L52)
- **Authorization:** `@PreAuthorize("hasAuthority('orgnode.manage')")`
- **Description:** Removes an approval routing rule.
- **Response:** Status `204 No Content`

---

#### `GET /api/v1/organizations/{organizationId}/org-nodes/{nodeId}/approval-node`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgApprovalLevelRuleController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/orgtree/apis/OrgApprovalLevelRuleController.java#L54-L61)
- **Authorization:** `@PreAuthorize("hasAuthority('orgnode.view')")`
- **Description:** Dynamically resolves the approving ancestor node for a given node based on the configured rules. Returns `200 OK` with `OrgNodeResponse`, or `204 No Content` if no rule applies or no matching ancestor exists.

---

### 3.10 Node Placements / Members

#### `GET /api/v1/organizations/{organizationId}/org-nodes/{nodeId}/members`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/shared/nodeassignment/apis/OrgNodeMemberController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/shared/nodeassignment/apis/OrgNodeMemberController.java#L33-L40)
- **Authorization:** `@PreAuthorize("hasAuthority('orgnode.view') and @organizationAccessChecker.matches(#organizationId, authentication) and @organizationModuleAccessChecker.isEnabled(#organizationId, 'GOVERNANCE')")`
- **Description:** Lists all members placed at a specific node in `global.org_node_members`.

**Response Body (`List<OrgNodeMemberResponse>` — Status `200 OK`):**
```json
[
  {
    "id": "11223344-5566-7788-9900-aabbccddeeff",
    "orgNodeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userId": "278ec11f-82db-424f-9e79-5da709d17d0c",
    "userEmail": "leader@icea.co.ke",
    "userFullName": "Division Leader",
    "effectiveFrom": "2026-09-02T10:00:00Z",
    "effectiveTo": null,
    "createdAt": "2026-09-02T10:00:00Z"
  }
]
```

---

#### `POST /api/v1/organizations/{organizationId}/org-nodes/{nodeId}/members`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/shared/nodeassignment/apis/OrgNodeMemberController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/shared/nodeassignment/apis/OrgNodeMemberController.java#L42-L52)
- **Authorization:** `(hasAuthority('orgnode.manage') or @nodeScopeAuthorization.isOrgNodeLeaderAt(#nodeId, authentication))`
- **Description:** Places an organization member at an organizational node. Placed members who are also members of system-default groups (`ORG_NODE_LEADER`, `RISK_CONTRIBUTOR`, `RISK_APPROVER`) gain node-scoped authority.

**Request Body (`PlaceOrgNodeMemberRequest`):**
```json
{
  "userId": "278ec11f-82db-424f-9e79-5da709d17d0c"
}
```
- **Response Body:** `OrgNodeMemberResponse` (Status `201 Created`)

---

#### `DELETE /api/v1/organizations/{organizationId}/org-nodes/{nodeId}/members/{userId}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/shared/nodeassignment/apis/OrgNodeMemberController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/shared/nodeassignment/apis/OrgNodeMemberController.java#L54-L59)
- **Authorization:** `(hasAuthority('orgnode.manage') or @nodeScopeAuthorization.isOrgNodeLeaderAt(#nodeId, authentication))`
- **Description:** Removes a member placement from a node.
- **Response:** Status `204 No Content`

---

### 3.11 Risk Strategy Formulation & Lifecycle

#### `GET /api/v1/organizations/{organizationId}/risk-strategy/current`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java#L49-L54)
- **Authorization:** `(hasAuthority('riskstrategy.view') or @riskStrategyAccessResolver.canReadOrgNodeOrDefault(#orgNodeId, authentication))`
- **Description:** Resolves the current active risk strategy configuration that applies to `orgNodeId`. If `orgNodeId` has an exact active version, it is returned. Otherwise, resolves via nearest-ancestor inheritance up to the org-wide default (`orgNodeId == null`).
- **Query Parameter:** `orgNodeId` (UUID, optional)

**Response Body (`RiskStrategyConfigResponse` — Status `200 OK`):**
```json
{
  "id": "77777777-8888-9999-0000-111122223333",
  "organizationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "orgNodeId": null,
  "version": 1,
  "current": true,
  "levels": 5,
  "likelihoodMode": "PROBABILITY",
  "toleranceThreshold": 15.00,
  "reviewFrequency": "ANNUAL",
  "lastReviewedAt": null,
  "approvedByUserId": "278ec11f-82db-424f-9e79-5da709d17d0c",
  "approvedAt": "2026-09-03T18:00:00Z",
  "createdByUserId": "278ec11f-82db-424f-9e79-5da709d17d0c",
  "createdAt": "2026-09-03T17:30:00Z",
  "appetiteCategories": [
    {
      "id": "88888888-9999-0000-1111-222233334444",
      "name": "Financial",
      "statement": "Low tolerance for direct financial loss",
      "sortOrder": 1
    }
  ],
  "likelihoodBands": {
    "probability": [
      {
        "id": "99999999-0000-1111-2222-333344445555",
        "position": 1,
        "label": "Rare",
        "minValue": 0.0,
        "maxValue": 5.0
      },
      {
        "id": "99999999-0000-1111-2222-333344445556",
        "position": 5,
        "label": "Almost Certain",
        "minValue": 80.0,
        "maxValue": 100.0
      }
    ],
    "timeline": []
  },
  "impactParameters": [
    {
      "id": "aaaa1111-2222-3333-4444-555566667777",
      "name": "Financial Impact",
      "enabled": true,
      "mode": "QUANTITATIVE",
      "sortOrder": 1,
      "bands": [
        {
          "id": "bbbb1111-2222-3333-4444-555566667777",
          "position": 1,
          "label": "Insignificant",
          "minValue": 0.0,
          "maxValue": 100000.0
        }
      ]
    }
  ],
  "approvalStatus": "APPROVED"
}
```

---

#### `GET /api/v1/organizations/{organizationId}/risk-strategy/history`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java#L56-L63)
- **Authorization:** `(hasAuthority('riskstrategy.view') or @riskStrategyAccessResolver.canReadOrgNodeOrDefault(#orgNodeId, authentication))`
- **Description:** Lists all historical versions (superseded, draft, rejected, approved) for the given node or org-wide scope.
- **Query Parameter:** `orgNodeId` (UUID, optional)
- **Response Body:** `List<RiskStrategyConfigResponse>` (Status `200 OK`)

---

#### `GET /api/v1/organizations/{organizationId}/risk-strategy/{configId}`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java#L65-L70)
- **Authorization:** `(hasAuthority('riskstrategy.view') or @riskStrategyAccessResolver.canViewConfig(#organizationId, #configId, authentication))`
- **Description:** Returns the full nested detail of a specific risk strategy version.
- **Response Body:** `RiskStrategyConfigResponse` (Status `200 OK`)

---

#### `POST /api/v1/organizations/{organizationId}/risk-strategy`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java#L72-L88)
- **Authorization:** `(hasAuthority('riskstrategy.manage') or (#request.orgNodeId != null and @riskStrategyAccessResolver.canContributeAt(#request.orgNodeId, authentication)))`
- **Description:** Creates a new risk strategy version draft. If `requiresApproval` is `false` in settings, activates immediately; otherwise creates a pending approval request in `global.approval_requests`.

**Request Body (`CreateRiskStrategyVersionRequest`):**
```json
{
  "orgNodeId": null,
  "levels": 5,
  "likelihoodMode": "PROBABILITY",
  "toleranceThreshold": 15.00,
  "reviewFrequency": "ANNUAL",
  "appetiteCategories": [
    {
      "name": "Financial",
      "statement": "Low tolerance for unbudgeted financial exposure"
    },
    {
      "name": "Compliance",
      "statement": "Zero tolerance for statutory non-compliance"
    }
  ],
  "likelihoodBands": {
    "probability": [
      { "position": 1, "label": "Rare", "minValue": 0.0, "maxValue": 10.0 },
      { "position": 2, "label": "Unlikely", "minValue": 10.0, "maxValue": 30.0 },
      { "position": 3, "label": "Possible", "minValue": 30.0, "maxValue": 60.0 },
      { "position": 4, "label": "Likely", "minValue": 60.0, "maxValue": 85.0 },
      { "position": 5, "label": "Almost Certain", "minValue": 85.0, "maxValue": 100.0 }
    ],
    "timeline": []
  },
  "impactParameters": [
    {
      "name": "Financial Loss",
      "enabled": true,
      "mode": "QUANTITATIVE",
      "bands": [
        { "position": 1, "label": "Negligible", "minValue": 0.0, "maxValue": 50000.0 },
        { "position": 2, "label": "Minor", "minValue": 50000.0, "maxValue": 200000.0 },
        { "position": 3, "label": "Moderate", "minValue": 200000.0, "maxValue": 1000000.0 },
        { "position": 4, "label": "Major", "minValue": 1000000.0, "maxValue": 5000000.0 },
        { "position": 5, "label": "Catastrophic", "minValue": 5000000.0, "maxValue": 20000000.0 }
      ]
    }
  ]
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `orgNodeId` | `UUID` | Optional | Org node ID. Omit for org-wide default. |
| `levels` | `int` | Required, must be 3, 4, or 5 | Matrix dimension level count. |
| `likelihoodMode` | `LikelihoodMode` | Required | Enum: `PROBABILITY`, `TIMELINE`, `BOTH`. |
| `toleranceThreshold` | `BigDecimal` | Required, 0 to 100 | Risk tolerance threshold score. |
| `reviewFrequency` | `ReviewFrequency` | Required | Enum: `MONTHLY`, `QUARTERLY`, `BI_ANNUAL`, `ANNUAL`. |
| `appetiteCategories` | `List<...>` | Optional | If omitted, copies from previous version or prototype defaults. |
| `likelihoodBands` | `Object` | Optional | If omitted, copies from previous version or prototype defaults. |
| `impactParameters` | `List<...>` | Optional | If omitted, copies from previous version or prototype defaults. |

- **Response:** Status `201 Created` with `Location` header and body `RiskStrategyConfigResponse`.

---

#### `POST /api/v1/organizations/{organizationId}/risk-strategy/{configId}/decision`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java#L90-L100)
- **Authorization:** `(hasAuthority('riskstrategy.manage') or @riskStrategyAccessResolver.canDecide(#organizationId, #configId, authentication))`
- **Description:** Records an approval decision (`APPROVED` or `REJECTED`) on a pending draft. When approved, supersedes the previous active version and marks the new version `current = true`.

**Request Body (`ApprovalDecisionRequest`):**
```json
{
  "decision": "APPROVED",
  "comments": "Reviewed and aligned with board appetite."
}
```
| Field | Type | Validation | Description |
|---|---|---|---|
| `decision` | `ApprovalDecision` | Required | Enum: `APPROVED`, `REJECTED`. |
| `comments` | `String` | Optional | Approver review comments. |

- **Response Body:** `RiskStrategyConfigResponse` (Status `200 OK`)

---

#### `GET /api/v1/organizations/{organizationId}/risk-strategy/settings` & `PUT`
- **Implementation File:** [`src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/governance/riskstrategy/apis/RiskStrategyController.java#L102-L112)
- **Authorization:** `GET`: `hasAuthority('riskstrategy.view')`; `PUT`: `hasAuthority('riskstrategy.manage')`
- **Description:** Retrieves or updates the organization's risk strategy workflow settings (whether strategy versions require approval before activation).

**PUT Request Body (`UpdateRiskStrategySettingsRequest`):**
```json
{
  "requiresApproval": true
}
```
**Response Body (`RiskStrategySettingsResponse` — Status `200 OK`):**
```json
{
  "organizationId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "requiresApproval": true
}
```

---

## 4. General & System Services

### 4.1 Current Authenticated User (`/api/v1/me`)

#### `GET /api/v1/me`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/user/apis/CurrentUserController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/apis/CurrentUserController.java#L28-L34)
- **Authorization:** `@PreAuthorize("isAuthenticated()")`
- **Description:** Returns the active profile, active organization summary, and granted permissions for the authenticated session. *(See §6.1 for known issue regarding platform-admin tokens)*.

**Response Body (`CurrentUserResponse` — Status `200 OK`):**
```json
{
  "id": "278ec11f-82db-424f-9e79-5da709d17d0c",
  "email": "admin@icea.co.ke",
  "username": "icea.admin",
  "fullName": "ICEA Administrator",
  "organization": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "code": "ICEA",
    "name": "ICEA Lion Group"
  },
  "permissions": [
    "orgnode.view",
    "orgnode.manage",
    "riskstrategy.view",
    "riskstrategy.manage"
  ],
  "accessTokenExpiresAt": "2026-09-18T13:30:00Z"
}
```

---

#### `POST /api/v1/me/change-password`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/user/apis/CurrentUserController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/apis/CurrentUserController.java#L36-L43)
- **Authorization:** `@PreAuthorize("isAuthenticated()")`
- **Description:** Allows an authenticated user to change their password by validating their current password and hashing the replacement via BCrypt. Works for both org-scoped and platform users.

**Request Body (`ChangePasswordRequest`):**
```json
{
  "currentPassword": "OldPassword@123",
  "newPassword": "NewSecurePassword@123",
  "confirmPassword": "NewSecurePassword@123"
}
```
**Response Body (`ChangePasswordResponse` — Status `200 OK`):**
```json
{
  "message": "Password changed successfully."
}
```

---

### 4.2 System Permissions Catalog (`/api/v1/permissions`)

#### `GET /api/v1/permissions`
- **Implementation File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/PermissionController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/PermissionController.java#L27-L33)
- **Authorization:** `@PreAuthorize("isAuthenticated()")`
- **Description:** Returns active system permissions, optionally filtered by `moduleId` or `permissionScopeType`.
- **Query Parameters:**
  - `moduleId` (UUID, optional)
  - `permissionScopeType` (Enum: `ORGANIZATION`, `PLATFORM`, `BOTH` — Optional)

**Response Body (`List<PermissionResponse>` — Status `200 OK`):**
```json
[
  {
    "id": "33333333-4444-5555-6666-777777777777",
    "moduleId": "11111111-0000-0000-0000-000000000002",
    "code": "riskstrategy.view",
    "name": "View Risk Strategy",
    "description": "Allows viewing risk strategy configurations",
    "scopeType": "ORGANIZATION"
  }
]
```

---

### 4.3 Health & Monitoring

| Method | Path | Auth | Description | Response Example |
|---|---|---|---|---|
| `GET` | `/actuator/health` | Public | Application liveness/readiness status | `{"status": "UP"}` |
| `GET` | `/actuator/info` | Authenticated | Build and application metadata | `{}` |

---

## 5. Common Data Structures & Error Shapes

### 5.1 Standard Error Response Format
Handled by [`src/main/java/com/privox_grc_api/shared/exception/GlobalExceptionHandler.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/shared/exception/GlobalExceptionHandler.java#L17-L117) and [`src/main/java/com/privox_grc_api/shared/exception/AuthenticationExceptionHandler.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/shared/exception/AuthenticationExceptionHandler.java#L14-L28):

```json
{
  "timestamp": "2026-09-18T13:00:00Z",
  "status": 404,
  "code": "RESOURCE_NOT_FOUND",
  "message": "Organization not found",
  "path": "/api/v1/organizations/3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

### 5.2 Error Codes Matrix
| HTTP Status | Error Code | Example Causes |
|---|---|---|
| `400 Bad Request` | `BAD_REQUEST` | Malformed parameters, illegal business transitions. |
| `400 Bad Request` | `VALIDATION_FAILED` | Bean validation errors on `@Valid` request bodies. |
| `401 Unauthorized` | `INVALID_CREDENTIALS` | Bad username/password, expired session, missing required JWT claim. |
| `403 Forbidden` | `FORBIDDEN` | Missing required permission code, or accessing another tenant's resource. |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | Unknown organization, node, group, or user ID. |
| `409 Conflict` | `CONFLICT` | Duplicate group code, duplicate slug, invalid state transition. |
| `409 Conflict` | `ORG_NODE_CYCLE` | Attempting to move an org node under one of its own descendants. |
| `409 Conflict` | `DUPLICATE_GROUP_CODE` | Group code already exists within the organization. |

---

## 6. Flagged Issues & Architectural Concerns

During the end-to-end endpoint trace, the following bugs, inconsistencies, and concerns were identified:

> [!CAUTION]
> **Issue 1: `GET /api/v1/me` Throws 401 for Platform Administrators**
> - **File:** [`src/main/java/com/privox_grc_api/usermanagement/user/application/CurrentUserService.java` (Line 49)](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/application/CurrentUserService.java#L49)
> - **Cause:** `CurrentUserService.getCurrentUser(Jwt)` executes:
>   ```java
>   UUID organizationId = parseRequiredUuid(jwt.getClaimAsString("org"), "org");
>   ```
>   Platform access tokens intentionally omit the `org` claim. This call throws `BadCredentialsException("Required JWT claim is missing: org")`, which surfaces as a `401 INVALID_CREDENTIALS` error. Platform administrators are unable to retrieve their profile via `/api/v1/me`.
> - **Remediation:** Parse `org` as optional in `CurrentUserService`. If null, return `CurrentUserResponse` with `organization = null`.

> [!WARNING]
> **Issue 2: Missing `@ExceptionHandler` on Validation Method in `GlobalExceptionHandler`**
> - **File:** [`src/main/java/com/privox_grc_api/shared/exception/GlobalExceptionHandler.java` (Line 37)](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/shared/exception/GlobalExceptionHandler.java#L37)
> - **Cause:** Method `handleValidationException(MethodArgumentNotValidException, HttpServletRequest)` does **not** have the `@ExceptionHandler(MethodArgumentNotValidException.class)` annotation. As a result, validation errors on `@Valid` request bodies are not formatted with the application's structured `VALIDATION_FAILED` response.
> - **Remediation:** Add `@ExceptionHandler(MethodArgumentNotValidException.class)` immediately above line 37.

> [!WARNING]
> **Issue 3: URI Template Typo in `AccessGroupController.addOrganizationGroup`**
> - **File:** [`src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java` (Line 64)](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authorization/apis/AccessGroupController.java#L64)
> - **Cause:** `ServletUriComponentsBuilder.fromCurrentRequest().path("/groupId").buildAndExpand(response.id()).toUri();` uses literal string `"/groupId"` instead of `"/{groupId}"`.
> - **Impact:** The returned HTTP `Location` header is malformed (ends in `.../groups/groupId` rather than `.../groups/{uuid}`).
> - **Remediation:** Change `path("/groupId")` to `path("/{groupId}")`.

> [!NOTE]
> **Issue 4: Duplicate & Inconsistent `OrganizationMemberResponse` Records**
> - **Files:**
>   - [`src/main/java/com/privox_grc_api/usermanagement/organization/api/dto/OrganizationMemberResponse.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/api/dto/OrganizationMemberResponse.java)
>   - [`src/main/java/com/privox_grc_api/usermanagement/user/api/dto/OrganizationMemberResponse.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/api/dto/OrganizationMemberResponse.java)
> - **Cause:** Two distinct record definitions exist under different packages with the same name. `OrganizationMemberController` returns the `organization.api.dto` variant (with `userCreatedAt`/`membershipCreatedAt`), whereas `OrganizationMemberManagementController` returns the `user.api.dto` variant (with `createdAt`/`updatedAt`).
> - **Remediation:** Consolidate into a single canonical DTO.

> [!NOTE]
> **Issue 5: Controller Splitting on `/api/v1/organizations/{organizationId}/members`**
> - **Files:**
>   - [`src/main/java/com/privox_grc_api/usermanagement/organization/apis/OrganizationMemberController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/organization/apis/OrganizationMemberController.java) (`GET /`)
>   - [`src/main/java/com/privox_grc_api/usermanagement/user/apis/OrganizationMemberManagementController.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/apis/OrganizationMemberManagementController.java) (`POST /`, `PUT /{userId}`, lifecycle transitions)
> - **Cause:** The same REST endpoint path is split between two separate controllers across `organization` and `user` packages.
> - **Remediation:** Merge read and write operations into a single member controller.

> [!NOTE]
> **Issue 6: Client IP Detection Behind Reverse Proxies**
> - **File:** [`src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java` (Line 97)](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/authentication/apis/AuthenticationController.java#L97)
> - **Cause:** `request.getRemoteAddr()` is used directly without configuring `server.forward-headers-strategy=framework` in `application.properties`. When deployed behind Nginx, Kubernetes ingress, or Cloudflare, `global.sessions.ip_address` records the load balancer's IP rather than the client's public IP.

> [!NOTE]
> **Issue 7: Inactive Account Lockout Logic**
> - **Files:**
>   - [`src/main/java/com/privox_grc_api/usermanagement/user/domain/User.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/usermanagement/user/domain/User.java#L49-L53)
>   - [`src/main/java/com/privox_grc_api/security/authentication/PrivoxUserPrincipal.java`](file:///home/nesta/Documents/programming_playground/FAC/GRC26/privox-grc_backend/privox-grc-api/src/main/java/com/privox_grc_api/security/authentication/PrivoxUserPrincipal.java#L62-L64)
> - **Cause:** Fields `failedLoginCount` and `lockedUntil` exist and are inspected by Spring Security, but neither `AuthenticationService` nor an authentication failure listener increments `failedLoginCount` or calculates `lockedUntil`. Account lockout is currently non-functional.
