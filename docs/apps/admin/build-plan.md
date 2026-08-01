# sparx Platform — Admin App Build Plan

**Version:** 1.2
**Author:** Brandon Korous
**Last Updated:** 2026-07-05

> The build plan for `apps/admin` — the **WizeWorks operator console** at `admin.wize.works`. It is the
> concrete _how_ for the two specs that already exist:
>
> - **Scope umbrella:** [docs/76-admin-portal-spec.md](../../76-admin-portal-spec.md) — what the portal
>   does (tenant ops, metrics, domains, billing ops, support; cross-product).
> - **Auth/isolation architecture (authoritative):** [docs/16-auth-security.md](../../16-auth-security.md)
>   §2.4 — the **Layer-4 Platform Operator** tier. This app _is_ the thing §2.4 calls "Deliberately
>   Deferred." Where 76 and 16 §2.4 disagree on _how_, **16 §2.4 wins** (see [D1](#2-decisions-locked)).
> - **First feature:** [feedback.md](feedback.md) — feedback triage, built after the shell (Slice 7).
>
> `apps/admin` is currently an **empty placeholder** — greenfield inside a built platform.

> **Decisions locked (v1.1, 2026-07-04).** After review: same cluster + `wize-admin` namespace (no new
> cluster); a second Better Auth instance in a dedicated **`wize_admin` Postgres schema** (same DB, split
> later); `admin.wize.works` on the existing Cloudflare account; **impersonation removed** (too much
> cross-domain risk for too little benefit — read-parity in admin covers the real need); **MFA deferred**
> (drops in as the `twoFactor` plugin later; Cloudflare Access is the interim compensating control);
> `brandon@wize.works` seeded as operator #1. The admin app reads/writes cross-tenant data **only** through
> api-rest `/internal/operator/*` (Layer-5), never a direct cross-tenant DB role.

---

## 0. What this is

`admin.wize.works` is the cross-tenant operator console for WizeWorks staff — support, finance, growth — a
**fundamentally different principal** from a tenant staff member (who is pinned to one tenant by `tid` and
re-validated against RLS on every query). It is the single highest-blast-radius surface the platform can
ship, so this plan is as much a **security build** as a feature build and follows 16 §2.4 to the letter.

**Slices are build _order_, not scope tiers** — the whole (non-impersonation) surface in 76 is committed.
Each slice is a deployable commit, left in the working tree for the user to commit (active-build workflow).

---

## 1. Current state we build on (not greenfield inside the repo)

Everything the admin app needs to _reuse_ exists; everything that would _weaken isolation_ does not.

### What exists (reuse verbatim)

| Capability                    | Where                                                                                                                                                                                | How the admin uses it                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Next.js app scaffold          | [apps/dashboard](../../../apps/dashboard) (`next.config.mjs`, `Dockerfile`, `postcss.config.mjs`, `tsconfig.json`)                                                                   | Copy the standalone-output + Tailwind-v4 + filtered-install pattern exactly.                           |
| Better Auth (self-hosted)     | [packages/auth/src/server.ts](../../../packages/auth/src/server.ts) + [prisma.ts](../../../packages/auth/src/prisma.ts)                                                              | Same library + Prisma-adapter machinery — but a **separate instance** on its own schema (D3).          |
| Component library             | `@sparx/ui`                                                                                                                                                                          | The whole CVA/Radix system; operator console wears its own module hue.                                 |
| Tenant "dispatch" row         | [packages/db/prisma/schema/02-tenant.prisma](../../../packages/db/prisma/schema/02-tenant.prisma)                                                                                    | `tenants` is **non-RLS/global** — but the admin reads it via api-rest, not directly (D6).              |
| Per-tenant scoping primitive  | [packages/db/src/tenant-context.ts](../../../packages/db/src/tenant-context.ts) (`withTenant`, `withSystem`)                                                                         | Used **inside api-rest** for the operator read endpoints — not in the admin app.                       |
| Tenant-scoped audit log       | [packages/db/prisma/schema/04-audit.prisma](../../../packages/db/prisma/schema/04-audit.prisma) (`audit_logs`, `actor_type`)                                                         | Operator-initiated writes stamp this as `actor_type = 'operator'` (owner-visible).                     |
| Internal (Layer-5) principals | [docs/16 §2.5](../../16-auth-security.md), `services/api-rest/src/routes/internal/` (`acquisition-report.ts` is the cross-tenant-reporting precedent)                                | The exact pattern the new `/internal/operator/*` endpoints follow.                                     |
| Analytics rollups             | `Rollup*` models on the tenant (revenue/collected/site/etc., docs/97)                                                                                                                | Platform-metrics endpoints aggregate these server-side in api-rest.                                    |
| Billing substrate             | tenant `stripe*` fields + `BillingSubscriptionItem` (docs/67), api-rest billing routes                                                                                               | Billing-ops endpoints read/act through these; no new billing engine.                                   |
| Domains substrate             | `Domain[]` / `DomainPurchase[]` on tenant, `@sparx/godaddy`, `@sparx/registrar`, `services/domain-worker`                                                                            | Domain endpoints read these; force-reverify re-triggers the worker path.                               |
| Deploy machinery              | [build-images.yml](../../../.github/workflows/build-images.yml) matrix + [deploy-prod.yml](../../../.github/workflows/deploy-prod.yml) rollout loop + [k8s/apps/](../../../k8s/apps) | Add `admin` to one matrix + one loop + one manifest (§6).                                              |
| Cloudflare (same account)     | [terraform/envs/prod/cloudflare.tf](../../../terraform/envs/prod)                                                                                                                    | `wize.works` is in the same Cloudflare account — add a record + Access app (no new zone provisioning). |

### What does NOT exist (net-new, and deliberately so)

- **No operator identity.** No `platform_operators` store, no operator login/session. The tenant roles
  (`owner/admin/editor/…` in [org-roles.ts](../../../packages/auth/src/org-roles.ts)) are **tenant** roles —
  never reuse them for staff, never add an `is_staff` flag to `users` (16 §2.4: it collapses RLS isolation).
- **No cross-tenant read path in an app.** `sparx_app` is `NOBYPASSRLS`; tenant tables are FORCE RLS; there
  is no admin bypass connection — **and 16 §2.4 says there must not be one** (D1/D6).
- **No operator audit substrate.** `audit_logs` requires a `tenant_id`; cross-tenant / tenant-less operator
  actions have nowhere to log yet.
- **No MFA** (deferred, D8). No separate WizeWorks infra — everything is one project (`sparxworks`) / one
  cluster (`sparx-prod-autopilot`); the "separate WizeWorks cluster" in 76 §5 is not built and we are not
  building it (D2).

---

## 2. Decisions locked

- **D1 — 16 §2.4 is authoritative; it refines 76 §5 + feedback.md §3.** Those describe a "separate DB
  connection that bypasses tenant RLS." **We do not build that.** 16 §2.4 is explicit: operators get **no
  ambient `BYPASSRLS`**; cross-tenant access is a _named, audited operation_, not a property of the
  connection. (Action when this lands: add a one-line pointer here from 76 §5 + feedback.md §3.)

- **D2 — Same cluster, `wize-admin` namespace.** No new GCP project/cluster (contradicts "infra is phased —
  start cheap," and a second project is a permanent cost). `admin` deploys into the existing
  `sparx-prod-autopilot` cluster in a dedicated `wize-admin` namespace with its own service account +
  network boundary. **Split trigger:** revisit only if a compliance boundary or cross-product operator load
  demands dedicated infra.

- **D3 — Operator identity = a second Better Auth instance on a dedicated `wize_admin` Postgres schema.**
  Same `sparx` database, new **schema** (Postgres's namespace). A dedicated role `wize_operator` owns/uses
  `wize_admin`; `sparx_app` has zero access to it and `wize_operator` has zero access to `public` business
  tables. The operator instance uses its **own small Prisma client** (in `@sparx/operator-auth`) connecting
  with `?schema=wize_admin`, so its migration history (`wize_admin._prisma_migrations`) is separate and
  there is **no churn** on the 277-model main schema. Operators have **no `tid`**.
  - **Split-later guarantee:** **no foreign keys from `wize_admin` into `public`.** The operator audit log
    stores `tenant_id` as a bare UUID value, never an FK. To split, repoint the operator connection at a new
    DB and `pg_dump --schema=wize_admin | restore`. Nothing else moves.

- **D4 — Hostname `admin.wize.works`** (per 76; 16 §2.4's `admin.sparx.works` example predates the
  cross-product framing).

- **D5 — Capability-scoped authz, default-deny.** No "operator admin implies everything." Vocabulary:
  `support:read`, `support:act`, `billing:read`, `billing:act`, `acquisition:read`, `tenant:suspend`,
  `module:toggle`, `domain:manage`, `feedback:respond`, `feedback:admin`, `operator:admin` (manage other
  operators). 76's named roles (`super_admin`/`sparx_admin`/`billing_admin`/`support`/`developer`) become
  **capability bundles**, never hardcoded role checks. (No `tenant:impersonate` — see D7.)

- **D6 — Cross-tenant reads AND writes go through api-rest `/internal/operator/*` (Layer-5), never a direct
  DB role in the admin app.** The admin app's DB access is scoped to `wize_admin` only (its own identity,
  capabilities, audit). All tenant business data — list, detail, metrics, order/customer search, suspend,
  module toggle, refund, reindex — is served by new api-rest internal endpoints (shared-secret + an
  `X-Operator-Id` header for audit), which already own the tenant-context machinery and service functions.
  This is the smallest blast radius: a compromised admin app holds **no** credentials that can read a
  tenant's data directly. Fully §2.4-compliant (no BYPASSRLS; named, audited operations) and §2.5-endorsed
  ("internal principal = the correct minimal substitute for read-only cross-tenant reporting").

- **D7 — No impersonation.** Cross-domain, cross-auth-instance impersonation is the highest-risk path in the
  design (a bug in the operator console could escalate into acting as a tenant). It is **removed**: no
  `impersonation_grants` table, no `tenant:impersonate` capability, **no changes to the dashboard app**.
  The real need — "understand this account as the tenant sees it" — is met by **representation parity** (§3):
  the admin renders the same computed values/labels/statuses the dashboard shows, read-only. Operators still
  take bounded admin actions (suspend, module toggle, refund, feedback reply) via D6 endpoints — parity of
  _representation_, never parity of _capability_.
  - **Escape hatch (later, if ever needed):** for the rare case an operator must see the tenant's _exact_
    UI, provision a **real, temporary tenant user** through the normal Better Auth org-invitation flow and
    sign in as that — a first-class, tenant-scoped, audited, revocable account through ordinary auth. No
    impersonation machinery, no cross-domain token, no special session type. This is deferred and out of
    scope for the initial build; it is recorded here so the "no impersonation" decision carries its own
    answer for the edge case.

- **D8 — MFA deferred.** No `twoFactor` plugin exists platform-wide yet. The operator instance is built
  **twoFactor-ready** and MFA drops in later as the plugin. **Interim compensating control:** Cloudflare
  Access + IP allowlist on `admin.wize.works` is load-bearing until MFA lands (a password alone is thin for
  a cross-tenant console).

- **D9 — `admin.wize.works` DNS/Access in the repo Terraform.** `wize.works` is in the same Cloudflare
  account, so add the record + a **Cloudflare Access** application/policy to `terraform/envs/prod/cloudflare.tf`
  (no new zone provisioning; no-drift rule keeps it with the rest of the edge config).

- **D10 — Seed operator #1 = `brandon@wize.works` with `operator:admin`.** No operator self-signup. Slice 1
  seeds this row; first sign-in uses Better Auth's set-password flow over the existing `email.send` pipeline
  (no plaintext seeded password). `operator:admin` then grants everyone else.

---

## 3. Architecture

```
                 admin.wize.works  (Cloudflare Access + IP allowlist — load-bearing until MFA, D8)
                          │
                          ▼
        ┌─────────────────────────────────────────────┐
        │  apps/admin  (Next.js standalone, wize-admin  │
        │              namespace, SA: wize-admin)       │
        │                                               │
        │  Auth boundary:  @sparx/operator-auth         │  ← 2nd Better Auth instance (D3)
        │    email+password, twoFactor-READY (D8),      │     own Prisma client → schema=wize_admin
        │    session → capabilities (D5), NO tid        │
        │                                               │
        │  Own DB (wize_admin schema only):             │──▶ Postgres as `wize_operator`
        │    operators · capabilities · audit           │     (NOBYPASSRLS, no access to public)
        │                                               │
        │  All tenant data via server-side calls to ──▶ │  api-rest /internal/operator/*  (Layer-5)
        │    api-rest (shared secret + X-Operator-Id)   │    · reads (list/detail/metrics/search)
        │                                               │    · writes (suspend/module/refund/reindex)
        └───────────────────────────────────────────────┘    · uses withTenant() per tenant, audits,
                                                               · publishes events, stamps tenant
                                                                 audit_logs actor_type='operator'
```

Three seams the app is built around:

1. **The auth boundary** — its own deployment + its own identity store on its own schema, so a bug in the
   tenant dashboard can never escalate into cross-tenant access, and vice-versa.
2. **The data seam** — the admin app never touches tenant business data directly; every read and write is an
   audited, capability-gated api-rest `/internal/operator/*` call. The admin app's own DB role can only see
   `wize_admin`.
3. **Representation parity (D7)** — admin surfaces reuse the dashboard's formatters/labels/status derivations
   (or api-rest returns dashboard-shaped payloads) so operators read the data exactly as the tenant sees it.
   Read-only understanding replaces impersonation.

---

## 4. Data-model deltas

Two parts, both through the pipeline (use the **db-migration** skill; mind the FORCE-RLS backfill footgun).

**A) New `wize_admin` schema (own Prisma project in `@sparx/operator-auth`, own migration history):**

| Table                                                         | Purpose                                                                                                                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `platform_operators`                                          | Operator identity (Better Auth `user` for the operator instance) — email, name, twoFactor state.                                                                                                             |
| `platform_operator_sessions` / `_accounts` / `_verifications` | Better Auth's session/account/verification tables for the operator instance.                                                                                                                                 |
| `platform_operator_capabilities`                              | `(operator_id, capability)` grants (D5), default none.                                                                                                                                                       |
| `platform_operator_audit_logs`                                | **Append-only, global, FK-free.** Every operator action + every cross-tenant read at the action level (D-audit): operator id, capability used, action, target `tenant_id`(s) as bare UUIDs, diff, ip/ua, ts. |

**B) One additive change to the main schema (`public`):** add `'operator'` to the `audit_logs.actor_type`
enum (16 §2.4 reserves it) so operator-initiated writes surfaced through api-rest are attributable and
visible to the tenant owner. (No `impersonation_grants` — D7.)

---

## 5. Slices (build order)

### Slice 0 — Docs + decisions ✅ (this doc)

This plan + the D1–D10 sign-off. **Done when** the doc lands under `docs/apps/admin/`.

### Slice 1 — App shell + operator auth + capability gate + audit + api-rest internal seam

The deployable spine. After this, `brandon@wize.works` can sign in (behind Cloudflare Access) to an
`admin.wize.works` shell that shows "signed in as X, capabilities: …" and nothing else — but the security
boundary, the audit trail, and the api-rest seam are all real.

- Scaffold `apps/admin` from the dashboard pattern (§6.1): standalone Next, Tailwind v4, `@sparx/ui`, own
  port, trimmed Dockerfile.
- `@sparx/operator-auth`: the second Better Auth instance (D3) — `emailAndPassword`, **twoFactor-ready**
  (D8), own Prisma client → `wize_admin`, own `BETTER_AUTH_SECRET`. Set-password bootstrap for D10.
- `@sparx/operator` (app-side): `requireOperator()` (session → operator + capabilities), `requireCapability(cap)`
  default-deny, and the audit writer. Plus the typed api-rest internal client (shared secret + `X-Operator-Id`).
- api-rest: a new `/internal/operator/*` plugin (mirrors `internal/acquisition-report.ts`) with its own
  secret `SPARX_INTERNAL_OPERATOR_TOKEN`, `schema: { hide: true }`, constant-time compare, fail-closed.
- Migration (Part A `wize_admin` schema + Part B `actor_type` enum) authored + shipped. Seed operator #1.
- Deploy wiring (§6): build-images matrix, deploy-prod loop, `k8s/apps/admin.yaml` (wize-admin namespace,
  own SA + secrets), Caddy route, Cloudflare record + Access app. **Ships as a locked-down shell — deploy early.**

### Slice 2 — Tenant list + tenant detail (read-only, representation parity)

The core support surface and the first real `/internal/operator/*` reads.

- **Tenant list** (`/sparx/tenants`): search by name/domain/email/plan; columns for status, plan, active
  modules, MRR, trial/subscription state, last activity.
- **Tenant detail** (`/sparx/tenants/:id`): modules active, MRR, storage, subscription/trial state, domains,
  recent audit trail — **rendered with the dashboard's own formatters/labels/statuses** (D7 parity).
- All data from api-rest internal endpoints; every view logs an action-level audit row.

### Slice 3 — Platform metrics

Totals (active/trial/churned), MRR by module, module adoption %, signups by day/week/month, churn + reasons,
avg setup time (signup → first publish), storage utilization, email volume. Built on `Rollup*` + `tenants`
aggregates computed server-side in api-rest — **no live-table scans**. Cross-tenant rollups anonymized in
aggregate views (feedback.md §8 pattern).

### Slice 4 — Billing operations

Failed-payment queue, manual refund, coupon create/manage, enterprise invoice generation, Stripe webhook log
viewer — through the existing billing substrate + api-rest billing routes (no parallel billing engine).
Gated `billing:read` / `billing:act`.

### Slice 5 — Domain management

All custom domains cross-tenant, SSL cert status, CNAME verification, **force re-verify** (re-trigger the
`domain-worker` path), GoDaddy purchase/renewal history. Reads `Domain[]` / `DomainPurchase[]`; acts via the
domain worker + `@sparx/registrar`. Gated `domain:manage`.

### Slice 6 — Support tools

Cross-tenant order search (by order number), customer search (by email), per-tenant Typesense index stats +
**trigger reindex** (publish the existing reindex event), order-confirmation email re-send, email
delivery-log lookup. Note: there is **no Pub/Sub event-history store** today (fire-and-forget) — "view a
tenant's event history" (76 §3) reads `audit_logs` as the proxy in Phase 1. Gated `support:read` / `support:act`.

### Slice 7 — Feedback triage

Implements [feedback.md](feedback.md) in full (inbox, detail + context panel, reply → `feedback.responded`,
triage/lifecycle, metrics) against the `feedback_*` tables via `/internal/operator/*`. feedback.md §10's
checklist is unblocked once Slice 1's audit + read seam exist. Gated `feedback:respond` / `feedback:admin`.

### Slice 8 — Tenant write actions

Suspend/unsuspend, manual module activate/deactivate (publish `module.activated` — never inline a flag flip),
storage-limit override. Each behind a capability + confirmation; api-rest writes the tenant's `audit_logs` as
`actor_type='operator'` (owner-visible) **and** the `platform_operator_audit_logs` row.

### Slice 9 — Partner Program administration

The WizeWorks-side of the Partner Program (docs/114 §B), folded behind the operator seam. All custom
partner administration cross-tenant: the **application review queue** (approve → provision / reject),
the **partner roster** (tier, suspend/reinstate), per-partner **referrals / commissions / payout runs**,
the two platform-wide money actions (**approve pending commissions**, **run the monthly Stripe Connect
payout batch**), and a read-only cross-partner **bootcamps** overview. Gated `partner:read` / `partner:act`
(new capabilities). Reaches the existing `partnerService` / payout runners / directory reads through new
`/internal/operator/partners/*` endpoints (operator token — the admin app never holds the separate
partners token, per D6). Partner RLS shapes it: applications live on the platform tenant; the roster is
active-only (`partners_visibility` under `withSystem`); referrals/commissions/payouts are per-partner
reads (no cross-partner ledger). Bootcamps are host-partner-owned → read-only here.

> **Navigation.** With this many sections the console moved from top-tabs to the shared
> `SidebarAppShell` (the tenant dashboard's chassis): a collapsible, grouped, capability-gated rail
> (Overview · Accounts · Growth · Money · Support · Infrastructure) + a mobile drawer.

### Later — cross-product + alerts

`/kanninja` + `/helpninja` sections (76 §3), the `/billing` cross-product financial rollup, and 76 §6 alerts
(storage > 90%, failed payment > 7 days). Deferred until the sparx surface is complete.

---

## 6. Infra & deploy

### 6.1 Scaffold checklist (copy from `apps/dashboard`)

- `package.json`: `@sparx/admin`, `type: module`, scripts `dev`/`build`/`lint`/`typecheck`/`test`, own dev
  port (e.g. `3002`), deps trimmed to what admin imports (`@sparx/ui`, `@sparx/operator-auth`, `@sparx/operator`,
  next 16, react 19, tailwind 4, better-auth). **No `@sparx/db` business-model imports** — it talks to api-rest.
- `next.config.mjs`: `output: 'standalone'`, `outputFileTracingRoot: ../../`, `transpilePackages` for the
  `@sparx/*` it imports, `serverExternalPackages` for `@prisma/client` + `better-auth`.
- `postcss.config.mjs` (`@tailwindcss/postcss`), `tsconfig.json` (extends `../../tsconfig.base.json`, `@/*`).
- `Dockerfile`: copy dashboard's multi-stage pattern; **trim** the workspace-dep COPY list to admin's small
  subgraph.

### 6.2 Pipeline wiring

- **build-images.yml**: add `admin` to the `service:` matrix (soft-skips until the Dockerfile lands).
- **deploy-prod.yml**: add `admin` to the `for svc in …` rollout loop (skips until the Deployment exists).
- **`k8s/apps/admin.yaml`**: copy `dashboard.yaml`; **change** namespace → `wize-admin`, `serviceAccountName`
  → `wize-admin` (own GSA bound to `wize_operator` DB access + minimal Secret Manager/Pub/Sub scopes — **not**
  shared `sparx-app`), own env/secret refs (own `BETTER_AUTH_SECRET`, `OPERATOR_DATABASE_URL`,
  `SPARX_API_REST_URL`, `SPARX_INTERNAL_OPERATOR_TOKEN`). Add to `k8s/apps/kustomization.yaml` + the
  `wize-admin` namespace manifest.
- **Caddy** (`k8s/ingress/`): route `admin.wize.works` → the `admin` Service (ClusterIP).
- **Cloudflare** (`terraform/envs/prod/cloudflare.tf`, D9): `admin.wize.works` DNS record + a **Cloudflare
  Access** application/policy (same account, existing `wize.works` zone).
- **Terraform**: the `wize_operator` Postgres role (`NOBYPASSRLS`, rights on `wize_admin` only) + the
  `wize-admin` GSA + WI binding + new secrets (incl. `SPARX_INTERNAL_OPERATOR_TOKEN` in the canonical
  bootstrap KEYS list, 16 §2.5 rule 4). Mirror any imperative change into TF the same session (no-drift).

---

## 7. Security posture (non-negotiables)

1. **Separate identity, no `tid`, own schema.** Operators are never a row in a tenant's `users`; no
   `is_staff` flag on `users`.
2. **No ambient `BYPASSRLS`.** The admin app has no cross-tenant DB role at all; business data flows only
   through audited api-rest `/internal/operator/*` calls (D6).
3. **Capability-scoped, default-deny** (D5).
4. **No impersonation** (D7) — the highest-risk path is removed entirely; the dashboard is untouched.
5. **Every cross-tenant READ is audited at the action level** — not just mutations
   (`platform_operator_audit_logs`); operator-initiated tenant writes also stamp the tenant's `audit_logs`.
6. **Separate app deployment + network boundary** — Cloudflare Access + IP allowlist, **load-bearing until
   MFA lands** (D8); the host is never openly public.
7. **MFA is a fast-follow** — the operator instance is built twoFactor-ready; enabling the plugin is the
   graduation from the interim network-only posture.

If a slice can't meet these, it doesn't ship.

---

## 8. Footguns

- **F1 — Don't build the "bypass RLS connection."** The most tempting shortcut (76/feedback phrasing) is the
  one thing 16 §2.4 forbids. The admin app has no business-data DB role at all (D6).
- **F2 — Don't reuse tenant roles or the tenant Better Auth instance for operators.** Different principal
  set, different schema, own Prisma client (D3).
- **F3 — No FKs from `wize_admin` into `public`.** That FK-free boundary is the whole split-later story
  (D3); `tenant_id` in the operator audit log is a bare UUID value.
- **F4 — Operator-initiated tenant writes must be attributable.** api-rest stamps the target tenant's
  `audit_logs` as `actor_type='operator'` + the operator id (via `X-Operator-Id`) so the owner sees
  WizeWorks-initiated changes. Module toggles are **events** (`module.activated`), never inline flag writes.
- **F5 — Cloudflare Access is load-bearing until MFA (D8).** Do not ship `admin.wize.works` on a password
  alone with no network gate.
- **F6 — Migration ships through the pipeline.** `wize_admin` schema + hand-edited RLS/grants; watch the
  FORCE-RLS backfill footgun (`wize_operator` is non-superuser in prod). db-migration skill.
- **F7 — User owns dev + commits.** Verify via typecheck/lint/DB+API, not by restarting their dev server;
  stage only `apps/admin` / new-package / docs files by path; leave the tree for the user to commit.

---

## 9. Definition of done

- `admin.wize.works` is a separate, Cloudflare-Access-gated Next.js app operators sign into (twoFactor-ready,
  MFA a fast-follow), with capability-scoped, default-deny authz and **no `tid`**.
- The admin app holds **no** cross-tenant business-data DB role; all tenant data flows through audited,
  capability-gated api-rest `/internal/operator/*` calls; its own `wize_admin` schema holds only operator
  identity/capabilities/audit and is FK-free to `public`.
- Tenant list + detail (representation parity), platform metrics, billing ops, domain management, support
  tools, feedback triage, and tenant write actions are all live and capability-gated. **No impersonation.**
- Every cross-tenant read and every operator action writes an audit row; operator-initiated tenant writes are
  attributable to the operator and visible to the tenant owner.
- 76 §5 + feedback.md §3 updated to point here for the corrected (no-bypass, no-impersonation) model; 16
  §2.4's "deferred" note updated to "shipped — see docs/apps/admin/build-plan.md."
