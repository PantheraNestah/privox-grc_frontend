# Organization selection at login

**Status:** backend contract ready (`feature/schema-per-tenant`); frontend implementation described here.

## Problem

`AuthContext.login` never sends `organizationId`, so the backend binds the session to the user's **primary** organization. A user with memberships in several organizations (e.g. SIC and GNC) can therefore only ever work in their primary one; the other organization is unreachable from the UI.

## Backend contract (additive, no breaking change)

`POST /api/v1/auth/login` already accepts an optional `organizationId`. The response gains one field:

```jsonc
{
  "accessToken": "...", "refreshToken": "...", /* ...unchanged... */
  "organization": { "id": "…", "code": "SIC", "name": "Savanna Insurance Co." },   // org this session is bound to
  "organizations": [                                                               // NEW
    { "id": "…", "code": "SIC", "name": "Savanna Insurance Co.", "primary": true },
    { "id": "…", "code": "GNC", "name": "Gift & Nestah Co.",     "primary": false }
  ]
}
```

- `organizations` lists every **active** membership in an **active** organization, primary first.
- It is always present (`[]` for a platform admin with no memberships), including when `organizationId` was sent.
- Omitting `organizationId` behaves exactly as today (bind to primary). Old clients keep working.
- Sending `organizationId` for an org the user is not an active member of returns the same generic `401 INVALID_CREDENTIALS` as a bad password.

## Frontend flow

```
credentials ──login(no org)──▶ response
                                 │
          organizations.length ≤ 1 ──▶ commit session (unchanged behaviour)
                                 │
          organizations.length > 1 ──▶ show picker (default = response.organization)
                                          │
              picks response.organization ──▶ commit the session already issued
              picks another org ──▶ revokeIssuedSession(first) ─▶ login(+organizationId) ─▶ commit
              cancels ──▶ revokeIssuedSession(first) ─▶ back to the credentials form
```

### Changes

1. **`src/lib/auth-types.ts`**
   - `LoginRequest`: add optional `organizationId?: string`.
   - `LoginResponse`: add `organizations?: OrganizationOptionDto[]` (`OrganizationDto & { primary: boolean }`). Keep it optional so the UI degrades to today's behaviour against an older backend.
2. **`src/contexts/AuthContext.tsx`**
   - Run the existing `isTenantSession` / `PortalMismatchError` check first (platform accounts are still rejected before any picker).
   - If `organizations.length > 1`, **do not** call `storeRefreshToken` / `setState` yet. Keep the response in a `pendingSelection` state (`{ response, rememberMe, credentials }`) and have `login` resolve with `{ status: "organization-required", organizations, currentOrganizationId }`.
   - Add `selectOrganization(orgId)` and `cancelOrganizationSelection()` to the context as per the diagram. Factor the "commit session" block of `login` into a helper both paths share.
   - The password is held only in that in-memory `pendingSelection` for the duration of the picker and cleared on commit/cancel/unmount. It is never written to storage.
3. **`src/components/grc/AuthScreen.tsx`**
   - `LoginView`: when `login` resolves with `organization-required`, render an org picker (radio list with name + code, primary marked) in place of the credentials form, with "Continue" and "Back". Navigate to `/dashboard` only after the session is committed.
4. **Tests**
   - `AuthContext.test.tsx`: single org commits immediately; multi-org stays unauthenticated until a choice; choosing the bound org makes no second login call; choosing another org revokes the first session and sends `organizationId`; cancel revokes; a platform account is still rejected; a 401 on the second call returns to the credentials step with an error.
   - Playwright: log in as a user with two orgs, pick the non-primary one, assert the header/org name and that its data (not the primary's) loads.

### Edge cases to handle

- **Membership removed between the two calls** → second login 401s; show the generic error and return to credentials.
- **Remember me** applies to whichever session is finally committed; the revoked first session is never stored.
- **Reload mid-picker** loses `pendingSelection` (nothing was stored), so the user simply signs in again.
- **Refresh** (`/auth/refresh`) keeps the session bound to the chosen org; it does not return `organizations`, so no switcher is shown after load.

## Explicitly out of scope

- An in-app organization switcher after login. That would want a token-exchange endpoint (`POST /auth/switch-organization`) so the password isn't needed again; the `organizations` list added here is the data it would build on.
- Remembering the last chosen organization per user to skip the picker.
- Allocating the GOVERNANCE module to users whose only membership lacks it (a data fix, not a code change).

## Verifying against the backend today

Run the backend on `feature/schema-per-tenant` against the staging DB. `pantheranestah@gmail.com` and `giftnestah@gmail.com` are primary in SIC and non-primary in GNC, so they are the natural multi-org test accounts.
