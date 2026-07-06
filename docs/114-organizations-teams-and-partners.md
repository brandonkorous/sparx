# Organizations, Teams & the Partner Program

**Version:** 0.2
**Author:** Brandon Korous
**Last Updated:** 2026-07-06

> Status: **planning / not yet built.** This doc is the reconciled blueprint for two
> coupled bodies of work decided in the 2026-07-02 build session:
>
> 1. **Organizations & Teams** — wire Better Auth's `organization` plugin onto the
>    existing `tenants` row so a tenant can have **many users** (staff/team) and a
>    user can belong to **many tenants** (consultants / partners managing client
>    accounts). This is the "heavy discovery": the auth spine assumed since day one
>    (`02-tenant.prisma` header, root `CLAUDE.md`) but never actually built.
> 2. **The Partner Program** — the public `sparx.works/partners` + `sparx.works/bootcamp`
>    surfaces, the in-dashboard Partner Portal, referral attribution + commissions
>    with **Stripe Connect payouts**, and partner-hosted **Bootcamps**.
>
> They ship **together** this session. Part A is the foundation; Part B keys onto it.

**Supersedes / reconciles:** [78-consultant-partner-program.md](78-consultant-partner-program.md)
(its Better-Auth-organizations assumption was never built; this doc builds it), plus the
two external specs `sparx-partners-page-spec.md` and `sparx-bootcamp-page-spec.md`.
**Builds on:** [16-auth-security.md](16-auth-security.md) (auth tiers, RLS),
[24-dashboard-shell.md](24-dashboard-shell.md), [32-workspace-switching-breadcrumb.md](32-workspace-switching-breadcrumb.md)
(the switcher lives in the breadcrumb), [76-admin-portal-spec.md](76-admin-portal-spec.md)
(staff tier, deferred), [80-marketing-attribution-analytics.md](80-marketing-attribution-analytics.md)

- [83-tenant-attribution-l-ten.md](83-tenant-attribution-l-ten.md) (attribution the `?ref=`
  capture extends), [94-ADR-payment-gateway.md](94-ADR-payment-gateway.md) + `@sparx/payments`
  (Stripe Connect Express, the payout rail precedent).

---

## 0. Decisions locked this session

| #   | Decision                                                                                                                                                                                                                                                        | Rationale                                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **A partner is an organization (tenant), not a Better-Auth user.** `partners` is a HAS-ONE-per-tenant capability row (the `MarketMerchantProfile` shape), keyed `organization_id` (== `tenant_id`, 1:1).                                                        | The only cross-org identity primitive is the org; a partner needs its own billing account, referral code, directory listing, and bootcamp host record — all org-scoped. |
| D2  | **Org = tenant, one row.** Better Auth's `organization` model maps onto the existing `tenants` table; we add `members` + `invitations` (auth-layer tables, `ENABLE`-only RLS like `users`).                                                                     | `02-tenant.prisma` + root `CLAUDE.md` already commit to "orgs map 1:1 to tenants." Two tables for the same concept would be a lie.                                      |
| D3  | **RLS is essentially untouched.** `current_tenant_id()` still reads `app.tenant_id`; the only change is **how the active org/tenant is _chosen and authorized_ at session/JWT mint** (from the user's `members` row for the active org, not `users.tenant_id`). | De-risks the migration massively — no policy rewrites, no per-route changes to the RLS mechanism.                                                                       |
| D4  | **Expand-contract migration.** Keep `users.tenant_id` + `users.role` as the "default membership" during expand; backfill one `owner` member per existing user; contract later.                                                                                  | Every authed request and the RLS backstop ride on tenant context; nothing may break mid-flight.                                                                         |
| D5  | **Referral + commission is real, end-to-end, with Stripe Connect payouts.** Capture `?ref` → credit at signup → accrue commission when first payment clears → monthly payout run via Connect Express.                                                           | User choice this session ("+ Stripe Connect payouts now").                                                                                                              |
| D6  | **Bootcamp registration is on-platform → the host partner's CRM**, with an external-URL escape hatch per bootcamp.                                                                                                                                              | User choice ("internal RSVP → partner's CRM"): dogfoods the platform, captures graduate attribution.                                                                    |
| D7  | **Fold in:** auto OG + schema.org `Event` SEO, self-serve "Become a partner", a real partner **resources hub**.                                                                                                                                                 | User-selected "make it amazing" extras.                                                                                                                                 |
| D8  | **Partner is NOT a module.** No `ModuleSlug` entry, no `settings.modules` flag. Gated by the existence of an `active` `partners` row — the `MarketMerchantProfile` precedent ("the platform has modules, not tiers").                                           | Keeps it out of billing's module→subscription mapping; a partner is a capability, not a purchased module.                                                               |

---

# PART A — Organizations, Members & Teams

## A.1 Current state → target state

**Today:** `users.tenant_id` (one user → one tenant) + a single `users.role`
(`owner|admin|editor|viewer|api`). The session JWT is `{ sub, tid, role, ev }`;
api-rest sets `SET LOCAL app.tenant_id = tid` per request; `current_tenant_id()` is
the RLS anchor. There is **no** membership table and **no** `organization()` plugin
(only the MCP-OAuth plugin is wired in `packages/auth/src/server.ts`).

**Target:** Better Auth `organization` plugin, with the org model mapped onto `tenants`:

- **A tenant has many members.** `members(user_id, organization_id, role, member_type)`.
- **A user has many memberships** → the "client accounts" list for consultants/partners.
- **The session carries an `active_organization_id`.** The JWT `tid` == active org ==
  the tenant whose RLS context the request runs in. Switching orgs re-mints the session
  (new `tid` + new `role` from that org's member row).
- **Role is per-membership**, not global — the six roles from
  [78 §3](78-consultant-partner-program.md) become the `members.role` vocabulary.

## A.2 Data model (Part A)

New **auth-layer** tables (Better-Auth-adapter-owned; `ENABLE` RLS only, **not** FORCE —
they must be queryable to resolve "which orgs is this user in?" _before_ any tenant
context exists, exactly like `users`/`sessions`/`accounts`):

```
members
  id                uuid pk
  organization_id   uuid   -> tenants.id      (the org)
  user_id           uuid   -> users.id
  role              varchar(20)   owner|admin|editor|builder|marketing|support|viewer
  member_type       varchar(20)   owner|staff|consultant   (78 §5 — filter consultant vs staff)
  status            varchar(20)   active|invited|suspended
  created_at        timestamptz
  @@unique(organization_id, user_id)

invitations
  id                uuid pk
  organization_id   uuid   -> tenants.id
  email             varchar(255)
  role              varchar(20)
  member_type       varchar(20)   staff|consultant
  status            varchar(20)   pending|accepted|revoked|expired
  invited_by        uuid   -> users.id
  token             varchar(64) unique
  expires_at        timestamptz
  created_at        timestamptz
  @@index(email)
```

Session addition (Better Auth `session` table): `active_organization_id uuid`.

`tenants` (the org) is unchanged structurally; Better Auth's `organization` model is
configured to read `id`/`name`/`slug` from it. `users.tenant_id` + `users.role` are
**retained through expand** as the default-org pointer; a follow-up contraction migration
drops them once every read path resolves via `members`.

**Roles** (from [78 §3](78-consultant-partner-program.md), now the `members.role` set):

| Role        | Scope                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------ |
| `owner`     | Everything incl. billing + org deletion. **Never assignable** — only the creator holds it. |
| `admin`     | Everything except billing/owner settings.                                                  |
| `editor`    | Products, content, orders, customers. No team mgmt.                                        |
| `builder`   | Site builder only.                                                                         |
| `marketing` | Email, CMS, analytics. No orders/PII.                                                      |
| `support`   | Orders + customers (read-mostly; refunds if enabled).                                      |
| `viewer`    | Read-only across active sections.                                                          |

## A.3 Session, JWT & RLS-context resolution (the careful part)

The RLS mechanism is unchanged; the **selection + authorization of the active org** is new.

1. **Login** → Better Auth resolves the user's `members`. If exactly one → it's active.
   If many → `active_organization_id` = last-active (or the default `users.tenant_id`
   during expand); the dashboard shows the **client-accounts** picker.
2. **Session → JWT mint** (`apps/dashboard/lib/api-rest-client.ts` signs the internal
   JWT): `tid` = `active_organization_id`; `role` = the `members.role` for
   `(user, active_org)`. **Authorization invariant:** mint only if an `active`
   membership exists for that (user, org); otherwise 403. This is the new backstop that
   replaces "user is pinned to one tenant."
3. **api-rest** is unchanged — it still `SET LOCAL app.tenant_id = tid`. `current_tenant_id()`
   still gates every FORCE-RLS table. A user can only ever set a `tid` they're a member of.
4. **Switching orgs** = Better Auth `setActiveOrganization` → new session → new JWT `tid`/`role`.

**Expand-contract order:**

1. Add `members`/`invitations` + `session.active_organization_id` (additive; `ENABLE`-only RLS).
2. Backfill: one `members` row per existing user (`role` = `users.role`, `member_type` =
   `owner` if `role='owner'` else `staff`, `organization_id` = `users.tenant_id`).
   _(Non-FORCE tables → the FORCE-RLS backfill footgun does not apply.)_
3. Wire `organization()` in `packages/auth/src/server.ts` alongside the MCP-OAuth plugin;
   set `active_organization_id` on session create (default = the user's sole/owner membership).
4. Resolve JWT `tid`/`role` from `active_organization_id` (fallback to `users.tenant_id`).
5. Ship the tenant switcher + Team UI + invitations (below).
6. **Later (own slice):** contract — drop `users.tenant_id`/`users.role` once nothing reads them.

## A.4 Dashboard shell — switcher, client accounts, Team, audit

- **Tenant switcher lives in the breadcrumb** ([32](32-workspace-switching-breadcrumb.md)) —
  the workspace crumb becomes a picker when the user has >1 membership. No separate top-bar
  control; the existing site/property switcher stays nested under it.
- **Client accounts landing** — a multi-membership user lands on an accounts overview
  (name, role, active modules, "Enter →", pending invites) before entering an org
  ([78 §6](78-consultant-partner-program.md)).
- **Settings → Team** — member list (staff vs consultant via `member_type`), Invite
  (email + role), change role, revoke. Invitations email via the `email.send` bus
  (new `team.invitation` template). Accepting an invite creates the `members` row and it
  immediately appears in the invitee's accounts list.
- **Audit attribution** — `audit_logs.actor_type` gains `consultant`; consultant actions
  are attributed by member identity, surfaced in Settings → Team → Activity
  ([78 §9](78-consultant-partner-program.md)).

## A.5 API surface (Part A)

```
GET    /v1/organizations                     → my memberships (client-accounts list)
POST   /v1/organizations/:id/activate        → set active org (re-mints session)
GET    /v1/organization/members              → team list (admin)
POST   /v1/organization/invitations          → invite (admin)
DELETE /v1/organization/invitations/:id      → revoke
POST   /v1/organization/invitations/:id/accept
PATCH  /v1/organization/members/:id          → change role / suspend (admin)
DELETE /v1/organization/members/:id          → remove member (admin)
```

Most run through Better Auth's org endpoints where possible; api-rest wrappers add the
role gate + audit + email-bus side effects.

---

# PART B — The Partner Program

A partner is an **organization** (D1) that has opted into the program. The public surfaces
recruit + list partners and bootcamps; the portal is where a partner runs its practice.

## B.1 Data model (Part B)

New FORCE-RLS, `organization_id`-scoped tables unless noted. Enums are
`varchar` + inline comment (house convention), validated in Zod (`@sparx/partner-schemas`).

```
partners                         (tenant truth; visibility policy for the public directory)
  id, organization_id (unique)   the partner's own org
  tier            informal|registered|certified
  status          pending|active|suspended
  display_name, bio, website_url
  kind            freelance|agency|developer|other      (application "what describes you")
  location_city, location_state, location_country, is_remote
  specialties     text[]         ecommerce|b2b|crm|email|design|seo|...
  photo_url
  directory_visible  bool default true
  referral_code   varchar(32) unique                    URL-safe, minted on activation
  stripe_payout_account_id  varchar(255)                Connect Express acct_ (payouts)
  payout_min_cents int default 5000                      $50 default threshold
  applied_at, approved_at, certified_at, created_at, updated_at, deleted_at
  RLS: USING (status='active' AND directory_visible) OR organization_id = current_tenant_id()
       — published-directory pattern (marketplace_visibility); app layer further filters.

partner_applications             (review queue; GLOBAL/non-RLS like leads — allow-list in rls-audit)
  id, organization_id (nullable) present iff submitted while authed
  name, email, website_url, kind, note, requested_tier
  status          pending|approved|rejected
  reviewed_at, reviewed_by, created_at

partner_referrals                (organization_id = the PARTNER's org)
  id, organization_id, partner_id
  referred_organization_id       the org that signed up under this code
  referral_code
  signup_at, first_payment_at
  commission_rate  decimal        snapshot at referral time (0.20 / 0.30)
  commission_type  one_time|ongoing
  status           pending|active|churned|forfeited
  created_at
  RLS: tenant_isolation on organization_id (partner reads own). Creation crosses orgs →
       written via withTenant({tenantId: partner.orgId}) from the internal signup hook.

partner_commissions              (organization_id = partner's org)
  id, organization_id, partner_id, referral_id
  amount_cents, currency
  period           2026-07 for ongoing
  status           pending|approved|paid|forfeited
  payout_run_id    -> partner_payout_runs.id
  stripe_transfer_id
  paid_at, created_at
  RLS: tenant_isolation on organization_id.

partner_payout_runs              (organization_id = partner's org)
  id, organization_id, partner_id
  period_start, period_end
  amount_cents, currency, commission_count
  status           pending|processing|paid|failed
  stripe_transfer_id, failure_reason, paid_at, created_at
  RLS: tenant_isolation.
```

## B.2 Application → partner → activation flow

- **Public `/partners/apply`** (no auth): writes a `partner_applications` row.
  - `informal` + **authed** → provision `partners` row `active` immediately; mint referral
    code; return "You're in."
  - `informal` + **anon** → application `approved`; return "Create your account to activate"
    → `app.sparx.works/sign-up?partner=informal`; onboarding provisions the `partners` row.
  - `registered`/`certified` → application `pending`; "We'll review within 3 business days."
    Staff approve via `/internal/partners/:id/approve` (through the operator console), which
    provisions/activates the `partners` row at the requested (or overridden) tier.
    - **Accountless applicants** (public form, email only): a partner IS a tenant, so there
      must be an account to key the `partners` row to. Approval **provisions one** — account
      creation runs only where Better Auth lives, so api-rest delegates to the dashboard's
      token-gated `POST /api/internal/partner-provision` (authenticated with the shared
      `SPARX_INTERNAL_JWT_SECRET`; api-rest reaches it at `SPARX_DASHBOARD_INTERNAL_URL`). That
      route runs `@sparx/auth`'s `provisionInvitedOwner`, which mints the tenant + owner login
      (module-less, so $0 under modules-not-plans), skips platform-legal acceptance (the
      invitee never clicked the checkbox — the dashboard's legal banner prompts them at first
      sign-in), and emails a **set-password invite** (Better Auth's reset flow; the
      `password-reset` template copy is neutral so it reads correctly for a first-time set).
      api-rest links the new tenant onto the application (idempotent — a retry after a partial
      failure reuses it) and activates the `partners` row. Applicants who applied from an
      existing account skip straight to activation.
    - **Email already has a Sparx login** (applied via the public form despite having an
      account): `provisionInvitedOwner` gives that existing user a **new partner workspace**
      (a fresh org they own — no duplicate user, no set-password email; it joins their account
      switcher). So an existing account is NOT a refusal — approval always lands the applicant a
      partner workspace. (Deliberate v1: a dedicated partner org rather than attaching partner
      status to a pre-existing tenant — keeps partner payouts separate from any store billing
      and avoids a "which tenant?" picker. `EMAIL_TAKEN` is now reachable only on a
      concurrent-signup race → retry.)
    - Both branches send a branded **`partner-welcome`** email (`@sparx/email`); new accounts
      additionally get the set-password invite.
- **Self-serve "Become a partner"** (D7) — the same provisioning, reachable one-click from
  signup/onboarding and from the dashboard for an existing org.

## B.3 Referral attribution (extends `@sparx/attribution`)

1. `?ref=CODE` on any `sparx.works` / `app.sparx.works` link → `@sparx/attribution`
   `capture.ts` writes a `sparx_ref` first-party cookie (30-day, set-once), mirroring the
   UTM capture it already does. localStorage mirror per the spec.
2. At **signup** (`apps/dashboard/app/(auth)/actions.ts`), read `sparx_ref` and call the
   internal hook `POST /internal/partners/referrals { referralCode, referredOrganizationId }`
   (shared-secret, new `SPARX_INTERNAL_PARTNERS_TOKEN`). The hook resolves the partner by
   code via `withSystem`, then inserts the `partner_referrals` row via
   `withTenant({ tenantId: partner.organizationId })` (RLS-safe cross-org write).
3. **First payment** — the platform-billing webhook (first successful invoice for the
   referred org) stamps `first_payment_at` and accrues a `partner_commissions` row at the
   referral's snapshot rate. Ongoing (certified, 5%) accrues monthly while the managed
   flag holds.
4. **No retroactive attribution**, 30-day window, forfeited if the referral churns before
   first payment clears ([partners-spec §6–7]).

## B.4 Commissions & Stripe Connect payouts (D5)

- Rates by tier: **Informal 20%** first-payment · **Registered 30%** first-payment ·
  **Certified 30%** first-payment **+ 5% ongoing** on managed accounts. Snapshotted onto
  the referral at credit time (rate changes never rewrite history).
- **Payout rail = Stripe Connect Express**, reusing the `@sparx/payments` /
  `stripe-connect` onboarding precedent (the tenant already onboards a Connect account for
  Sparx Pay; partners onboard a _payout_ Express account → `partners.stripe_payout_account_id`).
- **Monthly payout run** (cron worker): groups `approved` commissions per partner ≥
  `payout_min_cents`, creates a Stripe `transfer` to the partner's Connect account, writes a
  `partner_payout_runs` row, marks commissions `paid`. Manual fallback provider mirrors
  `market/payout.ts`.
- Net-of-fees, monthly, $50 default threshold ([partners-spec §7]).

## B.5 Bootcamps (D6)

```
bootcamps                        (organization_id = the HOST partner's org)
  id, organization_id, partner_id
  title, slug (globally unique), description (rich HTML, TipTap)
  format          in_person|virtual|hybrid|async
  location_city, location_state, location_country
  starts_at, ends_at
  seats_total (null=unlimited), seats_filled
  price_cents default 0, currency
  registration_mode  internal|external
  registration_url   (external mode)
  status          draft|published|cancelled|completed
  created_at, updated_at, deleted_at
  RLS: USING (status='published') OR organization_id = current_tenant_id()   (public read)

bootcamp_registrations           (organization_id = host partner's org)
  id, organization_id, bootcamp_id
  name, email, seats default 1
  status          registered|waitlisted|cancelled|attended
  crm_customer_id                 the lead created in the host's CRM
  created_at
  RLS: tenant_isolation.
```

- **Internal mode**: a public `POST /v1/public/bootcamps/:slug/register` creates the
  registration **and** a lead in the **host partner's CRM** (`crm.customer.created` via the
  two-bus bridge), decrements seats, waitlists past capacity. This is the graduate-attribution
  hook and the dogfood win.
- **External mode**: `registration_url` → Eventbrite/Luma/Forms; Sparx lists + drives clicks.
- Status changes publish `bootcamp.published` / `bootcamp.cancelled` (Bus A, provisioned in TF).

## B.6 Public marketing pages (`apps/web`, `mkt-*` + bespoke component pattern)

| Route                 | Content                                                                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/partners`           | Hero ("Build your practice on Sparx.") · The Opportunity (prose) · How It Works (4 steps) · Tiers (informal/registered/certified comparison) · Directory CTA · **self-serve apply** section · resources teaser · social proof (D7). |
| `/partners/directory` | Filterable directory (tier / location / specialty facets), certified-first sort, `FacetBar` SSR pattern, `ListingCard`, empty state.                                                                                                |
| `/partners/:id`       | Public partner profile.                                                                                                                                                                                                             |
| `/bootcamp`           | Hero ("Build your business. Launch on Sparx.") · What You'll Build · Who It's For · Format labels · **filterable directory** (format/location/date) · Partner CTA.                                                                  |
| `/bootcamp/:slug`     | Server-rendered detail · **auto OG image** · **schema.org `Event`** JSON-LD · internal RSVP form or external CTA · host partner + tier badge.                                                                                       |

- Data via a new `apps/web/lib/partners.ts` + `lib/bootcamp.ts` (the `lib/marketplace.ts`
  `getPublic` + ISR `revalidate` scaffold).
- **SEO (D7):** per-bootcamp `opengraph-image.tsx` + `Event` JSON-LD; async `sitemap.ts`
  awaits published bootcamps; header/footer nav gets `/partners` + `/bootcamp`.

## B.7 Partner Portal (dashboard — the **Finance** area pattern, a non-module platform section)

New `partner` brand hue in `module-provider.tsx`; gated on an `active` partners row
(`isPartner`, fetched in `(dashboard)/layout.tsx`). Rail tile + `partner/nav.ts` +
contextual-panel `'partner'` arm, mirroring Finance. Sub-pages:

- **Overview** — tier + progress, lifetime/pending commissions, active referrals, quick links (Finance KPI layout).
- **Referrals** — referral link (copy, UTM-appended) + referral list (`SelectionList`).
- **Commissions** — earnings summary, payout history, Connect payout-account setup.
- **Clients** (certified) — managed accounts (leans on Part A memberships).
- **Profile** — public directory fields (`SurfaceFrame` edit), photo/logo, visibility toggle.
- **Resources** (D7) — pitch deck, proposal template, per-module onboarding guides, referral kit.
- **Tier Progress** — current tier, thresholds, apply-for-next-tier CTA.
- **Bootcamps** — list (`SelectionList`) + create/edit as **full-page `embedded` `SurfaceFrame`**
  routes (`/partner/bootcamps/new`, `/partner/bootcamps/[id]`) — _not_ the `@detail` overlay
  (module-coupled; Finance does the same). TipTap description.

## B.8 API surface (Part B)

```
# public (no auth, /v1/public/*)
GET  /v1/public/partners                      directory (facets)
GET  /v1/public/partners/:id                  profile
GET  /v1/public/bootcamps                      directory (facets)
GET  /v1/public/bootcamps/:slug                detail
POST /v1/public/bootcamps/:slug/register       internal RSVP → host CRM
POST /v1/public/partners/apply                 application

# partner-authed (active partners row required)
GET/PUT   /v1/partner/profile
GET       /v1/partner/referrals
GET       /v1/partner/commissions
GET       /v1/partner/payouts   + POST /v1/partner/payouts/connect  (Connect onboarding)
POST      /v1/partner/tier/apply
GET/POST  /v1/partner/bootcamps  · PUT /:id · PATCH /:id/status · DELETE /:id (draft only)

# internal (shared-secret SPARX_INTERNAL_PARTNERS_TOKEN)
POST  /internal/partners/referrals             signup hook
GET   /internal/partners  · PATCH /:id/approve · PATCH /:id/tier · PATCH /:id/suspend
```

## B.9 Events (Bus A — `@sparx/events`; provision topics in `terraform/envs/prod/main.tf`)

`partner.application.submitted`, `partner.activated`, `partner.referral.created`,
`partner.commission.accrued`, `partner.payout.paid`, `bootcamp.published`,
`bootcamp.cancelled`, `bootcamp.registration.created`.

---

## Slice plan (build order this session)

0. **Org foundation** — `members`/`invitations` + `session.active_organization_id`, backfill,
   `organization()` plugin, JWT `tid`/`role` from active org, tenant switcher + Team UI + invites.
1. **Partner data model** — `83-partners.prisma` + `84-bootcamps.prisma` (partners,
   applications, referrals, commissions, payout_runs, bootcamps, registrations) + migration +
   RLS + `@sparx/partner-schemas`.
2. **Partner API + events** — public/partner/internal routes, services, TF topics.
3. **Attribution + Stripe Connect payouts** — `?ref` capture, signup hook, commission
   accrual, monthly payout worker.
4. **Marketing pages** — `/partners`, `/partners/directory`, `/bootcamp`, `/bootcamp/:slug`,
   OG, `Event` JSON-LD, sitemap, nav, self-serve apply.
5. **Partner Portal** — the Finance-pattern section + all sub-pages + Bootcamp CRUD; plus the
   consultant client-accounts experience on Part A.

Each slice: keep the gate green (`format`/`lint`/`typecheck`), leave files in the working
tree for commit. DB schema + migration are authored as **files only** — `prisma migrate` /
`generate` run on the user's side (private-IP pipeline; shared-docker footgun).

## Deferred (not this session)

- Contraction migration dropping `users.tenant_id`/`users.role`.
- White-label client reporting PDF ([78 §7](78-consultant-partner-program.md) Phase 2).
- Certification curriculum/assessment ([78 §11](78-consultant-partner-program.md)).
- Tenant reviews of partners; partner leaderboard; delegated client-dashboard audit trail.
- Paid bootcamp ticketing (Stripe-collected registration fees) — internal RSVP is free-first.
