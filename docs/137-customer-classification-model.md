# 137 — Customer classification: the three-axis model

Version: 0.1
Author: Brandon Korous
Last Updated: 2026-07-24

> How sparx classifies a customer/contact. Adopts HubSpot's separation of
> concerns: **lifecycle stage** (where they are in the journey), **lead status**
> (what a rep is doing right now), and **relationship type** (how they transact) —
> three orthogonal fields instead of one overloaded `type` enum. Companion to
> [136-customer-profile-workbench.md](136-customer-profile-workbench.md).

## Why

The single `customers.type` enum (`prospect · retail · regular · vip · b2b`)
crammed three independent questions into one mutually-exclusive slot, so it could
not express real states: a **wholesale account that is still a prospect**, a **VIP
who buys at trade prices**, or a lead who **subscribed** vs one who **inquired**.
HubSpot solves this with three separate properties; a contact carries one value on
each axis at once. We adopt that structure (research: HubSpot lifecycle stages KB).

sparx already owns the _opportunity_ axis — the **Deals + Pipelines** module is our
deal-stage machinery — so the contact record doesn't re-implement pipeline stages;
lifecycle stage stays a coarse marker and the deal carries the detail.

## The three axes

### 1. Lifecycle stage — `lifecycleStage` (column `lifecycle_stage`)

Where the contact is in the overall journey. Coarse, mostly **auto-advanced** by
events (a completed order sets `customer`). HubSpot's eight defaults:

| Value                      | Label               | Meaning                                      |
| -------------------------- | ------------------- | -------------------------------------------- |
| `subscriber`               | Subscriber          | Opted in to hear from you; nothing more yet. |
| `lead`                     | Lead                | Made contact / inquired beyond subscribing.  |
| `marketing_qualified_lead` | Marketing qualified | Marketing judged them ready for sales.       |
| `sales_qualified_lead`     | Sales qualified     | Sales judged them a real potential customer. |
| `opportunity`              | Opportunity         | Has an open deal in progress.                |
| `customer`                 | Customer            | Has at least one completed order. **(auto)** |
| `evangelist`               | Evangelist          | A customer who actively advocates for you.   |
| `other`                    | Other               | Doesn't fit the ladder.                      |

Default for a hand-added contact: `lead`. Stored `VarChar(30)`, NOT NULL.

### 2. Lead status — `leadStatus` (column `lead_status`)

The micro work-state — what someone is doing about this contact **right now**.
HubSpot frames it as a sub-status of the qualified-lead phase, so it is **nullable**
(only meaningful while a lead is being worked; a settled customer clears it).

`new · open · in_progress · open_deal · unqualified · attempted_to_contact · connected · bad_timing`

Stored `VarChar(30)`, nullable. Labels title-case the value ("Attempted to contact").

### 3. Relationship type — `type` (column kept)

How the contact transacts with you. This is the **load-bearing** axis (pricing +
A/R), so it keeps the existing `type` column and its `b2b` value untouched — only
its _meaning_ narrows from "everything" to "relationship kind":

| Value     | Label      | Behaviour                                           |
| --------- | ---------- | --------------------------------------------------- |
| `retail`  | Individual | Standard consumer / retail pricing. **(default)**   |
| `b2b`     | Wholesale  | Trade account: agreed pricing + A/R. **(existing)** |
| `partner` | Partner    | Referral / affiliate / reseller. Label-only.        |
| `vendor`  | Vendor     | Someone you buy from. Label-only.                   |

Only `b2b` carries pricing behaviour, exactly as before — so no pricing code
changes. `prospect`, `regular`, `vip` **leave** this axis (they were never
relationship kinds).

## Migration mapping (old `type` → three fields)

One backfill, per existing row, purely from the old `type` (deterministic, no
guessing from order counts):

| Old `type` | → `lifecycle_stage` | → `lead_status` | → `type` (new) | → `tags` append |
| ---------- | ------------------- | --------------- | -------------- | --------------- |
| `prospect` | `lead`              | `new`           | `retail`       | —               |
| `retail`   | `customer`          | _null_          | `retail`       | —               |
| `regular`  | `customer`          | _null_          | `retail`       | `regular`       |
| `vip`      | `customer`          | _null_          | `retail`       | `vip`           |
| `b2b`      | `customer`          | _null_          | `b2b`          | —               |

`regular`/`vip` were engagement tiers with no home on any of the three axes, so
they are **preserved losslessly as tags** rather than dropped — a tenant can still
segment/filter on them, and a later "loyalty tier" feature can promote them out of
tags cleanly.

## Load-bearing behaviour that moves

- **First-order promotion.** `checkout-service`, `channel-order-ingest`, and the
  guest→member `membership` upgrade set the old `type` from `prospect` to `retail`
  on first purchase. That promotion now targets **`lifecycleStage → customer`**
  (leaving relationship type alone), which is what "became a customer" actually
  means.
- **B2B account linking.** `b2b-account-contact-service` promotes a contact to the
  wholesale relationship when linked to a trade account — that stays on `type`
  (`… → 'b2b'`), because it is a _relationship_ change, not a lifecycle one.
- **Segments / automation.** `customer.type` still resolves (now = relationship);
  `customer.lifecycleStage` and `customer.leadStatus` are added as new
  resolver/segment fields.

## Surfaces

- **crm-schemas** — `LifecycleStage`, `LeadStatus` enums; `CustomerType` narrowed
  to `retail · b2b · partner · vendor`; `lifecycleStage` + `leadStatus` on
  Create/Update inputs and the projections.
- **Workbench** — the customer form gets three controls (lifecycle, lead status,
  relationship); the rail/list badge leads with **lifecycle stage** (the primary
  "where are they" signal), relationship type as a secondary chip; lead status
  shows only while pre-customer. `customerTypeMeta` splits into
  `lifecycleStageMeta` / `leadStatusMeta` / `relationshipTypeMeta`.
- **Deals module unchanged** — it remains the opportunity/pipeline detail; a deal
  moving to won can (later) nudge lifecycle to `customer`.

## Migration robustness (superuser-safe backfill)

The backfill reads `type` to decide all three axes **and** rewrites `type`, so a
naive multi-statement version isn't idempotent — once a prospect's `type` flips to
`retail`, a re-run can't tell it was a prospect. That bites under the FORCE-RLS
tenant loop when it runs in a **superuser** context (local docker): RLS isn't
row-scoped, so the loop re-runs on every row per tenant and re-catches converted
rows. The shipped migration avoids it by snapshotting the original `type` into an
immutable temp column (`_orig_type`) and mapping from that in one atomic `UPDATE`,
correct under RLS (prod) and superuser (local), and idempotent on re-run.

## Status — applied + verified locally (2026-07-24)

Done against local docker (dev was down): `prisma migrate deploy` + `generate`; the
backfill verified — 39 retail customers, 13 wholesale, 26 leads (ex-prospects), and
`regular`/`vip` preserved as tags; `migrate status` = up to date, no drift; all
touched packages typecheck clean. **Remaining:** push (the pipeline applies the
migration to prod) and restart api-rest when dev comes back up.
