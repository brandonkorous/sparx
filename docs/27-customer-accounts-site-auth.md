# sparx Platform — Customer Accounts & Site Authentication (Layer 2)

**Version:** 2.3
**Author:** Brandon Korous
**Last Updated:** 2026-07-02

---

## 0. What changed in 2.0 (and why)

Layer 2 (site shoppers) was originally a **purpose-built, tenant-scoped auth module**
(`@sparx/customer-auth`, v1.x of this doc): Argon2id + opaque SHA-256 sessions, deliberately
_not_ Better Auth because Better Auth keys credential sign-in on a **globally unique email**
and shoppers must be able to register the same email at different tenants as separate accounts.

That reasoning was correct for password login. It is **no longer sufficient**, because Layer 2
now has to issue **OAuth 2.1 access tokens to shoppers** — the site MCP plane
([docs/113](113-site-mcp.md)) lets a tenant's customers point their own LLM at a store to
browse, book, and buy. A shopper authenticating an MCP client is an OAuth authorization-code +
DCR + PKCE flow. We already built exactly that flow, hardened per OAuth 2.1, for **staff**
([docs/07 §5](07-mcp-server-spec.md)) — as Better Auth's `mcp()` plugin on the staff instance.

Hand-rolling a second OAuth authorization server for shoppers would re-solve — worse — the exact
problem [docs/16 §1](16-auth-security.md) says never to hand-roll (token rotation, PKCE, consent,
DCR, confused-deputy defense). The audited implementation we trust is Better Auth's. But Better
Auth's `mcp()` plugin issues tokens for **the session of whoever is signed into that Better Auth
instance** — so for it to mint shopper tokens, the shopper's identity has to live in Better Auth.

**Decision (this version): Layer 2 moves to Better Auth**, as a **dedicated customer instance**
with **application-level multi-tenancy** so `(tenantId, email)` — not a global email — is the
effective identity key. The same email remains a separate account per tenant. In exchange we get
the hardened `mcp()` OAuth for free, plus social login / passkeys / MFA when we want them, and one
auth stack instead of two. The staff instance (Layer 1) is untouched.

This reverses §2 of v1.x. The old design's **security properties and per-site semantics are
preserved verbatim** (§7) — this is a swap of the identity/credential/session _engine_, not of
the surrounding model.

---

## 1. Scope

- **In:** register / login / logout / session / password-reset for site shoppers, tenant-scoped,
  on Better Auth. Social login is now _possible_ (per-tenant) but ships dark until enabled. The
  per-site membership model (docs/58) and the account area (orders, addresses, wishlist, profile,
  B2B portal) are unchanged. The shopper MCP OAuth authorization server.
- **Out (still):** customer MFA/passkeys UI (schema-ready via Better Auth, no UI this slice);
  B2B approval chains / net-terms (Layer 2½, the B2B module).

---

## 2. The five-tier model is unchanged; only Layer 2's engine moves

[docs/16 §2](16-auth-security.md) still stands: five distinct principals, each with its own
identity store and isolation boundary. Conflating tiers is a security bug. What changes is Layer
2's row: identity store becomes **"Better Auth (customer instance, tenant-scoped)"** instead of
`@sparx/customer-auth`'s bespoke tables. It is still **one tenant, RLS-isolated**, still a
first-party `sparx_customer_session` cookie, still completely separate from the staff instance.

**Isolation between the two Better Auth instances is mandatory and total:**

| Concern          | Staff instance (Layer 1)          | Customer instance (Layer 2)                            |
| ---------------- | --------------------------------- | ------------------------------------------------------ |
| Package          | `@sparx/auth`                     | `@sparx/customer-auth`                                 |
| Secret           | `BETTER_AUTH_SECRET`              | `CUSTOMER_AUTH_SECRET` (distinct)                      |
| Cookie           | `better-auth.session_token` (app) | `sparx_customer_session` (site origin)                 |
| Email uniqueness | global (`users.email @unique`)    | **per-tenant** (`(tenant_id, email)` composite)        |
| Tables           | `users/sessions/accounts/…`       | `customer_users/customer_sessions/customer_accounts/…` |
| DB role / RLS    | `sparx_owner`, ENABLE-only        | tenant-scoped client, **ENABLE + FORCE** RLS           |
| Org plugin       | yes (Organization = Tenant)       | no                                                     |

A customer token can never authenticate a staff request and vice-versa: different secret,
different cookie, different tables, different resource audience.

---

## 3. Application-level multi-tenancy — the mechanism

Better Auth's data access goes through a single **adapter** instance (a singleton created once
per process). Sign-in does `findOne(user, { email })` with no tenant in the predicate. To make
`(tenantId, email)` the key without namespacing the email column or forking Better Auth, we scope
at **two independent layers** — the app layer (adapter) and the database layer (RLS) — so a bug in
either alone cannot leak across tenants.

### 3.1 Request-scoped tenant context (AsyncLocalStorage)

For a shopper the tenant is known **before** authentication — it is the site host
(`acme.sparx.zone`, or `?tenant=acme`), resolved exactly as the rest of the public surface
already does. api-rest carries it to the adapter through a new **request-scoped
`AsyncLocalStorage`** (`@sparx/db` → `tenantStore`): a Fastify `preHandler` on the customer-auth
routes resolves the tenant slug → id and runs the handler inside `tenantStore.run({ tenantId }, …)`.

This is the one genuinely new primitive. Today `withTenant(tenantId, fn)` takes the tenant
**explicitly**; the Better Auth adapter can't be handed it call-by-call, so it reads the ambient
`tenantStore`. `tenantStore.getTenantIdOrThrow()` **fails closed** — if a customer-auth adapter
op ever runs with no tenant in context, it throws rather than executing an unscoped query.

### 3.2 The tenant-scoping adapter

`@sparx/customer-auth` builds its Better Auth instance on the **stock `prismaAdapter`**, but hands
it a **tenant-scoping Proxy** over the shared `@sparx/db` client instead of the raw client. The
Proxy does two things and nothing else, so all of Better Auth's audited where/select/join logic is
reused verbatim:

1. **Remaps the plugin OAuth model keys.** Better Auth's `mcp()` plugin addresses its tables by the
   fixed keys `oauthApplication` / `oauthAccessToken` / `oauthConsent` (verified in the installed
   source — plugin model names are NOT overridable via config, unlike the core four which use
   `modelName`). The Proxy maps those three keys to the customer models
   (`customerOauthApplication` / …), so the customer instance can never touch the **staff** OAuth
   tables. The core four are remapped the supported way: `user/session/account/verification` →
   `customerUser/customerSession/customerAccount/customerVerification` via `modelName` options.
2. **Sets the tenant GUC per operation.** Every model op runs inside the codebase's proven RLS
   transaction — `withTenant(tenantStore.getTenantIdOrThrow(), tx ⇒ tx.<model>.<op>(args))` on the
   default `sparx_app` (NOBYPASSRLS) client — so `SET LOCAL app.tenant_id` is set for the query and
   RLS enforces the scope. `$transaction` (used by Better Auth's atomic verification-consume) runs
   the whole callback inside one such tenant-scoped transaction.

The result:

- **Reads** (`findOne`/`findMany`/`count`) are filtered by RLS at the database. `findUserByEmail`
  returns only the current tenant's row; another tenant's identical email is invisible. No app-tier
  where-injection is relied upon for correctness — the DB enforces it.
- **Writes** (`create`/`update`/`delete`) run under the same GUC; the `tenant_id` column
  **defaults to `current_tenant_id()`**, so BA's inserts (which never carry a `tenant_id` — BA is
  tenant-oblivious) are stamped with the right tenant automatically and the `WITH CHECK` clause
  rejects any cross-tenant write.

This is the "custom database adapter injecting tenantId" pattern — realized as a **DB-enforced**
scope (strictly stronger than app-tier filtering), reusing the stock adapter, and identical in
spirit to `withTenant()`. The customer tables are ordinary `@sparx/db` Prisma models (schema 48),
so they flow through the one migration pipeline — no second Prisma client or schema.

### 3.3 The database backstop (RLS + composite unique)

Every customer-instance table is tenant-scoped with **ENABLE + FORCE** RLS and a
`tenant_isolation` policy on `current_tenant_id()` — the same pattern as every other tenant table,
and strictly safer than the staff auth tables (which are ENABLE-only so the owner connection can
read them pre-tenant; customer auth never needs a pre-tenant read). The user table carries
`@@unique([tenant_id, email])` — dropping the global-email assumption and enforcing per-tenant
uniqueness at the database. Social accounts are `@@unique([tenant_id, provider_id, account_id])`
so the same Google account is a separate shopper per tenant. Verifications are scoped by
`(tenant_id, identifier)`.

**Net:** correctness rests on RLS (DB-enforced), the adapter guarantees the GUC is set (fail-closed
via ALS), and the composite uniques make cross-tenant collisions impossible at the storage layer.
Three independent guards, no single point of failure.

### 3.4 Session is tenant-bound (an app-layer check independent of RLS)

RLS scopes the session lookup, but a defense that rests on a single mechanism is one bypass away
from a leak — as the `cookieCache` incident proved (§8): Better Auth's session cookie cache returns
the session from a **secret-signed cookie with no DB read**, so a tenant-A cookie presented under a
`?tenant=B` request resolved to tenant-A's user. `cookieCache` is therefore **disabled** (every
`getSession` must hit `customer_sessions` under `withTenant`), and — belt-and-suspenders — the
session is **tagged with its `tenant_id`** (a Better Auth `session.additionalFields` entry,
`input: false`, populated by the DB default) and `getCustomerSession` **asserts
`session.tenantId === ctx.tenantId`**, failing closed on any mismatch or absence. This check runs in
application code on the data Better Auth returns, so it independently rejects a cross-tenant session
even if it were ever obtained via a path that skipped the RLS-scoped query. A session cookie now
authenticates a `(tenant, user)` pair, not a user alone.

---

## 4. Data model

The **CRM `customers` spine is preserved untouched** — it owns the per-site membership, orders,
consent, LTV, and 37 downstream FKs (docs/58). Only the identity/credential/session/reset layer
becomes Better-Auth-owned. `customers.auth_user_id` — the plain-UUID column reserved in schema 20
for exactly this ("will FK to a customer-auth-layer table when that module lands") — becomes the
canonical link to the Better Auth customer user. The old `identity_id` FK and the
`customer_identities` table are retired.

### 4.1 New Better-Auth-owned tables (`packages/db/prisma/schema/48-customer-auth.prisma`, rewritten)

Better Auth's core schema (user / session / account / verification), mapped to `customer_*`
tables, each with `tenant_id` + FORCE RLS. Names are chosen to not collide with the retired
opaque `customer_sessions` (which is dropped first in the migration).

| Better Auth model | Table                    | sparx additions                                                                                          |
| ----------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `user`            | `customer_users`         | `tenant_id`; `@@unique([tenant_id, email])`; `default current_tenant_id()`                               |
| `account`         | `customer_accounts`      | `tenant_id`; `@@unique([tenant_id, provider_id, account_id])`; holds credential password + social tokens |
| `session`         | `customer_sessions`      | `tenant_id`; `token @unique`; `ip_address`/`user_agent`                                                  |
| `verification`    | `customer_verifications` | `tenant_id`; `@@index([tenant_id, identifier])`                                                          |

Plus the customer-scoped OAuth tables the `mcp()` plugin needs (mirroring the staff
`oauth_applications` / `oauth_access_tokens` / `oauth_consents`, prefixed `customer_oauth_*` and
carrying `tenant_id`): a registered DCR client and its tokens belong to a shopper at a tenant.

`customers` change: drop the `identity_id` column + FK + `CustomerIdentity` relation; keep
`auth_user_id` and add FK `auth_user_id → customer_users.id` (`onDelete: SetNull`). A `customers`
row with `auth_user_id = null` is a **guest / CRM-imported contact with no login** (unchanged
semantics — guest checkout stays first-class).

### 4.2 Migration & cutover

One hand-authored migration (authored against docker Postgres, applied **only** through the DB
Migrate pipeline — [packages/db/CLAUDE.md](../packages/db/CLAUDE.md)):

1. Create `customer_users` / `customer_accounts` / `customer_sessions` (new) / `customer_verifications`
   / `customer_oauth_*`, each ENABLE + FORCE RLS + `tenant_isolation`, `tenant_id` default
   `current_tenant_id()`, composite uniques. `updated_at` columns `DROP DEFAULT` (the `@updatedAt`
   drift guard every prior migration applies).
2. **Backfill** (passwords cannot be re-minted): `customer_users` ← one row per
   `customer_identities` (preserve `id`, carry `email`, `email_verified`); `customer_accounts` ←
   one `provider_id='credential'` row per `customer_credentials` (`account_id = user_id`,
   `password = password_hash`). Argon2id hashes are compatible — Better Auth verifies Argon2 and
   rehashes on next login if needed.
3. `UPDATE customers SET auth_user_id = identity_id WHERE identity_id IS NOT NULL`.
4. Drop the old opaque `customer_sessions` **before** creating the new same-named BA table;
   drop `customer_password_resets`, `customer_credentials`, and `customer_identities`; drop the
   `customers.identity_id` column + FK.

The backfill runs **per-tenant** (loop `set_config('app.tenant_id', …)`) because `sparx_owner` is a
non-superuser in prod and FORCE-RLS tables return zero rows otherwise — the standard
FORCE-RLS-backfill footgun (packages/db/CLAUDE.md).

**Cutover cost, stated plainly:** existing shopper **sessions and pending reset tokens are dropped**
— every logged-in shopper is signed out once and re-logs-in with their existing password. This is
deliberate: sessions/reset-tokens are short-lived and cheaply re-minted, and forcing re-login on an
auth-engine swap is safer than trying to port opaque tokens into Better Auth's session model.

---

## 5. `@sparx/customer-auth` — rewritten around Better Auth

The package keeps its name and its role ("the Layer-2 auth package; server-only; api-rest is the
only caller"), and re-exports a compatible-enough surface so the blast radius on callers is small.
Internally it becomes a Better Auth instance + helpers:

```
packages/customer-auth/src/
  tenant-adapter.ts // tenant-scoping Proxy over @sparx/db → prismaAdapter (§3.2): plugin-key
                    //   remap + per-op withTenant(tenantStore, …) on the sparx_app client
  server.ts        // betterAuth({ … emailAndPassword, mcp(), user/session/account/verification
                   //   modelName overrides, tenant-scoping adapter … }) — one instance, cached
  session.ts       // SESSION_COOKIE_NAME/OPTIONS constants (unchanged names) + helpers
  service.ts       // thin wrappers api-rest calls: register/authenticate/verify/revoke/reset,
                   //   each run inside tenantStore.run() then delegate to auth.api.*, returning {userId,…}
  membership.ts    // ensureMembership() — docs/58 per-site membership + D6 recognition (ported verbatim)
  mcp-verify.ts    // verifyCustomerMcpToken(accessToken) → {tenantId,userId,scopes} (raw SQL, checks expiry)
  errors.ts        // CustomerAuthError { EMAIL_TAKEN | INVALID_INPUT | … } (unchanged)
  index.ts         // barrel
```

The instance uses the **default `sparx_app` client** (via `withTenant`), not a dedicated owner
client — customer auth always knows its tenant (the ALS), so it needs no pre-tenant/owner read and
runs entirely under RLS, strictly safer than the staff instance's owner connection.

- **Password hashing** is Better Auth's Argon2 (docs/16 §1 already commits to Argon2 for Layer 1),
  configured to match the current parameters; the backfilled hashes verify directly.
- **Sessions** become Better Auth sessions (`customer_sessions.token`), still delivered in the same
  `sparx_customer_session` httpOnly cookie so the site + proxy + MCP relay are unchanged.
- **Password reset** uses Better Auth's `sendResetPassword`, publishing the existing
  `email.send` Pub/Sub event (never a direct send) — same template, same enumeration-safe caller.
- **Membership + recognition (docs/58 D2/D6) is preserved** — see §7. The Better Auth user is the
  tenant-wide **identity** (one per `(tenant, email)`); the per-site `customers` membership is
  resolved from `(userId, propertyId)` on each authenticated request via `ensureMembership`, which
  creates a membership with **fresh consent** on a first cross-site visit exactly as before.

---

## 6. api-rest surface + the MCP OAuth authorization server

Keeping **"the site talks to api-rest only"** (API-first), the customer Better Auth handler is
served by api-rest, not mounted in `apps/site`:

- A new `publicAuth` route group mounts the Better Auth handler under `/v1/public/auth/*`
  (Fastify → Web `Request`/`Response` adaptation), behind a **`preHandler` that resolves the tenant
  from `?tenant=` and enters `tenantStore.run({ tenantId }, …)`** so every BA op is scoped.
- The existing `/v1/public/commerce/account/*` routes (register / login / logout / me / orders /
  addresses / wishlist / password reset) are **rewired** to call the new `@sparx/customer-auth`
  service wrappers instead of the old bespoke functions. Their external contract (paths, request/
  response envelopes, the `sparx_customer_session` cookie, enumeration-safety, rate limits,
  `recognized` signal, cart-claim) is **unchanged** — `apps/site` needs no change.
- The **`mcp()` plugin** on the customer instance exposes the OAuth authorization server
  (`/.well-known/oauth-authorization-server`, `/authorize`, `/token`, `/register`) under the same
  `/v1/public/auth/*` mount, with the **same hardening as the operator flow** (docs/07 §5): a
  first-party consent page bound to the shopper's session, `requirePKCE` + S256 only, short TTLs,
  and a token-verify query that checks expiry + client-enabled (never a bare row lookup). The
  `loginPage` is the store's `/account/login` (a browser redirect across origins is fine).
- The site MCP resource server (`services/mcp-site`, docs/113) advertises this AS via
  `WWW-Authenticate` + `/.well-known/oauth-protected-resource`, relays the shopper's bearer, and —
  because it holds **no DB** — bearer **verification happens in api-rest**: the `customer`-tier
  public routes accept an `Authorization: Bearer` credential (verified with
  `verifyCustomerMcpToken(tenantId, token)` — expiry + client-enabled + tenant-scoping via RLS),
  resolve the per-site membership via `ensureMembership`, and **scope-gate** each route on the
  token's grant. This unlocks the `customer`-kind tools (my orders / bookings / reschedule / cancel
  / wishlist / addresses / B2B portal).

### 6.1 The finalized topology — the AS lives on the store's OWN origin (Phase 2G, built)

The one load-bearing decision: Better Auth's `/mcp/authorize` must read the shopper's session cookie
to know who is consenting, and a cookie is only sent to its own origin. So the AS is reached **on the
store's own origin**, not on a shared api-rest host:

- **Caddy** carves `<store>/v1/public/auth*` and the store-root
  `/.well-known/oauth-authorization-server` + `/.well-known/openid-configuration` out to api-rest
  (Host preserved), alongside the existing `/mcp*` → mcp-site carve-out. So the whole OAuth
  flow — discovery, DCR, authorize, consent, token — happens on `https://<store>`; the browser keeps
  its `sparx_customer_session` cookie throughout, and **tenant resolves from the Host**
  (`resolveSiteByHost`, `?tenant=` fallback for local dev).
- **Discovery.** mcp-site answers an unauthenticated `customer`-tool call with `401` +
  `WWW-Authenticate: resource_metadata="…/mcp/.well-known/oauth-protected-resource"`; that doc's
  `authorization_servers` points at the store's own origin (`siteUrl`, from `site-info`).
  api-rest serves **our own** AS metadata at `<store>/.well-known/oauth-authorization-server` (Better
  Auth's default only advertises the openid framing scopes, so we replace it) listing the real
  shopper scope vocabulary + the store-origin `/v1/public/auth/mcp/{authorize,token,register}`
  endpoints.
- **Consent.** The `/mcp/authorize` guard (`@sparx/customer-auth` server.ts, mirroring the operator
  `mcpAuthorizeGuard`) bounces any authorize without a valid grant to the **store-branded**
  `<store>/account/authorize` page (`apps/site`). That page confirms the signed-in shopper (redirects
  to the store `/account/login` otherwise), shows the scope picker, and POSTs to
  `/v1/public/auth/consent`, which caps the selected scopes, mints a **signed, session-bound consent
  grant** (HMAC on the customer secret, `signCustomerConsentGrant`), and returns the store-origin
  `/mcp/authorize?…&sparx_grant=` URL. The guard verifies the grant binds the exact client + redirect
  - scope + the signed-in user before Better Auth mints the code.
- **api-rest ↔ Web bridge.** The Better Auth `handler(Request): Promise<Response>` is mounted via a
  Fastify↔Web adapter (`lib/customer-oauth.ts`) run inside `tenantStore.run(tenantId, …)`; a child
  route scope keeps RAW-string content-type parsers so BA re-parses the form-encoded token body
  itself, without disturbing the JSON consent routes.

---

## 7. Preserved from v1.x (do not regress)

These properties are non-negotiable and carry over unchanged — they are re-asserted here because
the engine swap must not quietly drop them:

- **Per-tenant identity.** Same email = separate account per tenant. Now enforced by
  `@@unique([tenant_id, email])` + FORCE RLS + the tenant-scoping adapter (§3), not by a bespoke
  lookup. A shopper at tenant A has zero relationship to tenant B.
- **Per-site membership & recognition (docs/58 D2/D6).** The tenant-wide login (BA user) maps to a
  per-site `customers` membership each; a first sign-in on a sister site creates a membership with
  **fresh consent**, never inheriting another site's consent; `recognized` still surfaces "you
  already have an account on a sister site."
- **Enumeration-safety + timing flatness.** Login and password-reset-request return identically
  whether or not the account exists; login spends comparable CPU on a miss. (Better Auth's
  email/password flow is enumeration-safe; the reset caller only sends mail when an account exists.)
- **Hashes only, tokens hashed.** Passwords stored only as Argon2id hashes; session tokens are
  Better Auth's hashed session tokens; the plaintext lives only in the cookie / reset link.
- **Guest checkout stays first-class.** A `customers` row with `auth_user_id = null` is a valid
  guest; cart-claim on auth is unchanged.
- **Cookie scope & custom domains.** `sparx_customer_session` is httpOnly / SameSite=Lax / Path=/
  (`Secure` in prod), first-party per site origin, no `Domain=` — each origin isolates.
- **No cross-package contamination.** Customer auth never imports or mutates `@sparx/auth` (the
  staff instance) or its tables, and vice-versa.

---

## 8. Security checklist (target state)

- [ ] Two Better Auth instances, fully isolated (distinct secret, cookie, tables, resource); a
      customer token cannot authenticate a staff request or vice-versa.
- [ ] All `customer_*` tables ENABLE + FORCE RLS with `tenant_isolation`; verified by a cross-tenant
      integration test (a session/user minted for tenant A is invisible under tenant B) **and**
      `pg_policies`.
- [ ] `tenantStore` fails closed — a customer-auth adapter op with no ambient tenant throws.
- [ ] `@@unique([tenant_id, email])` on `customer_users`; social accounts unique per tenant.
- [ ] `tenant_id` defaults to `current_tenant_id()` so BA inserts are auto-stamped; `WITH CHECK`
      rejects cross-tenant writes.
- [ ] MCP OAuth: DCR rate-limited, `requirePKCE` + S256 only, short access-token/code TTLs,
      consent bound to the shopper session, token verification checks expiry + client-enabled.
- [ ] Backfill preserves Argon2id hashes; no plaintext anywhere; sessions/reset-tokens dropped on
      cutover (all shoppers re-login once).
- [ ] Enumeration-safety + timing flatness retained on login + reset-request.
- [ ] docs/58 membership/recognition + fresh-consent-per-site retained (integration test).

---

## 9. Open decisions

- **Social login default.** Google/Apple are now possible per-tenant but ship **dark** (no provider
  registered until a tenant enables it), so the site login stays password-only by default —
  matching the old "keeps it clean" stance until a tenant opts in.
- **Email verification before first login.** Still `false` by default (the 5-minute-store goal),
  opt-in per tenant later — unchanged from v1.x §10.
- **Passkeys / MFA for shoppers.** Schema-ready via Better Auth plugins; no UI this slice.
