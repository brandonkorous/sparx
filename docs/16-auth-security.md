# sparx Platform — Authentication, Multi-Tenancy & Security

**Version:** 2.5
**Author:** Brandon Korous
**Last Updated:** 2026-07-23

---

## 1. Authentication Strategy — Better Auth

sparx uses **Better Auth** (betterauth.dev) as the authentication foundation. Better Auth is open source, self-hosted, TypeScript-native, and handles all core auth primitives without a SaaS dependency.

### Why Better Auth Over Rolling Our Own

Rolling auth primitives from scratch — password hashing, token rotation, MFA, OAuth flows — is high-risk with low upside. The failure modes (timing attacks, token theft, CSRF, credential stuffing) are severe and well-documented. Better Auth solves these correctly and is auditable since it's open source.

### Why Better Auth Over Auth0 / Clerk / Supabase Auth

- **No SaaS dependency** — runs on our infrastructure, our database, our rules
- **No per-user pricing** — critical for a multi-tenant platform with thousands of tenant customers
- **TypeScript-native** — first-class types, integrates cleanly with Fastify and Next.js
- **Multi-tenant / organizations built in** — maps directly to our tenant model
- **Full control** — customize any behavior without waiting for a vendor roadmap

### What Better Auth Provides

- Email/password authentication with secure hashing (Argon2)
- Magic link (passwordless) authentication
- OAuth2 social login (Google, GitHub, Apple — tenant staff)
- Multi-factor authentication (TOTP, SMS)
- Session management with refresh token rotation
- Organization/tenant management (maps to our tenant model)
- API key management
- Rate limiting on auth endpoints
- Brute force protection
- Device session tracking (list active sessions, revoke specific sessions)

---

## 2. Auth Layers — the identity tier model

sparx authenticates **five distinct kinds of principal**, each with its own identity store, isolation boundary, and session mechanism. Conflating any two of them is a security bug — a tenant customer is not a tenant staff member, and neither is a WizeWorks operator. The tiers:

| #   | Tier                       | Who                                           | Identity store                                               | Isolation                                            | Session / credential                      | Status                                      |
| --- | -------------------------- | --------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| 1   | **Tenant Staff**           | People running a sparx tenant account         | Better Auth (organization member)                            | One tenant (`tid` in every token)                    | JWT 15 min + rotating refresh (HTTP-only) | ✅ Built                                    |
| 2   | **Tenant Customer**        | Shoppers/members of a tenant's site           | **Better Auth** — customer instance, tenant-scoped (docs/27) | One tenant, RLS-isolated (`(tenant_id, email)` key)  | `sparx_customer_session` cookie           | 🔄 Moving to Better Auth (docs/27 v2)       |
| 3   | **Programmatic (API key)** | Headless frontends, MCP, integrations         | `api_keys` table (SHA-256 hash)                              | One tenant, scope-limited                            | `sparx_live_…` bearer key                 | ✅ Built                                    |
| 4   | **Platform Operator**      | WizeWorks staff operating the platform itself | Separate WizeWorks Better Auth staff instance (§2.4)         | **Cross-tenant**, via audited `/internal/operator/*` | `wizeworks/apps/admin` console session    | ✅ Built — read-only, no impersonation (D7) |
| 5   | **System / Internal**      | Machine-to-machine service calls (cron, push) | Shared secret in Secret Manager                              | Cross-tenant, ClusterIP-only                         | `X-sparx-Internal-*-Token` header         | ✅ Built (§2.5)                             |

The rule that ties them together: **a session is scoped to the narrowest tier that satisfies the request.** A site shopper never receives a staff token; a staff member never receives a cross-tenant operator capability; an internal service call never rides on a human's session. Crossing a tier boundary is always an explicit, audited hop (e.g. a staff member impersonating a customer for support, once §2.4 ships), never an implicit widening of an existing token.

### Layer 1 — Tenant Staff (Tenant Users)

Staff members managing a sparx tenant account.

```
Tenant Owner (Brandon's contact at GDS)
├── Creates sparx account → becomes tenant owner
├── Invites staff → they receive email invite → set password
├── Staff auth: email/password OR magic link OR Google OAuth
└── Session: JWT (15 min) + refresh token (30 day, HTTP-only cookie)
```

Better Auth's organization plugin maps directly: **Organization = Tenant**. Organization member = Staff user with role.

- Organization = Tenant
- Organization member = Staff user with role
- Roles: owner | admin | editor | viewer

Example: Tenant Owner (e.g., Brandon's contact at Gillett Diesel Service) creates a sparx account → becomes tenant owner → invites staff via Better Auth's organization invitations.

### Layer 2 — Tenant's Customers (Site Users)

End customers logging into a tenant's site, B2B portal, or account page.

```
Customer of a tenant's site
├── Registers on the tenant's storefront (host = the tenant, known before auth)
├── Auth scoped to that tenant (cannot log into other tenants' sites)
├── Email/password (social/passkey/MFA available per-tenant, ship dark by default)
└── Session: sparx_customer_session cookie, tenant-scoped; can mint shopper MCP OAuth tokens
```

Critical: a customer account at Tenant A has zero relationship to Tenant B. The same email address can register as a customer at multiple tenants — completely separate records with separate credentials.

**Engine (docs/27 v2):** Layer 2 runs on a **dedicated Better Auth instance**, separate from the staff instance in every dimension (secret, cookie, tables, resource). Better Auth normally keys sign-in on a **globally unique** email; sparx needs `(tenant_id, email)`, so the customer instance uses **application-level multi-tenancy** — the tenant is resolved from the storefront host into a request-scoped `AsyncLocalStorage`, and a **tenant-scoping adapter** runs every Better Auth operation inside a `SET LOCAL app.tenant_id` transaction. Correctness is DB-enforced (ENABLE + FORCE RLS + `@@unique([tenant_id, email])`), with the adapter guaranteeing the GUC is set (fail-closed). Moving Layer 2 onto Better Auth is what lets shoppers authenticate an MCP client via the **same hardened `mcp()` OAuth flow the staff plane uses** (docs/07 §5, docs/113) instead of a hand-rolled authorization server. The CRM `customers` spine (per-site membership, orders, consent, docs/58) is unchanged and links to the Better Auth user via `customers.auth_user_id`.

### Layer 3 — API Keys (Programmatic Access)

For headless frontends, MCP servers, and third-party integrations.

```
Format: sparx_live_{tenant_short_id}_{32_random_hex}
        sparx_test_{tenant_short_id}_{32_random_hex}

Storage: Full key shown once at creation
         SHA-256 hash stored in DB for lookup
         Prefix + tenant_short_id stored for identification
         (Display prefix `sx_live_` + short tenant ID is stored
          alongside the hash for identification; the secret portion
          is hashed and never persisted.)

Scopes: Granular (read:orders, write:inventory, mcp:read, etc.)
Expiry: Optional — set at creation (none, 30d, 90d, 1y)
Rotation: Old key valid for configurable overlap window
```

### Layer 4 — Platform Operator (WizeWorks Staff) — SHIPPED as the read-only admin console

> **Reconciled 2026-07-22 (docs-vs-built audit):** This tier is **no longer deferred** — it shipped as the WizeWorks operations console (`wizeworks/apps/admin`, `app/(console)/sparx/*`), built exactly along the "Design for when it ships" lines below **except impersonation**: operators authenticate against a **separate WizeWorks Better Auth staff instance** (no `tid`, not a tenant `users` row), permissions are **capability-scoped and default-deny** (`support:read`, `billing:read`, `module:toggle`, …), and every cross-tenant read **and** write routes through audited api-rest `/internal/operator/*` endpoints (no ambient `BYPASSRLS`; the admin DB role only sees `wize_admin`). **Tenant impersonation was deliberately NOT built** (decision **D7**): there is no `impersonation_grants` table and no `tenant:impersonate` capability — operators get a **read-only account view** with representation parity instead, and the tenant app is untouched. **MFA status (updated 2026-07-23 — now SHIPPED):** passkeys, email OTP, and magic link were already wired in `wizeworks/packages/auth` (`@better-auth/passkey`, `emailOTP`, `magicLink`); **authenticator-app TOTP now is too**, on both auth instances, and the "MFA mandatory for operators" requirement below **is enforced**. Specifically:

- **Tenant staff — offered.** `twoFactor()` in `wizeworks/packages/auth/src/server.ts`, storage in `two_factors` (migration `20270114000000_two_factor_totp`, ENABLE-not-FORCE RLS like `passkeys`). Turned on from the workbench Security pane; sign-in gains a challenge step with a backup-code fallback and an opt-in 30-day trusted device.
- **Operators — MANDATORY.** `twoFactor()` in `wizeworks/packages/operator-auth/src/server.ts` over its own `wize_admin.platform_operator_two_factors` table (migration `20270114000001_operator_two_factor`). Enforcement is at the gate, not in a banner: `requireOperator()` redirects any operator without a completed enrollment to `/two-factor-setup` and nowhere else, so a password-only operator session reaches no console surface. The setup route is the single `allowUnenrolled` caller.
- **Backup codes are stored ENCRYPTED on both instances** (`storeBackupCodes: 'encrypted'`). The plugin's default is plain text, so this override is load-bearing, not decorative — and the same class of fix as the existing `storeToken: 'hashed'` / `storeOTP: 'hashed'` settings on magic link and email OTP.
- Enabling always requires proving a generated code first (`skipVerificationOnEnable: false`), so a mis-scanned QR cannot lock anyone out.

The prose below is retained as the design rationale.

WizeWorks employees who operate the **platform itself** — support engineers answering a tenant ticket, finance reading cross-tenant revenue, growth reading acquisition by channel — are a **fundamentally different principal** from a tenant staff member. A tenant staff member belongs to exactly one tenant and must never see another tenant's data; a platform operator's entire job is the cross-tenant view.

**This tier does not exist yet, and that is a deliberate Phase-1 decision.** Building a cross-tenant superuser is the single highest-blast-radius thing the platform can have — one compromised operator credential reads every tenant's data. We defer it until there is a concrete operational need that the interim mechanism (below) can't serve, and until we can build it correctly. Until then:

- There is **no login that grants cross-tenant access.** Every interactive session — staff or customer — is pinned to one tenant via `tid` and re-validated against RLS. There is no "view all tenants" toggle anywhere in the dashboard.
- Cross-tenant reads that genuinely must happen today (e.g. the acquisition report, docs/80 §10) run as **System/Internal principals** (§2.5): ClusterIP-only endpoints behind a shared-secret header, invoked by an operator with `kubectl`/`curl` or a CronJob — never exposed to the public internet, never behind a human dashboard login.

**Why not "just add an `is_staff` flag to the users table"?** Because it collapses the isolation boundary that the entire RLS model rests on. A `users` row is a tenant member; the moment one of them can read across tenants, the `tid`-in-token invariant and the FORCE-RLS backstop (§4) both stop being true, and every authorization check downstream has to grow a special case. The operator tier must be a **separate identity, not a privileged tenant user.**

#### Design for when it ships

When the operational need arrives, build it as its own tier — do not retrofit it onto Layer 1:

- **Separate identity store.** Operators authenticate against a distinct principal set (a separate Better Auth instance/organization reserved for WizeWorks, or a dedicated `platform_operators` table) — not a row in any tenant's `users`. An operator has **no** `tid`; they are explicitly tenant-less until they assume a tenant context.
- **Capability-scoped, not role-scoped.** Operator permissions are explicit capabilities (`support:read`, `billing:read`, `acquisition:read`, `tenant:impersonate`, `tenant:suspend`), granted individually and defaulting to none. There is no "operator admin" that implies everything.
- **No ambient RLS bypass.** Operators do **not** get `BYPASSRLS`. Cross-tenant reads go through explicit, audited service functions that either (a) query intentionally-global tables (`tenants`, `plans`) directly, or (b) loop tenant contexts with `set_config('app.tenant_id', …)` one tenant at a time. The default posture stays "RLS is enforced"; cross-tenant access is a named, logged operation, not a property of the connection.
- **Tenant impersonation is an explicit, time-boxed, audited hop.** To act _inside_ a tenant (support), an operator mints a short-lived, single-tenant **impersonation token** — a normal Layer-1 staff token stamped with `tid`, `actor_type: 'operator'`, the operator's real id, and a hard expiry. Every action it takes is audit-logged as an impersonation (§7), and the tenant owner can see it. The operator's cross-tenant identity is never itself a tenant session.
- **MFA mandatory, sessions short, everything logged.** Operator auth requires MFA, uses the shortest practical session, and writes an audit row for every cross-tenant read — not just mutations. The audit `actor_type` enum (§7) already reserves `system`; add `operator` when this lands.
- **Surface it as a separate app, not a dashboard route.** The operator console is its own deployment (e.g. `admin.sparx.works`) with its own auth boundary, so a bug in the tenant dashboard can never escalate into cross-tenant access.

Until all of that exists, the honest answer to "where's the admin panel?" is: **there isn't one, by design** — operators use the §2.5 internal endpoints, and we accept the friction as the price of not shipping a cross-tenant superuser before we can secure it.

### Layer 5 — System / Internal Service Principals

Machine-to-machine calls between sparx's own components — k8s CronJobs poking a scheduler, Pub/Sub push subscriptions, Caddy's on-demand-TLS ask, the acquisition report — authenticate with a **shared secret in a request header**, not a JWT and not a human session.

```
Header:   X-sparx-Internal-<Purpose>-Token
Compare:  constant-time (node:crypto timingSafeEqual) against an env secret
Exposure: ClusterIP-only — never routed through Caddy/the public internet
Secret:   GCP Secret Manager → synced into the `sparx-app-secrets` k8s Secret
          by the bootstrap workflow's canonical KEYS list; api-rest loads it
          via `envFrom: secretRef`.
```

Live internal principals (`wizeworks/services/api-rest/src/routes/internal/`):

| Endpoint                          | Header                               | Secret env                         |
| --------------------------------- | ------------------------------------ | ---------------------------------- |
| `/internal/crm/*` (CronJobs)      | `X-sparx-Internal-Cron-Token`        | `SPARX_INTERNAL_CRON_TOKEN`        |
| `/internal/commerce/*` (CronJobs) | `X-sparx-Internal-Cron-Token`        | `SPARX_INTERNAL_CRON_TOKEN`        |
| `/internal/acquisition/summary`   | `X-sparx-Internal-Acquisition-Token` | `SPARX_INTERNAL_ACQUISITION_TOKEN` |

**Rules for adding an internal principal:**

1. **One secret per blast radius, not one secret for everything.** The acquisition report exposes cross-tenant business intelligence — a different blast radius than triggering a scheduler — so it gets its **own** token (`SPARX_INTERNAL_ACQUISITION_TOKEN`), rotatable and grantable independently of the cron token. Bundle two purposes under one secret only when leaking one would be no worse than leaking the other.
2. **Constant-time compare, fail-closed.** Compare with `timingSafeEqual`; if the secret env is unset, return 401 (disabled) rather than allowing — a forgotten secret in prod must surface loudly, never fail open.
3. **ClusterIP-only, hidden from OpenAPI.** Internal routes set `schema: { hide: true }` and are never added to the public ingress. They are an internal contract, not a customer API.
4. **Register the secret in the canonical list.** Add the lowercase key to the `KEYS` array in [bootstrap.yml](../.github/workflows/bootstrap.yml) (`Sync sparx-app-secrets`) so it syncs from Secret Manager; `envFrom: secretRef` then exposes it to api-rest automatically.

An internal principal is the **correct, minimal substitute for the deferred operator tier (§2.4)** for read-only cross-tenant reporting. It is _not_ a substitute for interactive operator workflows (impersonation, per-tenant support actions) — those wait for §2.4.

---

## 3. Session Management

### JWT Structure

```typescript
// Access token payload
{
  sub: userId,              // Better Auth user ID
  tid: tenantId,            // Tenant context
  role: 'admin',            // Staff role
  layer: 'staff' | 'customer',
  scopes: string[],         // For API keys
  iat: timestamp,
  exp: timestamp            // 15 min for staff, 7 days for customers
}
```

### Refresh Token Rotation

- Refresh token is opaque random bytes (not JWT)
- Stored hashed (SHA-256) in DB via Better Auth
- Single-use: new refresh token issued on every refresh
- Token family tracking: if old refresh token is reused → entire family revoked (theft detection)
- All active sessions visible in dashboard → user can revoke any session

### Tenant Context Establishment

After JWT validation, API middleware sets database tenant context:

```typescript
fastify.addHook('preHandler', async (request) => {
  const user = await betterAuth.validateToken(request.headers.authorization);
  request.tenantId = user.tid;
  await db.$executeRaw`SET LOCAL app.tenant_id = ${user.tid}`;
});
```

A minimal per-request hook that issues `SET LOCAL app.tenant_id` once the
tenant has been resolved:

```typescript
app.addHook('preHandler', async (req) => {
  if (req.tenant) {
    await req.db.execute(`SET LOCAL app.tenant_id = '${req.tenant.id}'`);
  }
});
```

---

## 4. Multi-Tenancy & Data Isolation

### Row Level Security (RLS)

Every tenant-scoped table enforces isolation at the database level:

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orders
  AS PERMISSIVE FOR ALL TO application_user
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

This is a backstop — if application-level tenant filtering has a bug, RLS prevents cross-tenant data leaks at the database level.

### FORCE RLS — Closing the BYPASSRLS Hole (Decision F3)

**Tenant-scoped tables** use `ALTER TABLE <table> FORCE ROW LEVEL SECURITY;` so even table owners (the app role) cannot bypass policies — closing the BYPASSRLS hole. **Shared/global tables** (e.g., `tenants`, `plans`, `modules`, `migrations`) do not use FORCE since they're intentionally readable across all tenant contexts.

### Enterprise Isolation

Enterprise clients (like Gillett Diesel) can have a dedicated Cloud SQL instance. Same application code, different connection target resolved from tenant configuration.

---

## 5. Authorization (RBAC)

### Staff Roles

| Role     | Capabilities                                                    |
| -------- | --------------------------------------------------------------- |
| `owner`  | Everything including billing, tenant deletion, staff management |
| `admin`  | Everything except billing and tenant deletion                   |
| `editor` | CRUD on products, orders, customers, content                    |
| `viewer` | Read-only all data                                              |
| `api`    | Scope-based access via API key only                             |

### Customer Roles (B2B Portal)

| Role            | Capabilities                                           |
| --------------- | ------------------------------------------------------ |
| `account_admin` | Manage contacts, approve purchases, full portal access |
| `buyer`         | Place orders, submit RFQs, view history                |
| `viewer`        | View orders and invoices only                          |

### Enforcement (Defense in Depth)

Authorization checked at both route level (fast reject) and service level (defense in depth):

```typescript
// Route level
fastify.addHook('preHandler', requireRole('editor'));

// Service level — never trust route-level alone
async function updateProduct(userId: string, productId: string, data: UpdateInput) {
  const user = await getUser(userId);
  if (!hasPermission(user.role, 'products.write')) {
    throw new ForbiddenError();
  }
}
```

Tenant scoping follows the same defense-in-depth pattern — the route guard
attaches `req.tenant`, and the service layer re-validates before any DB
access:

```typescript
// Route guard
app.get('/orders/:id', { preHandler: requireTenant }, async (req) => {
  // Service still re-validates
  return orderService.getById(req.params.id, { tenantId: req.tenant.id });
});
```

---

## 6. Data Encryption

### At Rest

- Cloud SQL: Google-managed AES-256
- GCS: Google-managed AES-256
- Sensitive fields (API credentials, DKIM private keys, Postal credentials, payment tokens): application-level AES-256-GCM before storage, key in Google Secret Manager

### In Transit

- TLS 1.3 for all external connections
- TLS 1.2 minimum for internal service-to-service
- HSTS: max-age=31536000; includeSubDomains; preload

### PII Handling

Customer PII (name, email, phone, address) is:

- Never written to application logs
- Masked in error reporting (Sentry)
- Exportable by tenant (GDPR data export)
- Deletable on customer request (GDPR right to erasure, anonymizes while retaining order records for accounting)

---

## 7. Audit Logging

Every state-changing operation logged:

```typescript
{
  id: uuid,
  tenant_id: uuid,
  actor_id: uuid | null,
  actor_type: 'staff' | 'customer' | 'system' | 'api' | 'mcp',
  actor_ip: string,
  action: string,           // 'order.status.updated', 'customer.created'
  entity_type: string,
  entity_id: uuid,
  before: JSON | null,
  after: JSON | null,
  diff: JSON | null,
  created_at: timestamp
}
```

Logged: all data mutations, auth events (login/logout/failed/reset), permission changes, billing events, admin overrides, MCP tool calls (sanitized), webhook deliveries.

Retention: 90 days queryable in dashboard, 2 years in GCS cold storage, 7 years for Enterprise.

---

## 8. Security Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: [per-page policy]
```

---

## 9. Input Validation & Injection Prevention

- All API inputs validated with Zod schemas before processing
- Prisma ORM parameterizes all queries — no raw string interpolation
- User-generated HTML sanitized with DOMPurify before storage
- React JSX escaping handles XSS in rendered output
- SameSite=Strict cookies for CSRF protection

---

## 10. GDPR & Privacy Compliance

Tenant tools: data export, right to erasure, consent tracking (timestamp + IP), cookie consent banner, data retention configuration.

sparx is data processor; tenants are data controllers. DPA available for all tenants, required for EU tenants.

---

## 11. Vulnerability Management

- npm audit + Trivy in CI on every PR
- Dependabot auto-PRs for security updates
- Annual penetration test
- OWASP Top 10 review before each major release
- Bug bounty program (responsible disclosure policy)

Breach notification: affected tenants notified within 72 hours per GDPR.
