# Slice 8 — Deferred enforcement follow-ups

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-05

> Slice 8 of the operator console ([build-plan.md](build-plan.md) §5) shipped three tenant
> write actions: **module activate/deactivate** (fully enforced — it drives the real
> `module.{activated,deactivated}` event path), **suspend/unsuspend**, and a **storage-limit
> override**. The latter two shipped **deliberately scoped down** to the write + audit + display
> layer, because the _enforcement_ substrate they'd act on does not exist yet and building it is a
> cross-cutting change with real cost and product decisions. This doc captures exactly what's
> missing so we can pick each up cleanly, untangled from the rest of the console.
>
> Decisions taken at build time (2026-07-05): suspend = **status-only for now**; storage-limit =
> **override field + operator UI now**. This doc is the "so we get back to them soon" record.

---

## 1. What shipped in Slice 8 (the ground we build on)

| Action                     | State today                                                                                                                                                                                                                                  | Where                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Module activate/deactivate | **Fully enforced.** Operator route drives the tenant's own toggle path (event announce on both buses, default seeding, Stripe item sync) via the shared `lib/module-toggle.ts`; stamps the tenant's `audit_logs` as `actor_type='operator'`. | `wizeworks/services/api-rest/src/routes/internal/operator-tenant.ts` (`PATCH …/modules/:slug`), `wizeworks/services/api-rest/src/lib/module-toggle.ts`       |
| Suspend / unsuspend        | **Status-only.** Flips `tenants.status` between `active`/`suspended` and records it in the tenant's own activity log. **No request path blocks a suspended tenant** — see §2.                                                                | `operator-tenant.ts` (`PATCH …/status`), admin `…/[id]/_components/suspend-control.tsx`                                                                      |
| Storage-limit override     | **Stored + displayed.** Operator sets/clears a per-tenant cap at `settings.limits.storageBytes`; shown on the tenant detail. **Nothing enforces it at upload time** — see §3.                                                                | `operator-tenant.ts` (`PATCH …/storage-limit`), `wizeworks/services/api-rest/src/lib/tenant-limits.ts`, admin `…/[id]/_components/storage-limit-control.tsx` |

Both scoped actions are **capability-gated** (`tenant:suspend`), **confirmed**, and **dual-audited**
(the tenant's `audit_logs` + the `wize_admin` operator audit). The confirm copy tells the operator,
in plain language, that enforcement is not live yet — so the console never over-promises.

---

## 2. Follow-up A — Suspend enforcement

### Current gap

`tenants.status` is read only for **display and analytics** (the operator console, the platform
metrics lifecycle counts in `operator-metrics.ts`). **No code anywhere gates a request on it.** A
suspended tenant's staff can still sign in and act, its API keys still work, and its public
storefront still serves — the status is cosmetic until this lands.

### The fork (a product decision)

"Suspended" can mean different things, and the scope changes the blast radius:

1. **Staff + API blocked (bounded).** A suspended tenant's authenticated staff/API requests are
   rejected. One choke point: the shared auth `preHandler` in
   [`wizeworks/packages/api-core/src/auth.ts`](../../../packages/api-core/src/auth.ts) — after resolving
   `request.auth`, look up the tenant's status and throw `forbidden` when suspended. The public
   storefront (which skips auth via `publicPrefixes`) stays up.
2. **Also take the public site offline (larger).** Additionally make the public storefront +
   shopper checkout return unavailable. This is a **separate** change on the public site-render
   path (the `site` app + the public site-config resolver in api-rest) — a suspended tenant's site
   returns a 503/"unavailable" page. This is the leverage suspension usually implies for a
   delinquent/abusive tenant.

### Cost & footguns

- **Hot path.** The auth `preHandler` runs on **every authenticated request across every service**
  (api-rest, api-graphql, api-mcp). A naive `SELECT status FROM tenants` per request adds a DB
  round-trip to the hottest path. Mitigation: a small in-process cache keyed by tenant with a short
  TTL — the **exact pattern already accepted** for module gating
  ([`wizeworks/packages/modules/src/index.ts`](../../../packages/modules/src/index.ts), `isModuleEnabled`, 60s
  TTL). Invalidate on the suspend/unsuspend write (same as `invalidateModuleCache`). Surface the
  decision before adding per-request cost (memory rule: verify recurring-cost/hot-path changes).
- **JWT staleness.** Staff JWTs live ~5 min (`auth.ts`), so a just-suspended tenant's existing
  token stays valid until it expires regardless of the status check — acceptable, but note it.
- **Don't collapse RLS.** Enforcement reads the non-RLS `tenants` dispatch row; never add an
  `is_suspended` flag to `users` or anything that would weaken tenant isolation (16 §2.4).

### Recommended shape (when we return)

Ship option 1 first (cached status check in the auth `preHandler`, staff/API only) — it's bounded,
reuses an accepted cost pattern, and makes suspension real for the operator-facing case. Layer
option 2 (public site offline) as a follow-on once the public site-render choke point is scoped.
The suspend write + audit + UI are already done, so this is purely the read-side gate.

---

## 3. Follow-up B — Storage-quota enforcement

### Current gap

There is **no storage-quota system anywhere** in the platform: no default limit, no per-tenant cap
enforcement, nothing in the media-upload path that refuses a write. Slice 8 added the **override
value** (`settings.limits.storageBytes`, read/written via
[`wizeworks/services/api-rest/src/lib/tenant-limits.ts`](../../../services/api-rest/src/lib/tenant-limits.ts))
and surfaces it, but nothing consumes it yet. Real per-tenant usage is already computed (media
asset + variant `byteSize` sum, shown on the tenant detail since Slice 3).

### What's missing

1. **A platform default limit.** Because sparx is **modules-not-plans** (no plan tiers — see the
   core product model), the default should be a **flat platform constant** (e.g. `N` GB for every
   tenant), NOT a per-plan limit. The operator override then raises/lowers it per tenant. Pick the
   default GB deliberately (a cost/UX decision).
2. **Enforcement at the upload path.** The write choke points are the authenticated media upload /
   presign routes (`wizeworks/services/api-rest/src/routes/v1/media/uploads.ts`, and the public
   `routes/v1/public/media-upload.ts`) and/or `media-worker` at finalize. Before issuing a presigned
   URL (or at finalize), compare current usage + the incoming size against the effective cap
   (override ?? default) and refuse over-limit with a clear, typed error.
3. **Tenant-facing UX.** A non-technical, jargon-free message when a tenant hits the cap ("You've
   used all your storage — remove files or contact us to raise your limit"), plus a dashboard
   surface showing usage vs. limit. Must follow the non-technical-audience rule.

### Open product questions

- **Hard block, warn, or grace?** Refuse new uploads outright at the cap, warn near it, or allow a
  grace overage? Different UX + different enforcement point.
- **What counts toward the cap?** Originals + generated variants (what the tenant-detail sum uses),
  or originals only?
- **Default GB** for the flat platform limit.

### Recommended shape (when we return)

Decide the flat default + the block/warn policy, add the effective-cap check to the presign issuance
(cheapest place to refuse — before bytes move), and add the tenant dashboard usage surface. The
override read/write + operator UI + audit are already done, so this is the default constant +
enforcement check + tenant UX.

---

## 4. Not in scope here

These stay tracked with the rest of the console's deferred items (not duplicated into this doc):
the platform-daily analytics rollup + cron (Slice 3), deep feedback analytics + the operator media
proxy (Slice 7), and the feedback-inbox scale ceiling (Slice 7). This doc is **only** the two
Slice-8 enforcement layers above.
