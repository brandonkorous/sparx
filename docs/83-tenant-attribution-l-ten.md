# 83 — Tenant-Level Attribution (L-TEN) — Build Tracker

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-10

---

> **This is a tracker, not a spec.** The full design lives in
> [docs/80 — Marketing Attribution & Analytics](80-marketing-attribution-analytics.md). That doc
> describes attribution at two altitudes: **L-PLAT** (WizeWorks acquisition — _which channel
> produced a paying tenant_) and **L-TEN** (tenant commerce — _which channel produced an order_).
>
> **L-PLAT shipped** (2026-06-10): `@sparx/attribution`, the `apps/web` capture, `tenants.acquisition_*`,
> the internal acquisition report, and a consent banner. **L-TEN has not been built.** This doc exists
> so it isn't forgotten — it carries the concrete gap list, the reusable pieces, the sequencing
> constraint, and a done-checklist. When L-TEN ships, fold the substance back into docs/80 §11 and
> mark this tracker closed.

---

## 1. Why it's parked (not abandoned)

L-TEN is doc 80 **Phase 3**. It is schema- and migration-heavy: three new tables plus attribution
columns on `customers` and `orders`, in one migration. It was deferred on **2026-06-10** because
multiple agents were actively editing the Prisma schema (`02-tenant.prisma`, `03-auth.prisma`) and
landing a `push_subscriptions` migration at the same time — running an attribution migration
concurrently invites migration-ordering and merge conflicts.

**Unblock condition:** the DB churn settles (no other agent editing `customers`/`orders` schema or
adding migrations), then build straight through. Attribution is **not retroactive** (docs/80 §1) —
every site visit that lands before the capture layer exists is unattributable forever, so this
should ship soon after the tree is calm, capture-layer first.

## 2. Reuse — do NOT rebuild these

| Asset                                                                                        | Where                                              | Use for L-TEN                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------- |
| `captureTouch` / `classify` / `resolveFirstTouch` / `resolveLastTouch` / `serializeSnapshot` | `@sparx/attribution` (`packages/attribution/src/`) | Pure, domain-agnostic — call directly from site capture   |
| UTM taxonomy + `AttributionSnapshot` / `Channel` / `AttributionModel` types                  | `@sparx/attribution`                               | Universal                                                 |
| `gateTracker({ category, load })`                                                            | `apps/site/lib/consent.ts`                         | Consent-gate the site capture (analytics category)        |
| `getVisitorId()` (mints/returns `sparx_consent` UUID)                                        | `apps/site/lib/consent.ts`                         | Visitor identity for stitching touches → customer → order |
| `ConsentRecord.visitorId → customerId` edges                                                 | `packages/db/prisma/schema/53-consent.prisma`      | Back-link anonymous touches once a customer is known      |

The L-TEN difference from L-PLAT is only: **tenant-scoped cookies** (not `.sparx.works`), **the
site visitor id** (`sparx_consent`, not `sparx_attr_vid`), and persistence to an
`attribution_touches` table instead of platform `tenants.*` columns.

## 3. Build checklist

### 3.1 Capture layer (`apps/site`)

- [ ] Add `@sparx/attribution` (`workspace:*`) to `apps/site/package.json` (+ Dockerfile COPY closure).
- [ ] Site capture component (mirror `apps/web/components/attribution-capture.tsx`): consent-gated
      via the **site** `gateTracker`, tenant-scoped cookie domain, visitor id from `getVisitorId()`.
- [ ] Edge proxy/middleware visitor seam if needed (the site already mints `sparx_consent`).
- [ ] Cross-domain handoff for custom domains (docs/80 §6.2): signed `?_sx=` param to carry the visitor
      id across the eTLD+1 boundary (site ↔ checkout/account on a different registrable domain).

### 3.2 Schema — one migration (docs/80 §8; RLS per [packages/db/CLAUDE.md](../packages/db/CLAUDE.md))

- [ ] `attribution_touches` — tenant-scoped, append-only. `id · tenant_id · visitor_id · session_id ·
snapshot(jsonb) · channel · customer_id(FK,null) · order_id(FK,null) · occurred_at` + indexes.
      `ENABLE`+`FORCE` RLS + `tenant_isolation`.
- [ ] `attribution_visitors` — tenant 1:1 per visitor. `tenant_id · visitor_id(PK) · first_touch(jsonb) ·
last_touch(jsonb) · first_seen_at · last_seen_at · customer_id(FK,null)`. `ENABLE`+`FORCE` RLS.
- [ ] `utm_campaigns` — registry (docs/80 §8.4). `id · scope(tenant|platform) · tenant_id(null) · source ·
medium · campaign · friendly_name · created_by · created_at`. RLS on tenant-scoped rows.
- [ ] Columns on `customers` (docs/80 §8.3): `first_touch_channel/source/campaign`, `first_touch_at`,
      `last_touch_*`, `acquisition_channel`. Additive nullable — no backfill.
- [ ] Columns on `orders` (docs/80 §8.3): `attributed_channel/source/campaign`, `attribution_model`,
      `attribution(jsonb)` snapshot for recompute. Additive nullable — no backfill.

### 3.3 Ingestion API + events

- [ ] `POST /v1/attribution/touch` (`services/api-rest/src/routes/v1/public/`) — validate snapshot,
      write `attribution_touches` (tenant-scoped), publish event. Consent already enforced client-side;
      re-validate server-side.
- [ ] Event payloads (docs/80 §8.5): add an `attribution` block to `customer.created`,
      `customer.subscribed`, `order.created`; add `attribution.touch.recorded`.
      **Footgun:** a new `crm.*`-class event must publish on BOTH buses to reach a consumer
      ([CRM two-bus delivery](../packages/crm) / memory `reference_crm_two_bus_delivery`).

### 3.4 Conversion stitching

- [ ] Checkout → on `order.created`, snapshot the visitor's resolved touch onto the order
      (`orders.attributed_*` + `attribution` jsonb) using the chosen model.
- [ ] Signup / `customer.subscribe` → write/extend `attribution_visitors`, link `visitor_id → customer_id`,
      denormalize first/last-touch onto `customers`.
- [ ] Attribution models (docs/80 §9): start with `first` + `last_non_direct`; the jsonb snapshot makes
      `linear` / `position_based` / `time_decay` a pure recompute later.

### 3.5 Reporting + MCP (docs/80 §11–§12)

- [ ] Dashboard tenant reports: channel / campaign / revenue (RLS-scoped queries over
      `attribution_touches` ⨝ `orders`). Commerce module surface.
- [ ] MCP tools: `get_channel_report`, `get_campaign_performance`, `get_customer_journey`,
      `get_attribution_for_order`. Register in the MCP tool registry; gate on the `ai` module.
- [ ] In-product UTM link builder (docs/80 §11.3) using `@sparx/attribution`'s `buildLink`/`toCsv`.

## 4. Done when

- A site visit with a `utm_*` URL (consent granted) writes an `attribution_touches` row.
- An order placed by that visitor carries `orders.attributed_*` + an `attribution` snapshot.
- The tenant dashboard shows orders/revenue by channel & campaign, RLS-isolated per tenant.
- The four MCP attribution tools answer for a tenant.
- docs/80 §11 is updated to reflect shipped reality and this tracker is closed.

## 5. Related

- [docs/80 — Marketing Attribution & Analytics](80-marketing-attribution-analytics.md) — the spec.
- [docs/16 §2.5 — System/Internal principals](16-auth-security.md) — pattern for the L-PLAT report (precedent).
- [docs/42 — Legal & Consent](42-legal-and-consent.md) — the consent gate the capture rides on.
- [packages/db/CLAUDE.md](../packages/db/CLAUDE.md) — RLS hand-edit + FORCE-RLS backfill footgun.
