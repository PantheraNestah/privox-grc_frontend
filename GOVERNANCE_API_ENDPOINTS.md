# Governance Module — Implementation & API Reference (Postman Guide)

Covers every controller implemented so far under the Governance module, per
`docs/Governance_Module/GOVERNANCE_MODULE_DESIGN.md` and its fast-follow
addendum `docs/Governance_Module/ORG_NODE_TEMPLATES_DESIGN.md`:

- **Risk Governance (Org Tree)** — `OrgNodeController`
- **Org Node Templates (clone-on-demand)** — `PlatformOrgNodeTemplateController` + `OrgNodeController#cloneTemplate`
- **Risk Strategy (Appetite & Bands)** — `RiskStrategyController`

...plus two shared, entity-agnostic services every sub-module above (and every
future one) is built on: **Org Scope resolution** and the **Approval
Workflow** state machine. Neither is exposed directly over HTTP; both are
described in Part I because they explain *why* several endpoints below behave
the way they do.

**Part I** documents how the module is actually built (schema, package
layout, business rules). **Part II** is the Postman-facing endpoint
reference — request/response shapes, permissions, environment variables.

All three controllers are org-scoped (except the platform-admin side of
templates), gated behind the `GOVERNANCE` system module, and secured with
permission-based `@PreAuthorize` checks — no controller-level auth logic, all
enforcement happens in the service layer. A 403 can therefore come from a
missing permission, an org mismatch, or the module being disabled,
indistinguishably (see §6).

---

# Part I — Module Implementation

## 1. Purpose & scope

`GOVERNANCE` is one of the platform's catalogue modules (`global.modules`,
code `GOVERNANCE`), enabled per-organization the same way every module is
(`organization_modules`). It is the umbrella for six planned sub-modules;
this implementation covers the two currently built end-to-end — **Risk
Governance** (the org tree itself) and **Risk Strategy** (appetite/tolerance
and likelihood/impact bands) — plus a fast-follow on top of the org tree,
**Org Node Templates**, which lets platform admins publish reusable starter
trees that organizations clone into their own tenant.

Everything targets a production-shape implementation, not a demo cut: full
validation, full permission/module gating, and a real approval-gated
version-lifecycle for Risk Strategy — not a throwaway version meant to be
rebuilt later.

## 2. Package layout

```
governance/
├── orgtree/
│   ├── domain/          OrgNode, OrgNodeType, RiskRating, OrgNodeClosure(+Id),
│   │                     OrgTreeSettings, OrgNodeTemplate
│   ├── infrastructure/   OrgNodeRepository, OrgNodeClosureRepository,
│   │                     OrgTreeSettingsRepository, OrgNodeTemplateRepository
│   ├── application/      OrgNodeService, OrgNodeTemplateService,
│   │                     OrgNodeTemplateNodeInput
│   ├── api/dto/          request/response records
│   └── apis/             OrgNodeController, PlatformOrgNodeTemplateController
├── riskstrategy/
│   ├── domain/           RiskStrategyConfig, RiskBand, Dimension,
│   │                     ReviewFrequency, RiskStrategySettings
│   ├── infrastructure/   RiskStrategyConfigRepository, RiskBandRepository,
│   │                     RiskStrategySettingsRepository
│   ├── application/      RiskStrategyService, RiskBandInput
│   ├── api/dto/          request/response records
│   └── apis/             RiskStrategyController
└── shared/
    ├── orgscope/          OrgScopeService (application) +
    │                       OrgScopeRepository (infrastructure, read-only)
    └── approval/           ApprovalRequest, ApprovalStep, ApprovalRequestStatus,
                             ApprovalStepStatus, ApprovalDecision (domain);
                             ApprovalWorkflowService (application)
```

Every layer follows the same convention already established by
`usermanagement.*`: hexagonal-ish `api/dto → apis → application → domain →
infrastructure`, entities with protected no-arg constructors and static
factories, repositories as plain Spring Data interfaces (native `@Query` for
anything relational), services doing all authorization via `@PreAuthorize`,
and controllers thin with no auth logic of their own.

## 3. Data model

All tables live in the shared `global` schema (see design doc §2.2 — no
per-tenant physical schemas exist in this codebase), scoped logically by
`organization_id`.

| Table | Migration | Purpose |
|---|---|---|
| `org_nodes` | `V202609021500` | The org tree itself. `organization_id` is **nullable** and `is_system_default` exists from day one — a node is either org-owned (`is_system_default = false`, `organization_id` set) or a platform template node (`is_system_default = true`, `organization_id NULL`), enforced by `chk_org_nodes_system_default_org`. |
| `org_node_closure` | `V202609021515` | Closure table for the tree: one row per `(ancestor_id, descendant_id, depth)` pair, including a self-row (`depth = 0`) for every node. `ON DELETE CASCADE` on both FKs — this is what makes hard-delete prune automatically. |
| `org_tree_settings` | `V202609021530` | One row per organization, `organization_id` is both PK and FK (`@MapsId` pattern). Currently just `strict_type_hierarchy`. |
| `approval_requests` | `V202609021545` | Generic, entity-agnostic approval header. `entity_type` is an open `VARCHAR(100)` (not a CHECK-constrained enum) so a new consumer is "use a new string," never a migration. |
| `approval_steps` | `V202609021600` | One row per step of a request; `approver_user_id` is populated on decision (no pre-assigned approver routing — see §7). |
| `risk_strategy_configs` | `V202609021615`, altered `V202609031715` | Append-only version history of risk appetite/tolerance config. Two **partial unique indexes** (split on `org_node_id IS NULL` vs `IS NOT NULL`, since plain `UNIQUE` treats `NULL`s as distinct) enforce "exactly one `is_current = true` row per `(organization_id, org_node_id)`." Reworked per `RISK_STRATEGY_REDESIGN.md`: `appetite_statement`/`likelihood_scale`/`impact_scale` are gone, replaced by a shared `levels` (3/4/5) and `likelihood_mode`; `tolerance_threshold` is now nullable — dormant, no validation beyond 0–100 when given (see §6). |
| `risk_appetite_categories` | `V202609031730` | Named, user-extensible appetite categories for one config version (e.g. "Strategic", "Financial"). Unique `(risk_strategy_config_id, name)`. |
| `risk_likelihood_bands` | `V202609031745` | Bands for one likelihood track (`PROBABILITY` or `TIMELINE`) of one config version. Unique `(risk_strategy_config_id, track, position)`. |
| `risk_impact_parameters` | `V202609031800` | Named, user-extensible, individually toggleable impact parameters for one config version (e.g. "People", "Financial"), each with its own `mode`. Unique `(risk_strategy_config_id, name)`. |
| `risk_impact_bands` | `V202609031815` | Bands on one impact parameter's own independent band set. Unique `(risk_impact_parameter_id, position)`. |
| `risk_strategy_settings` | `V202609021645` | One row per organization (`@MapsId`), currently just `requires_approval` (default `true`). |
| `org_node_templates` | `V202609031615` | Platform catalogue of reusable template trees. `root_org_node_id` points at a system-default `org_nodes` row; unique per root so one root can't be registered twice. |

`risk_bands` (`V202609021630`) was **dropped** (`V202609031700`) — the shipped two-fixed-dimension band model never matched the actual prototype; see §6.

## 4. Sub-module: Risk Governance (org tree)

`OrgNode` is a self-referencing tree (`parent_id`) with a **closure table**
(`org_node_closure`) maintained alongside it, rather than recursive CTEs, so
every scoped read reduces to a single indexed lookup.

**Closure maintenance** (all native `@Modifying @Query`s in
`OrgNodeClosureRepository`):

- **Insert** (new node under `parentId`): copy every closure row that has
  `parentId` as its descendant, re-pointing `descendant_id` at the new node
  and incrementing `depth`, plus the node's own self-row (`depth = 0`).
- **Move** (`OrgNodeService.moveNode`): a **detach** step deletes every
  closure row that crosses the subtree's boundary (an old ancestor of the
  moved node pointing at anything inside its subtree), followed by a
  **reattach** step that cross-joins the moved subtree's own internal rows
  against the new parent's ancestor chain to rebuild the boundary-crossing
  rows at the new position. A cycle check (`OrgScopeService.isDescendantOf`)
  runs first and throws `OrgNodeCycleException` (409 `ORG_NODE_CYCLE`,
  §6) before any mutation if the target parent is the node itself or one of
  its own descendants.
- **Soft-delete**: cascades to every descendant's `effective_to` in one
  transaction, but the closure table itself is **untouched** — it's kept as
  permanent structural/audit history. Only `hard-delete` prunes closure rows,
  automatically, via `ON DELETE CASCADE`.
- **Hard-delete**: scoped down (this pass) to a children-only dependency
  check — blocks with 409 if the node has any active (non-soft-deleted)
  children. The full "users/objectives/documents/surveys reference this
  node" dependency report from the design doc can't be built until those
  modules exist.

## 5. Sub-module: Org Node Templates (clone-on-demand)

Addendum design: `docs/Governance_Module/ORG_NODE_TEMPLATES_DESIGN.md`.

Platform admins maintain one or more **template trees** — ordinary `OrgNode`
subtrees with `is_system_default = true`, `organization_id = NULL` — and
organizations clone one on demand into their own tenant. This is
**clone-on-demand, not shared attachment**: org trees are inherently
org-specific (headcount, contact emails, cost centers), so adopting a
template deep-copies it into new org-owned nodes. The template itself is
never modified by, or aware of, any clone taken from it — no "sync with
template" exists, and template edits made after a clone is taken never
propagate to it.

**Registration** (`OrgNodeTemplateService.registerTemplate`, platform-admin
only): the request carries a nested tree definition (name/type/description
per node, with a `children` array), and the service walks it top-down,
creating a fresh `OrgNode.systemTemplate(...)` row per node and maintaining
the closure table with the exact same `insertSelfRow`/`insertAncestorRows`
primitives `OrgNodeService.createNode` already uses — no new closure math.
Once every node is created, a single `org_node_templates` catalogue row is
written pointing at the subtree's root. `OrgNodeTemplate`'s constructor
defensively re-checks that the root is actually system-default, regardless
of how it was built.

**Cloning** (`OrgNodeTemplateService.cloneTemplate`, org-side, `orgnode.manage`):
loads the template's full subtree (via the existing
`OrgScopeService.getDescendantIds`, no new traversal), then deep-copies it
top-down into fresh org-owned `OrgNode` rows — new UUID per node,
`organization_id` = the target org, `is_system_default = false`, every other
field copied verbatim, `parent_id` remapped through an old-id→new-id map
built as the walk proceeds. The subtree's root is attached under
`targetParentId` (or becomes a new root if omitted). Closure rows for the
freshly-inserted subtree are built node-by-node during the same walk, again
reusing `insertSelfRow`/`insertAncestorRows` — **no bulk "reattach" query is
needed**, because the cloned nodes don't exist until this call creates them.

**Resolved design question** (`ORG_NODE_TEMPLATES_DESIGN.md` §5): does
`moveNode`'s cycle check apply to `targetParentId` validation on clone? No —
that check walks the closure table for a node that **already exists**; the
cloned subtree doesn't exist until this method creates it, so it cannot
already be an ancestor of `targetParentId` (structurally impossible). Only
ordinary existence/ownership validation runs: `targetParentId` must exist,
be active (not soft-deleted), and belong to the target organization, or the
call 404s.

**Business rules enforced:**

1. Templates are read-only once cloned from — cloning never mutates the
   template's own `org_nodes` rows.
2. Clones are fully independent — no back-reference from a clone to its
   source template is persisted.
3. `targetParentId`, if given, must belong to the target org and be active,
   or `404`.
4. Cloning is gated exactly like every other `orgnode.manage` write — org
   match + `GOVERNANCE` module enabled. No new org-side permission exists;
   only the platform-side `platform.orgnode.manage` is new.
5. A template's root must itself be `is_system_default = true` — enforced in
   `OrgNodeTemplate`'s constructor regardless of caller.

## 6. Sub-module: Risk Strategy (appetite & bands)

Reworked per `docs/Governance_Module/RISK_STRATEGY_REDESIGN.md` — the
originally shipped two-fixed-dimension model (`appetite_statement` +
independent `likelihood_scale`/`impact_scale` + one `risk_bands` table with a
`LIKELIHOOD`/`IMPACT` enum) didn't match the actual prototype and was
replaced by a clean-slate rework (no data migration; drop-and-recreate, since
no production data existed yet). `RiskStrategyConfig` rows are still
**strictly append-only** — a version is never edited in place; every change
is a new row with the next `version` number, and the static factory
`newVersion(...)` still always constructs `current = false` regardless of
whether approval is required.

**What changed:**

- One shared `levels` (`3`/`4`/`5`) drives every band table on the version,
  replacing independent `likelihoodScale`/`impactScale`.
- Appetite is now a **user-extensible list of named categories**
  (`RiskAppetiteCategory`: `name` + `statement`), not one
  `appetiteStatement` string. Defaults (auto-seeded only on a from-scratch
  first version, see below): Strategic, Operational, Financial, Compliance,
  Cyber & Information Security.
- Likelihood gains a **`likelihoodMode`** (`PROBABILITY` / `TIMELINE` /
  `BOTH`) driving up to two independent band tracks
  (`RiskLikelihoodBand.track`), each with `label`/`minValue`/`maxValue`
  instead of the old `label`/`description`/`color`/`score`.
- Impact is now a **user-extensible list of named parameters**
  (`RiskImpactParameter`: `name`, `enabled`, `mode` —
  `QUANTITATIVE`/`QUALITATIVE`/`BOTH`), each with its **own independent band
  set** (`RiskImpactBand`, `label`/`minValue`/`maxValue`). Defaults
  (from-scratch only): People, Reputation, Operational, Compliance,
  Financial, Strategic, each `enabled = true`, `mode = QUANTITATIVE`.
- `toleranceThreshold` is kept as a **dormant, now-optional** field — no
  business logic or validation beyond the `0`–`100` range when a value is
  given (it doesn't appear anywhere in the actual prototype screenshots; kept
  rather than removed in case it matters later). The column was made
  nullable in the same migration that dropped the old scale columns, to stay
  consistent with the redesign's "not required" language.

**Single-current-version invariant** is unchanged, enforced two ways:
- **Database**: the two partial unique indexes described in §3.
- **Service**: an explicit transactional swap (`activate()` in
  `RiskStrategyService`) — if there's a previous current version, it's
  `supersede()`d and flushed *before* the new one is `markCurrent()`d and
  flushed, so two `true` rows are never visible even within one transaction.

**Approval gating** is unchanged: whether a new version needs sign-off before
becoming current is controlled per-organization by
`risk_strategy_settings.requires_approval` (default `true`). When required,
`createNewVersion` opens a generic approval request
(`entity_type = "risk_strategy_config"`, `totalSteps = 1`) via the shared
Approval Workflow (§8) instead of activating immediately.
`recordApprovalDecision` delegates the decision to that service and, only on
a resulting `APPROVED` status, runs the same `activate()` swap and stamps
`approvedByUserId`/`approvedAt`. A `REJECT`ed or `REQUEST_REVISION`ed version
stays permanently non-current — history is immutable; the org must create a
fresh version to retry.

**Every response — `GET /current`, `GET /history`, `GET /{id}`, and the
`POST`/decision responses — carries the full nested structure** (categories,
both likelihood tracks, every impact parameter with its own bands). This is
assembled *inside* the already-authorized service method (a private
`loadDetail` helper, not a second permission-gated call), specifically so
that a caller authorized only for `riskstrategy.manage` (e.g. `POST /`)
never needs `riskstrategy.view` too just to see what it created.

**`appetiteCategories`, `likelihoodBands`, and `impactParameters` are each
independently omittable** from `createNewVersion` — omitting one applies
"remap-on-omission, keyed by name" (redesign §4 rule 2) to that field only;
the others may still be given explicitly in the same request:

1. **Band count matches `levels`, per active track/parameter** — a
   likelihood track is only validated (must have exactly `levels` bands,
   positions `1..levels`, no gaps/duplicates) when `likelihoodMode` requires
   it (`PROBABILITY`/`TIMELINE` individually, or both under `BOTH`); a track
   not required by the current mode is exempt and persisted as given
   (possibly empty). Every **enabled** impact parameter must have exactly
   `levels` bands; a disabled parameter's bands are persisted without that
   check.
2. **Remap-on-omission, keyed by name** — when a field is *omitted*, its
   previous-version data is copied verbatim (categories: name + statement;
   likelihood: both tracks; impact parameters: name/enabled/mode + their own
   bands), subject to the `levels`-change remap in rule 3. **If there is no
   previous version at all** (first version ever for this
   `organizationId`/`orgNodeId`), the server auto-seeds the prototype
   defaults listed above instead of leaving empty lists — but only when the
   field is *omitted*; an explicit (even empty `[]`) list on the very first
   version is honored as given, same as any other version.
3. **`levels` change preserves by position** — for every track/parameter
   carried forward by omission, positions `1..min(oldLevels, newLevels)` keep
   their existing `label`/`minValue`/`maxValue` verbatim; new positions
   beyond the old scale are synthesized as `"Band N"` placeholders with null
   min/max; positions beyond the new scale are dropped.
4. **Category/parameter add or remove is a normal part of `createNewVersion`**
   — since these lists are extensible and versioned as part of the whole
   config, adding or removing one is just supplying (or omitting) it in the
   next version's payload; no separate endpoint exists for this.
5. Everything else is unchanged from the original design: append-only
   versioning, single-current-version invariant, approval gating,
   immutable history once superseded.

## 7. Shared: Org Scope resolution (`OrgScopeService`)

Backed entirely by `org_node_closure`, not recursive CTEs:

| Method | Query |
|---|---|
| `getDescendantIds(nodeId)` | every `descendant_id` where `ancestor_id = nodeId` (includes the node itself, via its self-row) |
| `getAncestorIds(nodeId)` | every `ancestor_id` where `descendant_id = nodeId` (includes itself) |
| `isDescendantOf(candidateId, nodeId)` | `EXISTS` check — the cycle-detection primitive: moving/attaching `nodeId` under `candidateId` would create a cycle exactly when this is true |
| `isWithinScope(scopeRootId, targetId)` | same `EXISTS` check, used by `OrgNodeController`'s `scopeRootNodeId` list filter |

`shared/orgscope` reads the same `OrgNodeClosure` entity `orgtree` writes,
through a second, read-only Spring Data repository interface
(`OrgScopeRepository`) — this keeps the shared package's only dependency on
the `orgtree` feature package limited to the entity class, not its mutation
repository.

## 8. Shared: Approval Workflow (`ApprovalWorkflowService`)

Generic and entity-agnostic from day one (design doc §2.6) — built now
because Risk Strategy needs it immediately, but designed so a future
consumer (Strategy Assessment, Document Management, ...) is "start using a
new `entity_type` string," never a schema change.

- **`createRequest(entityType, entityId, totalSteps)`** — opens a request in
  `PENDING`, `currentStep = 1`, and creates step 1.
- **`decide(requestId, decidingUserId, decision, comments)`** — loads the
  current pending step and records the decision:
  - `APPROVE` on a non-final step advances to the next step (creating it),
    request stays `PENDING`; on the final step, the request resolves
    `APPROVED`.
  - `REJECT` records the step `REJECTED` and resolves the request `REJECTED`.
  - `REQUEST_REVISION` also records the step `REJECTED` but resolves the
    request as the distinct `REVISION_REQUESTED` status — `ApprovalDecision`
    (3 values: `APPROVE`/`REJECT`/`REQUEST_REVISION`) is deliberately a
    separate enum from `ApprovalStepStatus` (3 values:
    `PENDING`/`APPROVED`/`REJECTED`), since the request-level outcome needs
    to distinguish "rejected" from "sent back for revision" while a step
    itself only ever ends up approved or rejected.
  - Deciding an already-resolved request throws (`ResponseStatusException`,
    409).
- **`findPendingRequest(entityType, entityId)`** — used by
  `RiskStrategyService.recordApprovalDecision` to locate the request a
  decision applies to.

**No pre-assigned approver routing** — `approver_user_id` is stamped on
decision, not assigned in advance; anyone holding the consuming module's
relevant `*.manage` permission (plus its own org/module gates) can resolve
the current pending step, consistent with how every other mutation in this
codebase is authorized. The service itself has **no `@PreAuthorize`** — it's
a generic internal component; authorization is entirely the calling
service's responsibility (e.g. `riskstrategy.manage` gates
`RiskStrategyService.recordApprovalDecision`, which is the only current
caller of `decide`).

## 9. Security model

Every mutating/read method in `OrgNodeService`, `OrgNodeTemplateService`
(clone only), and `RiskStrategyService` combines up to three `@PreAuthorize`
clauses, ANDed:

```java
@PreAuthorize("""
        hasAuthority('orgnode.manage')
        and @organizationAccessChecker.matches(#organizationId, authentication)
        and @organizationModuleAccessChecker.isEnabled(#organizationId, 'GOVERNANCE')
        """)
```

- **`hasAuthority(...)`** — the permission code must be present in the JWT's
  `permissions` claim (mapped 1:1 to Spring authorities, no prefix).
- **`@organizationAccessChecker.matches(...)`** — the `organizationId` path
  variable must match the JWT's `org` claim (existing bean, reused as-is).
- **`@organizationModuleAccessChecker.isEnabled(...)`** — **new component**
  added by this module (`security/authorization/OrganizationModuleAccessChecker`,
  same shape as `OrganizationAccessChecker`), backed directly by the existing
  `OrganizationModuleRepository.existsByOrganization_IdAndSystemModule_CodeIgnoreCaseAndEnabledTrue`
  — no new query needed. Closes a real gap: before this module, there was no
  enforcement pattern for "org must have module X enabled" anywhere.

`OrgNodeTemplateService.registerTemplate` and the template list/preview
methods are the exception — they're platform-scoped, not org-scoped, so only
`hasAuthority('platform.orgnode.manage')` applies (list/preview have no
`@PreAuthorize` at all; they're open to any authenticated principal, gated
only by Spring Security's global `.anyRequest().authenticated()`).

Because all three checks are ANDed with **no distinguishing failure mode**,
a 403 from any Governance endpoint can mean *any* of: missing permission,
wrong/missing `org` claim, or `GOVERNANCE` disabled for that org. See §6 for
the exact (bodyless) shape of that response.

## 10. Known limitations / fast-follows

- `org_tree_settings.strict_type_hierarchy` is stored and toggleable but
  **not yet enforced** anywhere — the column exists now specifically to
  avoid a migration later (design doc §5.4).
- `risk_strategy_configs`' `org_node_id` column and the `orgNodeId` query
  param on Risk Strategy endpoints are **schema-reserved** for a future
  per-org-unit override; this pass only implements the org-wide default
  (`orgNodeId = null`) end to end.
- Hard-delete's dependency check is children-only (§4) — it will need to
  widen once objectives/documents/surveys modules exist and can reference an
  org node.
- No multi-step approval routing exists yet for Risk Strategy
  (`totalSteps = 1` always) — the generic service already supports more,
  a future consumer just has to ask for it.
- `toleranceThreshold` (Risk Strategy) has no business logic, validation
  beyond `0`–`100`, or UI wiring attached to it — it doesn't appear in the
  actual prototype and is kept only as a dormant, optional field in case a
  real need surfaces later (§6).

---

# Part II — API Reference (Postman Guide)

## 11. Base URL & environment variables

Default local run: `server.port=8080`, no context path.

| Postman variable | Example value | Notes |
|---|---|---|
| `baseUrl` | `http://localhost:8080` | |
| `accessToken` | *(set after login)* | Bearer JWT, 15 min TTL (`app.security.jwt.access-token-ttl=PT15M`) |
| `organizationId` | *(set after login/registration)* | Must match the `org` claim baked into `accessToken` |
| `orgNodeId` | *(set after creating a node)* | |
| `parentOrgNodeId` | *(optional)* | |
| `riskStrategyConfigId` | *(set after creating a version)* | |
| `orgNodeTemplateId` | *(set after registering a template)* | |

Set `Authorization: Bearer {{accessToken}}` as a collection-level auth header
(Postman: collection → Authorization tab → Bearer Token → `{{accessToken}}`)
so every request in the collection inherits it.

A Postman **Tests** script on the login request to auto-populate variables:

```javascript
const body = pm.response.json();
pm.environment.set("accessToken", body.accessToken);
pm.environment.set("organizationId", body.organization.id);
```

---

## 12. Auth model

- **Bearer JWT** (RS256), obtained from `POST /api/v1/auth/login`.
- JWT claims relevant to these endpoints: `sub` (user id), `org` (organization
  id — **required** for every org-scoped endpoint below; a platform token
  with no `org` claim 403s on those), `permissions` (array, mapped 1:1 to
  Spring authorities).
- Every org-scoped service method checks three things together — a missing
  permission, an `organizationId` path variable that doesn't match the
  token's `org` claim, or the `GOVERNANCE` module not being enabled for that
  organization all produce the **same 403**, with no distinguishing body
  (Spring Security's default `AccessDeniedException` handling — no custom
  body, unlike the structured errors in §14).
- Permission codes used by this module:

  | Code | Scope | Grants |
  |---|---|---|
  | `orgnode.view` | `ORGANIZATION` | Org tree read endpoints |
  | `orgnode.manage` | `ORGANIZATION` | Org tree create/edit/move/delete, and cloning a template into the org |
  | `riskstrategy.view` | `ORGANIZATION` | Risk Strategy read endpoints |
  | `riskstrategy.manage` | `ORGANIZATION` | Risk Strategy version create + approval decisions, settings |
  | `platform.orgnode.manage` | `PLATFORM` | Registering org node templates (platform-admin only) |

  `platform.orgnode.manage` is **not** seeded to any dev group by
  `scripts/dev/seed_*.sql` (mirroring how `platform.organization.view` also
  isn't) — grant it manually to a platform-scoped group/user before testing
  template registration.

### `POST /api/v1/auth/login`

```json
{
  "identifier": "admin@icea.co.ke",
  "password": "Password@123",
  "organizationId": "11111111-1111-1111-1111-111111111111",
  "rememberMe": false
}
```

Response `200`:

```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "a1b2c3...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "accessTokenExpiresAt": "2026-09-03T07:15:00Z",
  "user": { "id": "...", "email": "admin@icea.co.ke", "username": null, "fullName": "..." },
  "organization": { "id": "...", "code": "ICEA", "name": "ICEA Corp" },
  "permissions": ["orgnode.view", "orgnode.manage", "riskstrategy.view", "riskstrategy.manage", "..."]
}
```

`organizationId` is optional on login only if the user belongs to exactly one
organization; otherwise it's required to pick which org-scoped token to mint.
Omit it entirely to mint a **platform token** (no `org` claim) — needed for
the platform-admin template endpoints in §16.

---

## 13. Prerequisites

1. **`GOVERNANCE` module must be enabled for the organization** (for every
   org-scoped endpoint — org tree, risk strategy, and cloning a template).
   Either:
   - Run `scripts/dev/seed_governance_demo.sql` (idempotent; enables it for
     the `ICEA` demo org and grants `orgnode.*`/`riskstrategy.*` to the
     `ORG_ADMIN` group; also seeds the `platform.orgnode.manage` permission
     definition, but does not grant it to anyone), or
   - As a platform admin: `POST /api/v1/platform/organizations/{organizationId}/modules/{moduleId}/enable`
     (`moduleId` from `GET /api/v1/platform/modules`, looking up the
     `GOVERNANCE` row).
2. **The logged-in user must hold the relevant permission** (`orgnode.*` /
   `riskstrategy.*` / `platform.orgnode.manage`) via an access group.
3. **Org-scoped endpoints need an org-scoped JWT** — log in with
   `organizationId` set. **Platform-admin template endpoints need a platform
   token** — log in with `organizationId` omitted.

Without step 1, every org-scoped request 403s even for a user who owns every
permission — the module gate and the permission check are ANDed together.
Registering/listing/previewing templates (§16) is unaffected by the
`GOVERNANCE` module gate — it's platform-level, not org-scoped.

---

## 14. Common error response shape

Every `ResponseStatusException` (400/404/409) and `@Valid` validation failure
(400) returns:

```json
{
  "timestamp": "2026-09-03T07:00:00.123Z",
  "status": 404,
  "code": "RESOURCE_NOT_FOUND",
  "message": "Org node not found",
  "path": "/api/v1/organizations/.../org-nodes/..."
}
```

Validation failures additionally carry an `errors` map of `field → message`:

```json
{
  "timestamp": "...", "status": 400, "code": "VALIDATION_FAILED",
  "message": "One or more request fields are invalid.",
  "path": "...",
  "errors": { "name": "Name is required" }
}
```

| `code` | `status` | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | `@Valid` request body failure |
| `RESOURCE_NOT_FOUND` | 404 | Organization / org node / template / risk strategy version not found (or exists but not owned by this org) |
| `ORG_NODE_CYCLE` | 409 | `moveNode` would move a node under its own descendant |
| `CONFLICT` | 409 | Hard-delete blocked by active children; band count mismatch; decision on an already-resolved / non-pending approval |
| *(no body)* | 403 | Missing permission, org mismatch, or `GOVERNANCE` module disabled |

---

## 15. Org Tree API — `OrgNodeController`

Base path: `/api/v1/organizations/{organizationId}/org-nodes`

### 15.1 `GET /` — list nodes

Query param `scopeRootNodeId` (optional UUID) filters to that node's subtree
(via the closure table) instead of returning every node in the org.

Permission: `orgnode.view`.

```
GET {{baseUrl}}/api/v1/organizations/{{organizationId}}/org-nodes
GET {{baseUrl}}/api/v1/organizations/{{organizationId}}/org-nodes?scopeRootNodeId={{orgNodeId}}
```

Response `200`: `OrgNodeResponse[]` (see 15.7 for shape).

### 15.2 `GET /{nodeId}` — get one node

Permission: `orgnode.view`.

```
GET {{baseUrl}}/api/v1/organizations/{{organizationId}}/org-nodes/{{orgNodeId}}
```

Response `200`: single `OrgNodeResponse`. `404` if soft-deleted or not in
this org.

### 15.3 `POST /` — create node

Permission: `orgnode.manage`.

Request body (`CreateOrgNodeRequest`):

```json
{
  "parentId": null,
  "name": "Acme Group",
  "type": "GROUP",
  "description": "Top-level holding group",
  "headcount": 500,
  "location": "Nairobi",
  "riskRating": "MEDIUM",
  "regulatoryBody": "CBK",
  "contactEmail": "group@acme.co.ke",
  "costCenterCode": "CC-001",
  "metadata": { "customField": "value" }
}
```

Only `name` and `type` are required (`@NotBlank`, `@NotNull`); every other
field, including `parentId` (omit or `null` for a root node), is optional.
`type` must be one of the `OrgNodeType` values (§15.8). `headcount` must be
`>= 0` if present. `contactEmail` is validated as an email if present.

Response `201`, `Location` header pointing at `GET /{nodeId}`:

```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "organizationId": "11111111-1111-1111-1111-111111111111",
  "parentId": null,
  "name": "Acme Group",
  "type": "GROUP",
  "description": "Top-level holding group",
  "headcount": 500,
  "location": "Nairobi",
  "riskRating": "MEDIUM",
  "regulatoryBody": "CBK",
  "contactEmail": "group@acme.co.ke",
  "costCenterCode": "CC-001",
  "metadata": { "customField": "value" },
  "effectiveFrom": "2026-09-03T07:00:00Z",
  "effectiveTo": null,
  "createdAt": "2026-09-03T07:00:00Z",
  "updatedAt": "2026-09-03T07:00:00Z"
}
```

### 15.4 `PATCH /{nodeId}` — update node

Permission: `orgnode.manage`. Same body shape as create, minus `parentId`
(use **move**, §15.5, to change a node's parent) — `UpdateOrgNodeRequest`:

```json
{
  "name": "Acme Holdings",
  "type": "GROUP",
  "description": "Renamed",
  "headcount": 520,
  "location": "Nairobi",
  "riskRating": "HIGH",
  "regulatoryBody": "CBK",
  "contactEmail": "group@acme.co.ke",
  "costCenterCode": "CC-001",
  "metadata": null
}
```

`name` and `type` required; this is a full replace of the editable fields,
not a partial merge — omitted optional fields are cleared to `null`.

Response `200`: updated `OrgNodeResponse`.

### 15.5 `POST /{nodeId}/move` — relocate a node

Permission: `orgnode.manage`. Relocates the node (and its whole subtree) to a
new parent, rebuilding the closure table in one transaction.

```json
{ "newParentId": "33333333-3333-3333-3333-333333333333" }
```

`newParentId: null` moves the node to become a root. Response `200`: updated
`OrgNodeResponse`.

Errors: `409 ORG_NODE_CYCLE` if `newParentId` is the node itself or one of
its own descendants; `404` if either node doesn't exist in this org.

### 15.6 Delete

- **`DELETE /{nodeId}`** — soft-delete (permission: `orgnode.manage`). Sets
  `effectiveTo` on the node **and every descendant** in one transaction (the
  closure table itself is untouched — it's structural history). Response:
  `204 No Content`.
- **`POST /{nodeId}/hard-delete`** — permanent delete (permission:
  `orgnode.manage`). Blocked with `409 CONFLICT` if the node has any active
  (non-soft-deleted) children — move or delete them first. Closure rows are
  pruned automatically via `ON DELETE CASCADE`. Response: `204 No Content`.

```
DELETE {{baseUrl}}/api/v1/organizations/{{organizationId}}/org-nodes/{{orgNodeId}}
POST   {{baseUrl}}/api/v1/organizations/{{organizationId}}/org-nodes/{{orgNodeId}}/hard-delete
```

### 15.7 `OrgNodeResponse` field reference

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `organizationId` | UUID \| null | `null` only for a system-default template node (§16); every response from this controller carries a value |
| `parentId` | UUID \| null | |
| `name` | string | |
| `type` | `OrgNodeType` | |
| `description` | string \| null | |
| `headcount` | integer \| null | |
| `location` | string \| null | |
| `riskRating` | `RiskRating` \| null | |
| `regulatoryBody` | string \| null | |
| `contactEmail` | string \| null | |
| `costCenterCode` | string \| null | |
| `metadata` | object \| null | free-form JSON |
| `effectiveFrom` | ISO-8601 instant | |
| `effectiveTo` | ISO-8601 instant \| null | non-null only for soft-deleted nodes (which 404 on GET) |
| `createdAt` / `updatedAt` | ISO-8601 instant | |

### 15.8 Enums

- `OrgNodeType`: `GROUP`, `COMPANY`, `DEPARTMENT`, `DIVISION`, `SECTION`, `PROCESS`, `SUB_PROCESS`
- `RiskRating`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

### 15.9 Org tree settings

- **`GET /settings`** (permission: `orgnode.view`) → `OrgTreeSettingsResponse`:

  ```json
  { "organizationId": "11111111-...", "strictTypeHierarchy": false }
  ```

  Returns a default (`strictTypeHierarchy: false`) if no settings row exists
  yet for the org — never 404s.

- **`PUT /settings`** (permission: `orgnode.manage`), body `UpdateOrgTreeSettingsRequest`:

  ```json
  { "strictTypeHierarchy": true }
  ```

  `strictTypeHierarchy` is stored but not yet enforced (see §10).

### 15.10 `POST /clone-template` — clone a template into this org

Permission: `orgnode.manage`. Documented alongside its Org Node Templates
counterpart in §16.4, since it's the org-side half of that feature.

---

## 16. Org Node Templates API

Two controllers cooperate here: `PlatformOrgNodeTemplateController` (managing
the catalogue, platform-admin side) and one endpoint added to the existing
`OrgNodeController` (consuming a template, org side).

### 16.1 `GET /api/v1/platform/org-node-templates` — list templates

No `@PreAuthorize` — any authenticated principal (org-scoped or platform
token). Ordered by `name` ascending.

```
GET {{baseUrl}}/api/v1/platform/org-node-templates
```

Response `200`: `OrgNodeTemplateResponse[]`:

```json
[
  {
    "id": "66666666-6666-6666-6666-666666666666",
    "name": "Insurance Org — Standard",
    "description": "A standard tree for insurance organizations",
    "rootOrgNodeId": "77777777-7777-7777-7777-777777777777",
    "createdByUserId": "88888888-8888-8888-8888-888888888888",
    "createdAt": "2026-09-03T07:00:00Z"
  }
]
```

### 16.2 `GET /api/v1/platform/org-node-templates/{id}/preview` — full tree

No `@PreAuthorize` — any authenticated principal. Returns the entire
template subtree as a nested structure, not a flat list.

```
GET {{baseUrl}}/api/v1/platform/org-node-templates/{{orgNodeTemplateId}}/preview
```

Response `200` (`OrgNodeTemplatePreviewResponse`):

```json
{
  "templateId": "66666666-6666-6666-6666-666666666666",
  "name": "Insurance Org — Standard",
  "description": "A standard tree for insurance organizations",
  "rootNode": {
    "id": "77777777-7777-7777-7777-777777777777",
    "name": "Group",
    "type": "GROUP",
    "description": null,
    "children": [
      { "id": "...", "name": "Finance", "type": "DEPARTMENT", "description": null, "children": [] },
      { "id": "...", "name": "Operations", "type": "DEPARTMENT", "description": null, "children": [] }
    ]
  }
}
```

`404` if `id` doesn't match a registered template.

### 16.3 `POST /api/v1/platform/org-node-templates` — register a template

Permission: `platform.orgnode.manage`. Builds a fresh system-default
`OrgNode` subtree from the request's nested tree definition, then writes the
catalogue row.

Request body (`RegisterOrgNodeTemplateRequest`):

```json
{
  "name": "Insurance Org — Standard",
  "description": "A standard tree for insurance organizations",
  "rootNode": {
    "name": "Group",
    "type": "GROUP",
    "description": "Root of the standard tree",
    "children": [
      {
        "name": "Finance",
        "type": "DEPARTMENT",
        "description": null,
        "children": []
      },
      {
        "name": "Operations",
        "type": "DEPARTMENT",
        "description": null,
        "children": [
          { "name": "Claims Processing", "type": "SECTION" }
        ]
      }
    ]
  }
}
```

Field notes (`OrgNodeTemplateNodeRequest`, recursive):

- `name` required (`@NotBlank`) and `type` required (`@NotNull`, one of the
  `OrgNodeType` values, §15.8) on **every** node, including nested ones.
- `description` optional.
- `children` optional — omit or empty array for a leaf node. Arbitrarily
  deep.
- Every node created this way is `is_system_default = true`,
  `organization_id = null` — none of the org-owned fields (`headcount`,
  `location`, `riskRating`, `regulatoryBody`, `contactEmail`,
  `costCenterCode`, `metadata`) are settable at registration; a template
  node never carries them, so every cloned node starts out with all of them
  `null` (§16.4) — fill them in afterward via `PATCH /{nodeId}` (§15.4).

Response `201`, `Location` header pointing at `GET /{id}/preview`:

```json
{
  "id": "66666666-6666-6666-6666-666666666666",
  "name": "Insurance Org — Standard",
  "description": "A standard tree for insurance organizations",
  "rootOrgNodeId": "77777777-7777-7777-7777-777777777777",
  "createdByUserId": "88888888-8888-8888-8888-888888888888",
  "createdAt": "2026-09-03T07:00:00Z"
}
```

Errors: `400 VALIDATION_FAILED` if the root node or any nested node is
missing `name`/`type`; `404` if the acting user (from the JWT `sub` claim)
doesn't exist.

### 16.4 `POST /api/v1/organizations/{organizationId}/org-nodes/clone-template` — clone into this org

Permission: `orgnode.manage` + org match + `GOVERNANCE` module enabled (same
gate as every other `orgnode.manage` write — see §9).

Request body (`CloneOrgNodeTemplateRequest`):

```json
{
  "templateId": "66666666-6666-6666-6666-666666666666",
  "targetParentId": null
}
```

- `templateId` required.
- `targetParentId` optional — `null`/omitted makes the cloned subtree's root
  a **new root** in this org; a UUID attaches it under that existing node,
  which must be active and belong to this organization (`404` otherwise, no
  cycle check needed — see §5).

Response `201`, `Location` header pointing at `GET /{nodeId}` (the cloned
root), body is a regular `OrgNodeResponse` (§15.7) for that root:

```json
{
  "id": "99999999-9999-9999-9999-999999999999",
  "organizationId": "11111111-1111-1111-1111-111111111111",
  "parentId": null,
  "name": "Group",
  "type": "GROUP",
  "description": "Root of the standard tree",
  "headcount": null,
  "location": null,
  "riskRating": null,
  "regulatoryBody": null,
  "contactEmail": null,
  "costCenterCode": null,
  "metadata": null,
  "effectiveFrom": "2026-09-03T07:05:00Z",
  "effectiveTo": null,
  "createdAt": "2026-09-03T07:05:00Z",
  "updatedAt": "2026-09-03T07:05:00Z"
}
```

The rest of the cloned subtree (children, grandchildren, ...) is created in
the same call but not returned in the body — fetch it afterward with
`GET /org-nodes?scopeRootNodeId={{that id}}` (§15.1).

Errors: `404` if `templateId` doesn't exist, or `targetParentId` doesn't
exist / is soft-deleted / belongs to a different org.

---

## 17. Risk Strategy API — `RiskStrategyController`

Base path: `/api/v1/organizations/{organizationId}/risk-strategy`

Versions are **strictly append-only**: a version is never edited in place —
every change creates a new version. Whether a new version needs a sign-off
before it can become the current one is controlled per-organization by
`risk_strategy_settings.requiresApproval` (default `true`, §17.6). Reworked
per `docs/Governance_Module/RISK_STRATEGY_REDESIGN.md` — see §6 for the full
business-rule writeup (band-count validation, remap-on-omission, `levels`
change handling, auto-seeded defaults).

**Every response below carries the full nested structure** — every field
listed in §17.7 is present on `GET /current`, `GET /history` (per item),
`GET /{configId}`, `POST /`, and `POST /{configId}/decision` alike.

### 17.1 `GET /current` — the active version

Permission: `riskstrategy.view`. Optional query param `orgNodeId` (schema
reserved for a future per-unit override — omit it for the org-wide default,
which is what this pass actually implements).

```
GET {{baseUrl}}/api/v1/organizations/{{organizationId}}/risk-strategy/current
```

Response `200`: `RiskStrategyConfigResponse` (§17.7). `404` if no version has
ever been approved/activated for this org (e.g. every version is still
pending approval).

### 17.2 `GET /history` — every version, newest first

Permission: `riskstrategy.view`. Same `orgNodeId` query param.

```
GET {{baseUrl}}/api/v1/organizations/{{organizationId}}/risk-strategy/history
```

Response `200`: `RiskStrategyConfigResponse[]`, ordered by `version` desc —
includes non-current, pending, rejected, and superseded versions (full audit
trail).

### 17.3 `GET /{configId}` — one version by id

Permission: `riskstrategy.view`.

```
GET {{baseUrl}}/api/v1/organizations/{{organizationId}}/risk-strategy/{{riskStrategyConfigId}}
```

Response `200`: `RiskStrategyConfigResponse` (§17.7). `404` if `configId`
doesn't belong to this organization.

### 17.4 `POST /` — create a new version

Permission: `riskstrategy.manage`.

Request body (`CreateRiskStrategyVersionRequest`) — `appetiteCategories`,
`likelihoodBands`, and `impactParameters` are each independently omittable;
omitting one applies rule 2 (§6) to that field only:

```json
{
  "orgNodeId": null,
  "levels": 3,
  "likelihoodMode": "BOTH",
  "toleranceThreshold": null,
  "reviewFrequency": "ANNUALLY",
  "appetiteCategories": [
    { "name": "Strategic", "statement": "We have a low appetite for strategic risk." },
    { "name": "Operational", "statement": "Moderate appetite for operational disruption." }
  ],
  "likelihoodBands": {
    "probability": [
      { "position": 1, "label": "Low", "minValue": 0, "maxValue": 20 },
      { "position": 2, "label": "Moderate", "minValue": 21, "maxValue": 60 },
      { "position": 3, "label": "High", "minValue": 61, "maxValue": 100 }
    ],
    "timeline": [
      { "position": 1, "label": "Low", "minValue": 12, "maxValue": null },
      { "position": 2, "label": "Moderate", "minValue": 6, "maxValue": 12 },
      { "position": 3, "label": "High", "minValue": 0, "maxValue": 6 }
    ]
  },
  "impactParameters": [
    {
      "name": "People",
      "enabled": true,
      "mode": "QUANTITATIVE",
      "bands": [
        { "position": 1, "label": "Low", "minValue": null, "maxValue": null },
        { "position": 2, "label": "Moderate", "minValue": null, "maxValue": null },
        { "position": 3, "label": "High", "minValue": null, "maxValue": null }
      ]
    }
  ]
}
```

Field notes:

- `orgNodeId` — omit/`null` for the org-wide default (the only mode this
  pass actually implements end to end; see design doc §6.5).
- `levels` required, must be `3`, `4`, or `5` — the one shared scale for
  every band table on this version.
- `likelihoodMode` required, one of `PROBABILITY` / `TIMELINE` / `BOTH` —
  which likelihood track(s) get band-count validation (§6 rule 1).
- `toleranceThreshold` **optional** (dormant field, §6) — when given, must be
  `0`–`100`.
- `reviewFrequency` required, one of `MONTHLY` / `QUARTERLY` / `ANNUALLY`.
- `appetiteCategories` — omit for remap-from-previous-version (or, on a
  from-scratch first version, the five prototype defaults); supply an
  explicit list (even `[]`) to set the categories outright, no `levels`
  validation applies to categories.
- `likelihoodBands` — omit the whole object for remap-from-previous (both
  tracks) or first-version auto-seed; when given, each track required by
  `likelihoodMode` must have exactly `levels` bands covering positions
  `1..levels` with no gaps/duplicates — a track not required by the current
  mode is exempt and persisted as given (or empty).
- `impactParameters` — omit for remap-from-previous (or first-version
  auto-seed); when given, every **enabled** parameter's `bands` must exactly
  cover `1..levels`; a disabled parameter's bands are persisted without that
  check. Adding/removing a parameter is just including/excluding it here —
  no separate endpoint.

Response `201`, `Location` header pointing at `GET /{configId}`:

- If `requiresApproval` is `true` for this org (the default): the new
  version is persisted with `"current": false` and an approval request is
  opened behind the scenes (`entity_type = "risk_strategy_config"`) — it
  will **not** appear from `GET /current` until approved.
- If `requiresApproval` is `false`: the new version is activated immediately
  in the same transaction — the previous current version (if any) is
  superseded first, then this one is marked current.

```json
{
  "id": "44444444-4444-4444-4444-444444444444",
  "organizationId": "11111111-...",
  "orgNodeId": null,
  "version": 1,
  "current": false,
  "levels": 3,
  "likelihoodMode": "BOTH",
  "toleranceThreshold": null,
  "reviewFrequency": "ANNUALLY",
  "lastReviewedAt": null,
  "approvedByUserId": null,
  "approvedAt": null,
  "createdByUserId": "55555555-...",
  "createdAt": "2026-09-03T07:00:00Z",
  "appetiteCategories": [
    { "id": "...", "name": "Strategic", "statement": "We have a low appetite for strategic risk.", "sortOrder": 0 },
    { "id": "...", "name": "Operational", "statement": "Moderate appetite for operational disruption.", "sortOrder": 1 }
  ],
  "likelihoodBands": {
    "probability": [
      { "id": "...", "position": 1, "label": "Low", "minValue": 0.00, "maxValue": 20.00 },
      { "id": "...", "position": 2, "label": "Moderate", "minValue": 21.00, "maxValue": 60.00 },
      { "id": "...", "position": 3, "label": "High", "minValue": 61.00, "maxValue": 100.00 }
    ],
    "timeline": [
      { "id": "...", "position": 1, "label": "Low", "minValue": 12.00, "maxValue": null },
      { "id": "...", "position": 2, "label": "Moderate", "minValue": 6.00, "maxValue": 12.00 },
      { "id": "...", "position": 3, "label": "High", "minValue": 0.00, "maxValue": 6.00 }
    ]
  },
  "impactParameters": [
    {
      "id": "...", "name": "People", "enabled": true, "mode": "QUANTITATIVE", "sortOrder": 0,
      "bands": [
        { "id": "...", "position": 1, "label": "Low", "minValue": null, "maxValue": null },
        { "id": "...", "position": 2, "label": "Moderate", "minValue": null, "maxValue": null },
        { "id": "...", "position": 3, "label": "High", "minValue": null, "maxValue": null }
      ]
    }
  ]
}
```

Errors: `400 BAD_REQUEST` if an explicit likelihood track required by
`likelihoodMode`, or any enabled impact parameter's bands, don't have
exactly `levels` entries covering `1..levels` with no gaps/duplicates.

### 17.5 `POST /{configId}/decision` — approve / reject / request revision

Permission: `riskstrategy.manage`. Only meaningful when the version was
created under `requiresApproval = true` and still has a pending approval
request.

Request body (`ApprovalDecisionRequest`):

```json
{ "decision": "APPROVE", "comments": "Reviewed and approved by the board." }
```

`decision` — one of `APPROVE`, `REJECT`, `REQUEST_REVISION` (required).
`comments` optional.

- **`APPROVE`** — this version becomes current (the previous current version,
  if any, is superseded first); `approvedByUserId`/`approvedAt` are stamped.
- **`REJECT`** / **`REQUEST_REVISION`** — the version stays permanently
  non-current (`"current": false` forever — history is immutable, per design
  rule 5); to try again, create a fresh version (§17.4).

```
POST {{baseUrl}}/api/v1/organizations/{{organizationId}}/risk-strategy/{{riskStrategyConfigId}}/decision
```

Response `200`: the updated `RiskStrategyConfigResponse` (§17.7).

Errors: `404` if `configId` doesn't belong to this org; `409 CONFLICT` if
there's no pending approval request for this version (already decided, or
created under `requiresApproval = false`).

### 17.6 Risk strategy settings

- **`GET /settings`** (permission: `riskstrategy.view`) → `RiskStrategySettingsResponse`:

  ```json
  { "organizationId": "11111111-...", "requiresApproval": true }
  ```

  Defaults to `true` (never 404s, even before a settings row exists).

- **`PUT /settings`** (permission: `riskstrategy.manage`), body `UpdateRiskStrategySettingsRequest`:

  ```json
  { "requiresApproval": false }
  ```

### 17.7 `RiskStrategyConfigResponse` field reference

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `organizationId` | UUID | |
| `orgNodeId` | UUID \| null | |
| `version` | integer | monotonic per `(organizationId, orgNodeId)`, starts at 1 |
| `current` | boolean | exactly one `true` row per `(organizationId, orgNodeId)` at a time |
| `levels` | integer | `3`, `4`, or `5` — shared scale for every band table below |
| `likelihoodMode` | `LikelihoodMode` | which likelihood track(s) are band-count validated |
| `toleranceThreshold` | decimal \| null | dormant, `0`–`100` when given (§6) |
| `reviewFrequency` | `ReviewFrequency` | |
| `lastReviewedAt` | ISO-8601 instant \| null | not yet set by any endpoint in this pass |
| `approvedByUserId` | UUID \| null | set only once `APPROVE`d |
| `approvedAt` | ISO-8601 instant \| null | |
| `createdByUserId` | UUID | the user who called `POST /` |
| `createdAt` | ISO-8601 instant | |
| `appetiteCategories` | `RiskAppetiteCategoryResponse[]` | `{ id, name, statement, sortOrder }` |
| `likelihoodBands` | `{ probability: RiskLikelihoodBandResponse[], timeline: RiskLikelihoodBandResponse[] }` | each band `{ id, position, label, minValue, maxValue }` |
| `impactParameters` | `RiskImpactParameterResponse[]` | `{ id, name, enabled, mode, sortOrder, bands: RiskImpactBandResponse[] }`, each band `{ id, position, label, minValue, maxValue }` |

### 17.8 Enums

- `ReviewFrequency`: `MONTHLY`, `QUARTERLY`, `ANNUALLY`
- `LikelihoodMode`: `PROBABILITY`, `TIMELINE`, `BOTH`
- `ImpactMode` (impact parameter responses only): `QUANTITATIVE`, `QUALITATIVE`, `BOTH`
- `ApprovalDecision` (decision request only): `APPROVE`, `REJECT`, `REQUEST_REVISION`

---

## 18. Example end-to-end Postman flows

### 18.1 Build a tree by hand, then set up risk strategy

1. `POST /api/v1/auth/login` → capture `accessToken` / `organizationId`.
2. `GET /api/v1/organizations/{{organizationId}}/modules` → confirm
   `GOVERNANCE` is in the enabled list (if not, see §13).
3. `POST /api/v1/organizations/{{organizationId}}/org-nodes` (root, no
   `parentId`) → capture `id` as `orgNodeId`.
4. `POST /api/v1/organizations/{{organizationId}}/org-nodes` again with
   `"parentId": "{{orgNodeId}}"` → a child node.
5. `GET /api/v1/organizations/{{organizationId}}/org-nodes?scopeRootNodeId={{orgNodeId}}`
   → confirm both nodes come back.
6. `POST /api/v1/organizations/{{organizationId}}/risk-strategy` — either a
   full `appetiteCategories`/`likelihoodBands`/`impactParameters` payload
   (§17.4) or just `{"levels": 3, "likelihoodMode": "BOTH", "reviewFrequency": "ANNUALLY"}`
   to get the auto-seeded prototype defaults on this first version → capture
   `id` as `riskStrategyConfigId`; note `"current": false` if approval is
   required.
7. `POST /api/v1/organizations/{{organizationId}}/risk-strategy/{{riskStrategyConfigId}}/decision`
   with `{"decision": "APPROVE"}` → `"current": true`.
8. `GET /api/v1/organizations/{{organizationId}}/risk-strategy/current` →
   confirms it now returns the version from step 6/7.

### 18.2 Adopt a template instead of building by hand

1. `POST /api/v1/auth/login` with **no `organizationId`** → platform token.
2. `POST /api/v1/platform/org-node-templates` (needs
   `platform.orgnode.manage` granted to this user) with a nested tree body
   (§16.3) → capture `id` as `orgNodeTemplateId`.
3. `GET /api/v1/platform/org-node-templates/{{orgNodeTemplateId}}/preview` →
   sanity-check the structure before adopting it.
4. `POST /api/v1/auth/login` again, this time **with `organizationId`** →
   org-scoped `accessToken`.
5. `POST /api/v1/organizations/{{organizationId}}/org-nodes/clone-template`
   with `{"templateId": "{{orgNodeTemplateId}}"}` → capture the response
   `id` as `orgNodeId` (the cloned root).
6. `GET /api/v1/organizations/{{organizationId}}/org-nodes?scopeRootNodeId={{orgNodeId}}`
   → confirms the whole cloned subtree landed in this org, independently of
   the template.
7. Continue from step 6 of §18.1 to set up risk strategy on top of the newly
   cloned tree.
