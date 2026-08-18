# sparx Platform — Invoicing & Billing Documents

**Version:** 0.4 (built — Phases 1–8 shipped; standalone $19 pricing + auto-enable wired)
**Author:** Brandon Korous
**Last Updated:** 2026-07-22

> **Reconciled 2026-07-22 (docs-vs-built audit):** Phases 1–8 are shipped and this remains accurate. The invoicing **operator UI** (document editor, line composer, stage bar, AR summary, workflow editor) lives at **`sparx/apps/workbench/surfaces/invoicing/*`** — the "Dashboard authoring UI" (§16 Phase 6) and "dashboard module settings" references predate the `apps/dashboard` → `sparx/apps/workbench` rebuild; read them as the workbench invoicing surface. **Still open** (both correctly deferred below): the **tokenized customer approve/pay public route** (§5 / §17 — Phase 5+ site customer-auth) and the **catalog/part-line stock decrement** (§17 — a line records without a stock move today).

> **Status: design doc.** Captures the architecture for the **authored billing document** —
> a human-built estimate / work order / invoice / ticket that moves through a tenant-configured
> stage workflow, mixes marked-up parts with labor and pass-through charges, and bills a retail
> customer **or** a B2B account. This is the surface [48-product-markup-pricing.md](48-product-markup-pricing.md)
> §5/§11 named as the prerequisite (and blocker) for invoice/quote-line markup — "sparx has no
> standalone manual-invoice / repair-order entity today." This doc designs it as a first-class,
> industry-neutral module, not a repair-shop one-off.

---

## 1. Why

sparx already turns a **cart into a charge** well: a customer checks out, an `Order` is created, and
a net-terms B2B order auto-generates a `B2bInvoice` ([10-b2b-wholesale-prd.md](10-b2b-wholesale-prd.md) §9).
That is the **transactional** path — automated, product-driven, fast.

There is a second, equally common way a business bills: it **authors a document by hand**. A diesel
shop writes an estimate, the customer approves it, the tech does the work (adding parts and hours as
they go), and it's finalized into an invoice. A salon rings up a service. A tattoo artist takes a
deposit against a future session. A caterer bills an event. None of these start from a cart — the
document **is** the work, built line by line and moved through stages.

Today sparx cannot do this:

- `B2bInvoice` is a **header only** (`amount_cents`, no line items) — it records _that_ a net-terms
  order is owed, not _what_ is on it.
- `OrderItem` has no `cost` / `applied_markup` — order lines can't be priced by markup at document
  time or carry the mandatory snapshot ([48](48-product-markup-pricing.md) §5).
- Invoices are tied to a `B2BAccount` (required FK) — there is no way to bill a **retail** customer.
- There is no concept of an **estimate → … → invoice** lifecycle, let alone a tenant-configurable one.

This module adds the **authored billing document**: one entity that serves shops, salons, tattoo
studios, food, services, and trades, because the **stages and labels are the tenant's, not ours**.

### Two ways a charge is born (keep these distinct)

| Path                | Origin                          | Driver       | Entity                        |
| ------------------- | ------------------------------- | ------------ | ----------------------------- |
| **Transactional**   | cart → checkout                 | the customer | `Order` → (auto) `B2bInvoice` |
| **Authored** (this) | hand-built document, stage-flow | the business | **`BillingDocument`**         |

They are different originations but **share primitives**: the markup engine
(`priceLineByMarkup`, [48](48-product-markup-pricing.md), already shipped), line/tax/total math
(`order-totals.ts` `computeLine`/`computeTotals`), surcharges ([48](48-product-markup-pricing.md) §6),
and the CRM customer spine ([11-crm-prd.md](11-crm-prd.md)).

---

## 2. Core model (the one-paragraph picture)

A **`BillingDocument`** belongs to a tenant-configured **`DocumentWorkflow`** (an ordered list of
**`DocumentStage`** rows, exactly like a CRM `Pipeline`/`PipelineStage`). It bills **a `Customer`
(B2C) or a `B2BAccount` (B2B)**. It holds typed **`BillingDocumentLine`** rows whose behavior comes
from a tenant-owned **`BillingDocumentLineType`** registry (part = marked-up, labor = rate × hours,
sublet/freight = pass-through, fee = flat). As the document advances through stages, the tenant can
mark transitions as **snapshot points**: crossing one freezes an immutable **`BillingDocumentSnapshot`**
(lines + totals + party + a rendered PDF) — that frozen copy _is_ "the approved estimate" or "the
final invoice," preserved forever even as the live document keeps evolving. Payments record against
the document for AR.

This is intentionally the same shape as `Pipeline → PipelineStage → Deal` — a pattern already proven
and understood in this codebase.

---

## 3. The document workflow (configurable stages)

Mirrors [22-crm-pipelines.prisma](../packages/db/prisma/schema/22-crm-pipelines.prisma).

- A tenant has one or more **`DocumentWorkflow`** rows (`isDefault`, `slug`, `sortOrder`,
  `archivedAt`). Examples: "Repair Order", "Quick Invoice", "Tattoo Booking".
- Each workflow has ordered **`DocumentStage`** rows. A stage carries:
  - `name` — internal name.
  - **`customerLabel`** — the noun shown to the customer at this stage ("Estimate", "Invoice",
    "Work Order", "Ticket", "Check"). **This is how one engine serves every industry** — the label
    is the tenant's, never hardcoded.
  - `stageType` — semantic role driving system behavior: `draft | open | committed | final | paid | void`.
    (`committed` = customer-approved; `final` = billable/locked; behavior keys off the type, not the
    label.)
  - `snapshotOnEnter` (bool) — freeze an immutable record when the document enters this stage (§4).
  - `numberOnEnter` (bool) + optional `numberPrefix` — assign a stage-specific document number on
    first entry (estimate → `EST-000123`, invoice → `INV-000123`); see §9.
  - `locksEditing` (bool) — once `final`/`paid`, lines are frozen.
  - `color`, `sortOrder`.
- A **"Quick Invoice"** is just a one- or two-stage workflow (`Invoice → Paid`). A simple tenant
  never sees the machinery; a shop builds `Estimate → Approved → In Progress → Invoiced → Paid`.

**Seeded defaults** (a new tenant with the `invoicing` module gets these, editable): a single-stage
**Invoice** workflow (default), and an example **Service / Repair** workflow. Onboarding stays
under the 5-minute goal ([15](15-merchant-onboarding-prd.md)) — defaults work out of the box.

---

## 4. Stage snapshots — the "record for each stage"

The decision (locked): a `BillingDocument` is **one living document**; "a unique record per stage"
is delivered as an **immutable snapshot frozen at the transitions the tenant marks `snapshotOnEnter`**.

- Entering a snapshot stage writes a `BillingDocumentSnapshot`: a JSON freeze of every line, the
  computed totals, the party + bill-to/ship-to, the document number at that moment, the stage, and a
  **rendered PDF** stored as a media asset ([media pipeline](18-frontend-architecture.md)).
- The live document keeps evolving (a tech adds parts during the job); the **approved estimate stays
  exactly as the customer approved it**. This satisfies the financial-record reproducibility
  [48](48-product-markup-pricing.md) §5 demands and gives a queryable, printable history per stage.
- Snapshots are **append-only and never edited** (mirrors CRM `ContentRevision` and the append-only
  activity log — [feedback: CRM architecture]). A void/correction adds a new snapshot; it never
  rewrites one.

> Rejected alternative: a separate editable entity per stage (estimate-doc, work-order-doc,
> invoice-doc that diverge independently). Heavier and worse UX — a shop wants _one_ repair order it
> nurses end to end, with history, not four documents to reconcile. Revisit only if independent
> divergence becomes a real requirement.

---

## 5. Lines & the tenant line-type registry

A **`BillingDocumentLineType`** is a tenant-owned row (seeded defaults + custom) carrying _behavior_,
not just a label:

| Field                   | Meaning                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `name` / `label`        | "Part", "Labor", "Sublet", "Freight", "Shop materials", "Disposal fee" …                          |
| `pricingMode`           | `catalog` \| `markup` \| `labor` \| `flat` \| `pass_through`                                      |
| `defaultTaxable`        | parts usually taxable; labor often not (jurisdiction-dependent) — a default, overridable per line |
| `defaultMarkupRuleId`   | optional — a `markup` line defaults to this rule/matrix                                           |
| `computation`           | optional helper, e.g. `percent_of_labor` for shop-materials                                       |
| `glCode`/`category`     | reporting bucket (parts vs labor vs sublet margin)                                                |
| `isActive`, `sortOrder` |                                                                                                   |

A **`BillingDocumentLine`** then carries: `lineTypeId`, `description`, `quantity`, `unitPrice`,
`costCents` + `appliedMarkup` (the §5 snapshot, identical shape to `quote_items`), `taxable`,
`taxAmount`, `discountAmount`, `lineSubtotal`, `lineTotal`, and product/variant FKs when it came from
the catalog. Pricing by mode:

- **`markup`** — reuse `resolveAndPriceLine` / `priceLineByMarkup` ([48](48-product-markup-pricing.md),
  shipped): cost basis → rule/matrix → price + snapshot stamped on the line.
- **`labor`** — `unitPrice = laborRate`, `quantity = hours`; optional `technicianId`. Tenant default
  labor rate (a tenant setting), overridable per line and per job. (A first-class Technician/Resource
  table is a later slice; v1 uses an optional staff `User` ref + free-text name.)
- **`flat`** — a fixed amount (fees).
- **`pass_through`** — sublet/freight at cost, optionally marked up over the sublet cost (same engine).
- **`catalog`** — a product/variant at its list price (no markup at document time).

Tax is **per line** (`taxable` flag) — the gap the existing tax engine has today — layered on the
tenant/account exemption logic in `tax-service.ts`. Totals reuse `computeLine`/`computeTotals` plus a
document-level surcharge ([48](48-product-markup-pricing.md) §6) and deposit handling (§8).

---

## 6. Parties & billing

On the **CRM customer spine** — never B2B-only.

- `customerId` (nullable) + `b2bAccountId` (nullable), **at least one required** — the exact `Deal`
  pattern ([22-crm-pipelines.prisma](../packages/db/prisma/schema/22-crm-pipelines.prisma)). A retail
  walk-in is `customerId`; a fleet is `b2bAccountId` (+ optional contact `customerId`).
- Denormalized `billTo` / `shipTo` snapshots (name/address) frozen onto the document and its
  snapshots, so a later customer-record edit never rewrites a finalized invoice.
- A `b2bAccountId` document participates in **credit + overdue escalation** exactly like a
  `B2bInvoice` does (§8); a retail document is pay-now/deposit.

---

## 7. Totals, tax & precedence

Reuse the shipped resolution order. Per document:

```
lines (each: qty × unitPrice − discount, +markup snapshot on markup lines)
  → subtotal
  → document discount
  → shipping/freight (a pass_through line or a doc field)
  → tax (per-line taxable × jurisdiction/exemption, tax-service.ts)
  → surcharge (docs/48 §6 — card fee, last)
  → grand total
  − deposits/payments
  = balance due
```

Markup is strictly **cost → line price** and runs before discounts/tax — consistent with
[48](48-product-markup-pricing.md) §4 so margin reporting stays coherent (profit = charged − cost,
per line, from the snapshot).

---

## 8. Payments & AR

- **`BillingDocumentPayment`** rows (append-only): `amountCents`, `method` (cash | card | check | ach
  | wire | store_credit | other), `kind` (`deposit` | `payment` | `refund`), `receivedAt`, `recordedBy`,
  optional `providerRef` when captured through a payment provider.
- Document `status` (derived/cached): `unpaid → partial → paid` (+ `overdue`, `void`). Balance =
  total − Σ payments.
- **Deposits** (tattoo, custom orders): a `deposit` payment before `final`, applied to the balance on
  finalize.
- **B2B credit + overdue**: when `b2bAccountId` is set and the workflow stage is a net-terms `final`,
  the document feeds `sync_b2b_credit_used` and the **`b2b-escalation-service`** (reused as-is —
  [b2b-escalation-service.ts](../packages/crm/src/services/b2b-escalation-service.ts)). The escalation
  service is generalized to read open balances from both `B2bInvoice` and `BillingDocument` during
  coexistence (§15).

---

## 9. Numbering

Extend [record-numbers.ts](../packages/crm/src/services/record-numbers.ts) (count-based, prefix +
6-pad, collision-guarded by a unique constraint). A `BillingDocument` gets a stable internal id; a
**number is minted per `numberOnEnter` stage** using that stage's `numberPrefix` — so the estimate is
`EST-000123` and, when it crosses into the invoice stage, it mints `INV-000123`. The default
single-stage workflow mints one `INV-` number on create. Numbers stay tenant-scoped + monotonic
(gap-prone on voids, fine for human IDs).

---

## 10. PDF / print

There is **no invoice PDF today** (the quote "PDF" is print-styled HTML —
[b2b/quotes.ts](../services/api-rest/src/routes/v1/b2b/quotes.ts)). The document **body** is authored
as a structured line grid (§6 / Phase 6), never a canvas — but the document's **printed presentation
is a builder-authored node tree**, the same machinery as the **Email Builder**
([52](archive/52-email-builder.md), [project: Email Builder]). Layout is exactly where the builder paradigm
earns its keep; financial data is not.

- **Default renderer (Phase 5):** a document → branded output using the tenant's brand tokens
  ([sparx-brand-guide](sparx-brand-guide.md)). v1 ships print-HTML (`@media print`) and adds
  server-side PDF (the media-pipeline path) as a fast follow. A clean, correct-out-of-the-box default
  so a tenant never _must_ design a template. The **snapshot stores the rendered artifact** so the
  approved estimate prints identically forever.
- **Builder-authored template (Phase 5 fast-follow):** the invoice/estimate template is **one
  node-tree authored in the builder, AUTHOR-only**, reusing the email machinery — `renderEmailTree`,
  the data-aware `resolveEmailData` resolution layer, and Prose richtext ([project: Email Builder]).
  The tenant designs header/logo, column choices, the terms/footer block, and accent — bound to
  document data (`{{ document.number }}`, line table, totals, party) via the same data-binding model
  emails use. A built-in default tree ships seeded; the builder edits a copy. Rendering a document =
  resolve its data against the active template tree → HTML → PDF; the snapshot freezes the result.
- A tokenized **customer-facing view** (approve / pay online) is a later slice, reusing the site
  customer-auth surfaces.

---

## 11. Data model (sketch)

New module, all tenant-scoped (UUID PK, `tenant_id`, **RLS ENABLE+FORCE**, `created_at`/`updated_at`
per [05](05-data-model.md) + [wizeworks/packages/db/CLAUDE.md](../packages/db/CLAUDE.md)).

```
document_workflows        (≈ pipelines)        id, tenant_id, name, slug, is_default, sort_order, archived_at
document_stages           (≈ pipeline_stages)  id, tenant_id, workflow_id, name, customer_label,
                                                stage_type, snapshot_on_enter, number_on_enter,
                                                number_prefix, locks_editing, color, sort_order
billing_document_line_types                    id, tenant_id, name, label, pricing_mode, default_taxable,
                                                default_markup_rule_id, computation, gl_code, is_active, sort_order
billing_documents         (≈ deals)            id, tenant_id, workflow_id, stage_id, customer_id?, b2b_account_id?,
                                                assigned_user_id?, number, currency, bill_to(json), ship_to(json),
                                                subtotal, discount_total, tax_total, shipping_total, surcharge_total,
                                                total, deposit_total, amount_paid, balance, status, notes,
                                                valid_until, finalized_at, voided_at, metadata
billing_document_lines                         id, tenant_id, document_id, line_type_id, product_id?, variant_id?,
                                                technician_user_id?, description, quantity, unit_price, cost_cents,
                                                applied_markup(json), taxable, discount_amount, tax_amount,
                                                line_subtotal, line_total, sort_order, metadata
billing_document_snapshots (append-only)       id, tenant_id, document_id, stage_id, document_number,
                                                snapshot(json: lines+totals+party+meta), pdf_media_id?, created_by, created_at
billing_document_payments  (append-only)       id, tenant_id, document_id, kind, method, amount_cents,
                                                provider_ref?, received_at, recorded_by, created_at
```

`Tenant` gains the inverse relations; `Customer` / `B2BAccount` / `MarkupRule` / `User` gain back-refs.
RLS policies + any partial uniques are hand-SQL ([db CLAUDE.md](../packages/db/CLAUDE.md)).

---

## 12. API & MCP

**API-first** ([02](02-architecture-overview.md)). REST under `/v1/invoicing/`:

- `…/workflows` + `…/workflows/:id/stages` — workflow & stage CRUD.
- `…/line-types` — the registry CRUD.
- `…/documents` — document CRUD; `…/:id/lines` add/update/remove (markup-priced or manual/labor);
  `…/:id/advance` move stage (freezes a snapshot when configured); `…/:id/payments` record a
  payment/deposit; `…/:id/snapshots` list; `…/:id/pdf` render.
- Markup-priced lines flow through the shipped `priceLineByMarkup` resolver.

**MCP** ([07](07-mcp-server-spec.md)) — natural-language authoring is a strong fit:

> "Start an estimate for Gillett's truck #14 — 2 injectors marked up by the parts matrix and 3 hours labor."
> "Add a $120 sublet for the machine shop, mark it up 15%."
> "Approve the estimate and convert it to an invoice."
> "Mark invoice INV-000123 paid by check."

---

## 13. Events

Publish on the platform bus ([@wizeworks/events](../packages/events), [03](03-infrastructure-deployment.md)):
`billing_document.created`, `.stage_changed`, `.finalized`, `.paid`, `.voided`. These feed
notifications (email/SMS to the customer when an estimate is ready), margin reporting, and — naturally
— the **automation engine** ([81-automation.md](81-automation-module.md)): a stage transition is exactly the
kind of event a tenant rule gates ("when a Repair Order reaches Approved, email the customer + create
a fulfillment task"). New `billing_document.*` types register in `EventType` + the Terraform topic map
([module-slug / event footgun]).

---

## 14. Module gating & pricing

A **standalone `invoicing` module** ([feedback: modules, not plans] — gate by module flag, never a
plan tier). The slug must be added to **every** hardcoded module list (api-rest `MODULE_SLUGS`
activation gate, dashboard module catalog, marketing pages, etc. — the ~8-place footgun in
[feedback: module slug stale lists]) or activation fails validation. A disabled module 404s, runs no
workers, stores no rows.

**Invoicing owns the billing surface; other modules consume it.** B2B is _about_ wholesale
(pricing, contacts, quotes, fleet, net terms); it _uses_ invoicing to implement billing. So invoicing
is the canonical owner of the `BillingDocument` substrate and the `/v1/invoicing/*` namespace
(including AR aging at `GET /v1/invoicing/aging`); the B2B and Commerce dashboards **pull** that data
into their own surfaces.

**Pricing — $19/mo standalone, bundled free with Commerce or B2B** (decided 2026-06-12):

- A tenant with **neither** Commerce nor B2B pays **$19/mo** for invoicing — the service-business
  case (contractor, repair shop, salon, consultant) that quotes and bills without a site.
- **Commerce or B2B activates the full invoicing surface for $0.** This is the `@wizeworks/modules`
  **`BUNDLED_FREE`** graph (`invoicing ⇐ [b2b, commerce]`): `isModuleEnabled('invoicing')` is derived
  true whenever a provider is on, so the existing `requireInvoicingModule` gate "just passes" for those
  tenants with no OR-checks. The standalone `invoicing` flag is only ever **written** on a real $19
  purchase, so a billing reconciliation never charges the bundled case. The dashboard shows invoicing
  as **"Included"** (locked-on) for B2B/Commerce tenants.
- Because a bundled tenant never fires `module.activated('invoicing')` (no flag write), the activation
  handlers announce on **derived-state transitions**: enabling B2B/Commerce announces invoicing
  _available_ so its seed consumer (default workflows + line-type registry) still runs. Idempotent;
  availability events are never billed.
- The related **`b2b ⇒ commerce`** dependency (a _paid_ requirement, not a free bundle) is enforced
  by the same machinery (`@wizeworks/modules` **`REQUIRES`**): enabling B2B writes + bills Commerce, and
  disabling Commerce while B2B is on is blocked. See [17-billing-subscriptions.md](17-billing-subscriptions.md) §2.

Naming for users: the **module** is "Invoicing"; the **document label** is the tenant's per workflow.

---

## 15. `B2bInvoice` coexistence & migration

`B2bInvoice` today is a **thin net-terms AR header** auto-created from a B2B order
(checkout-service / approval). `BillingDocument` is the richer authored document — it **doubles the
AR-header responsibility**, so the two converge.

**Coexist now (Phase 1–7):** `B2bInvoice` keeps handling order-derived net-terms AR unchanged.
`BillingDocument` handles authored documents. The `b2b-escalation-service` + credit sync read open
balances from **both** during the overlap.

**Migrated (Phase 8, shipped 2026-06-11):** `B2bInvoice` retired into `BillingDocument`.

1. A **system `net-terms-ar` workflow** (`Invoice → Paid`; the Invoice stage is `final` + numbered +
   locked + snapshot-on-enter) is the convergence target. It is NOT a user-facing default seeded on
   `invoicing` activation — it is **lazily ensured by the B2B flow itself** (`b2bArService`). The
   order-derived AR write path keys off the **`b2b`** module (it composes into the B2B order/approval
   transaction without probing the invoicing flag). Note this composes cleanly with the §14 pricing
   model: because invoicing is **`BUNDLED_FREE` with B2B/Commerce**, a B2B tenant _also_ has the full
   invoicing surface enabled (at $0) — so "B2B gets AR" and "B2B gets invoicing authoring free" are the
   same fact, just reached by two mechanisms (write-path module check + read-time derivation).
2. A backfill migration (`20260807000000_b2b_invoices_to_billing_documents`) maps each `B2bInvoice` →
   a finalised `BillingDocument` (one synthetic line carrying the amount; a payment row when paid;
   `written_off` → `void`), preserving `invoice_number`, status, `dueAt` and payments via an RLS-safe
   per-tenant `set_config` loop ([db CLAUDE.md]). Idempotent (tagged `metadata.b2bInvoiceId`).
3. Checkout (`commerce/checkout-service`) + approval (`api-rest b2b/approval`) now call
   `b2bArService.createOrderArDocument`, composing into the order transaction.
4. `sync_b2b_credit_used()` was rewritten to sum **open `billing_documents` balances**, and credit
   re-syncs through the billing money authority (`recomputeTotals`) on every AR mutation. Escalation
   - the automation scanner read AR solely from `billing_documents` (the dual-read is gone).
5. The REST `/v1/b2b/invoices` routes, dashboard `/b2b/invoices` pages, and the customer portal are
   backed by `billing_documents` (a thin "invoice" projection), with the now billing-native status
   vocabulary `unpaid | partial | paid | overdue | void` (`void` replaces `written_off`).
6. **`b2b_invoices` is kept read-only this release; a later contract migration drops the table.**

---

## 16. Phasing

| Phase | Scope                                                                                                                                                                          | Depends on          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| 1     | Data model + RLS; `invoicing` module gate; workflow + stage CRUD; line-type registry; seeded defaults. API-first.                                                              | —                   |
| 2     | Documents + lines + pricing: markup parts (reuse §5 engine), labor (rate×hours+tech), flat/pass-through; per-line tax; totals.                                                 | Phase 1, docs/48 §5 |
| 3     | Stage advance + **snapshots** + per-stage numbering + edit-locking.                                                                                                            | Phase 2             |
| 4     | Payments / AR: deposits, partial payments, balance, status; B2B credit + overdue reuse (dual-read).                                                                            | Phase 2             |
| 5     | PDF / print: themed default renderer + snapshot artifact, then **builder-authored template** (email-tree machinery, §10); (later) tokenized customer approve/pay view.         | Phase 3             |
| 6     | Dashboard authoring UI — the document editor (structured line composer, live markup/margin readout, stage bar). **Not a canvas** — layout lives in the Phase 5 print template. | Phases 2–5          |
| 7     | MCP tools (create/price/advance/pay).                                                                                                                                          | Phase 2–4           |
| 8     | **`B2bInvoice` → `BillingDocument` migration** (§15) — backfill, repoint, retire.                                                                                              | Phases 1–4          |

Phase 1 is shippable on its own (config surface, no documents yet) — consistent with "deploy early,
deploy small."

> **Status (2026-06-12): Phases 1–8 shipped; pricing + auto-enable wired.** `invoicing` is now a
> standalone **$19/mo** add-on (`BUNDLED_FREE` with Commerce/B2B), live in `ONBOARDING_MODULES`, the
> marketing pricing switchboard, the dashboard module settings, and `capabilities.ts`; AR aging is
> exposed at `GET /v1/invoicing/aging`. The remaining work is the contract half of the §15 migration
> (drop the read-only `b2b_invoices` table next release) plus the deferred follow-ons (visual
> template-builder canvas; markup-rule picker in the line grid).

---

## 17. Open questions / out of scope (v1)

- **Technician/Resource** as a first-class table (scheduling, per-tech labor rates, productivity) —
  v1 uses an optional staff `User` ref + free-text. Hooks to B2B service scheduling (docs/64) later.
- **Recurring / subscription invoices** — reuse the subscriptions engine ([09](09-ecommerce-engine-prd.md)),
  not modeled here.
- **Customer-facing approve/pay portal** — Phase 5+ (site customer-auth).
- **Multi-currency per document**, **partial-line refunds**, **time-tracking → labor lines** — later.
- **Inventory decrement** when a `catalog`/`part` line is added (reserve/consume stock) — integrate
  with [inventory](09-ecommerce-engine-prd.md) in a follow-up; v1 records the line without a stock move.
- **Sales tax automation** (per-jurisdiction) beyond the existing engine — tracked with the tax
  provider work, not here.
