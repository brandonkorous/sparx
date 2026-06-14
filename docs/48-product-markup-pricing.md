# Sparx Platform — Product Markup, Surcharges & Fee Pass-Through

**Version:** 0.2 (design notes — not yet scheduled)
**Author:** Brandon Korous
**Last Updated:** 2026-06-03

> **Status: backlog / thinking doc.** This captures the feature so it isn't forgotten —
> nothing here is built yet, and it is expected to land soon. It describes one capability with
> **three application points**: deriving a product's **catalog price** from its cost via a markup
> rule; applying a markup to **invoice/quote lines** at document time (especially parts on a
> service/repair invoice); and adding **document-level surcharges** that pass through a
> transaction cost the merchant incurs — most commonly a configurable **credit-card processing
> fee** (default 3%). Today the only thing resembling any of this is the dropship-only "pricing
> rules" in [14-dropship-integration-prd.md](14-dropship-integration-prd.md) §4 — a markup over
> supplier cost, hard-wired to the dropship import flow. This doc generalizes markup into a
> first-class, reusable platform primitive that any selling tenant can use, dropship or not,
> extends it to the invoice line, and adds surcharges. It builds on the cost fields already in
> [05-data-model.md](05-data-model.md) (`product_variants.cost`), the B2B price resolution in
> [10-b2b-wholesale-prd.md](10-b2b-wholesale-prd.md) §3, the invoice generation in
> [10](10-b2b-wholesale-prd.md) §7, and the margin reporting in
> [14](14-dropship-integration-prd.md) §8.

---

## 1. Why

A merchant sells what it buys. The gap between **cost** (what the merchant paid) and **price**
(what the customer is charged) is the markup, and right now Sparx makes the merchant type that
gap in by hand for every variant. `product_variants` already stores `cost`, `price`, and
`compare_at_price` ([05](05-data-model.md) §3), but nothing connects them: change a cost and the
price doesn't move; import a vendor price list at cost and you still have to set every sell price
manually.

Two concrete, near-term needs force the markup half:

1. **Catalog pricing by rule.** A parts/distribution merchant imports a supplier or vendor price
   list (cost) and wants sell prices derived automatically — "cost + 40%", "keystone (×2)",
   "cost + $15", or a **cost-band matrix** (cheap parts marked up more, expensive parts less).
   This is the standard way parts businesses price a catalog, and it must keep working as costs
   change without re-pricing thousands of SKUs by hand.

2. **Markup on the invoice itself.** For a service/repair business — **Gillett Diesel Service**
   is the driving example — parts on a customer's repair invoice are priced by marking up cost at
   invoice time, often via a **parts matrix**, alongside labor and sublet/freight pass-throughs.
   The charged price is decided on the document, not in the catalog, and must be recorded so the
   invoice is reproducible later even after the part's cost changes.

A closely related, third need: **pass through transaction costs as surcharges** — chiefly the
**credit-card processing fee** (typically ~3%, configurable), but also handling, small-order, or
fuel surcharges. These aren't product markup (no product cost is involved); they're a
configurable fee on the document total, conditional on payment method, and carry their own legal
constraints. They share the same engine and the same "snapshot what was applied" discipline, so
they live here too — see §6.

The dropship module already proved the catalog half in a narrow slice
([14](14-dropship-integration-prd.md) §4). This doc lifts it out of dropship, makes it reusable,
and adds the invoice and surcharge halves.

---

## 2. Markup vs. margin (define this precisely — it is the #1 source of confusion)

Merchants use both words and frequently mean different things. The system must be explicit and
let the user enter **either**, always showing the other.

- **Markup %** is measured against **cost**: `price = cost × (1 + markup%)`, so `markup$ = price − cost`.
- **Margin %** is measured against **price** (the sell price): `margin% = (price − cost) / price`.
- **Multiplier (keystone)**: `price = cost × k`. `k = 2` ("keystone") is 100% markup = 50% margin.

Conversions the UI computes live:

```
margin% = markup% / (1 + markup%)
markup% = margin% / (1 − margin%)
```

| Cost  | Markup % | Multiplier | Price | Profit $ | Margin % |
| ----- | -------- | ---------- | ----- | -------- | -------- |
| 10.00 | 40%      | ×1.40      | 14.00 | 4.00     | 28.6%    |
| 10.00 | 100%     | ×2.00      | 20.00 | 10.00    | 50.0%    |
| 10.00 | 150%     | ×2.50      | 25.00 | 15.00    | 60.0%    |

> **Binding rule:** every markup input field is labeled with its basis ("% over cost" vs.
> "% margin") and shows the converted value inline. We never display a bare "40%" that could be
> read either way.

---

## 3. The markup rule

A **markup rule** is a reusable, tenant-owned entity (not a per-variant scribble) describing how
to turn a cost into a charged price.

### 3.1 Method

| Method          | Meaning                                       | Example                 |
| --------------- | --------------------------------------------- | ----------------------- |
| `percentage`    | `price = cost × (1 + value)`                  | cost + 40%              |
| `multiplier`    | `price = cost × value`                        | ×2.5                    |
| `flat`          | `price = cost + value`                        | cost + $15              |
| `margin_target` | solve for price so margin% = value            | target 45% margin       |
| `matrix`        | cost-band table; each band has its own method | parts matrix (see §3.4) |

### 3.2 Cost basis

Markup is only as honest as the cost it starts from. The rule names which cost to read:

- `variant_cost` — `product_variants.cost`, the manual/default basis ([05](05-data-model.md) §3).
- `supplier_cost` — the live dropship supplier cost ([14](14-dropship-integration-prd.md)),
  which can drift on every 4-hour sync.
- `average_cost` / `last_po_cost` — **landed/average cost from an external inventory system.**
  This depends on the cost dimension proposed in
  [28-inventory-sync-integration.md](28-inventory-sync-integration.md); until that lands, only
  the first two bases are available.

### 3.3 Rounding, floor, ceiling

- **Rounding** — `none`, `nearest` (e.g. nearest $0.05/$0.50/$1.00), or `charm` (round up to a
  fixed ending such as `.99` / `.95`). Applied after the method, before floor/ceiling.
- **Floor** — `floor_profit` (guarantee at least $N profit) and/or `floor_margin` (never below
  M% margin). If the computed price violates the floor, raise it to the floor.
- **Ceiling** — cap the result at `compare_at` / MSRP / a fixed value, so a high markup on a
  cheap part can't exceed a sane shelf price.

### 3.4 The cost-band matrix (the "parts matrix")

The matrix is the centerpiece for automotive, diesel, and distribution: cheaper parts carry a
higher markup %, expensive parts a lower one. Stored as ordered bands; the first band whose range
contains the cost wins.

```
Matrix: "Standard Parts Matrix"
  cost 0.01 –   2.00 → +200%   (×3.00)
  cost 2.01 –  10.00 → +150%
  cost 10.01 –  25.00 → +100%  (keystone)
  cost 25.01 –  50.00 →  +80%
  cost 50.01 – 100.00 →  +67%
  cost 100.01 – 250.00 →  +50%
  cost 250.01 – 500.00 →  +40%
  cost 500.01 +        →  +33%
```

### 3.5 Scope and application point

- **Scope** — what the rule applies to: `all` products, a `collection`, a `product_type`, a
  `vendor`, or an explicit `products` list. Multiple rules can exist; `priority` breaks ties,
  most specific wins.
- **`applies_to`** — `catalog` (derives the variant's list price), `document` (offered as the
  default markup on invoice/quote lines), or `both`. This is what separates the two markup
  application points described next.

---

## 4. Application point A — catalog price

When a rule with `applies_to: catalog` covers a variant, the variant's **list price is derived,
not typed**. The merchant sees the computed price (and the live margin readout) and can either
accept it or override to a manual price, which detaches that variant from the rule.

Where it surfaces:

- **Product/variant editor** — a "price by rule" toggle next to the manual price field.
- **Bulk pricing tool** — select a collection/vendor, choose a rule, **preview** before/after for
  every affected variant (dry-run), then apply.
- **Dropship import** — the existing [14](14-dropship-integration-prd.md) §4 step becomes "pick a
  markup rule" instead of a one-off markup config; the rule is the same primitive.
- **Catalog/price-list import** — apply a rule on import to set sell prices from a cost column.

### Interaction with B2B pricing and discounts (precedence)

Catalog markup produces the **list price**. It sits _before_ the B2B resolution order in
[10](10-b2b-wholesale-prd.md) §3, which then operates on that list price:

```
cost ──(markup rule)──▶ LIST PRICE ──▶ [10 §3: account override → tier override → tier % → account % ] ──▶ net price ──▶ [09 §6 discounts] ──▶ charged
```

So markup is a **cost→list** function; tiers and discounts are **list→net** functions. They do
not stack into each other — a markup rule never reads a discounted price, and a tier never marks
up a cost. This keeps margin reporting ([14](14-dropship-integration-prd.md) §8) coherent:
profit = charged − cost, regardless of how many discounts were layered on top of the list price.

---

## 5. Application point B — invoice & quote lines

On a B2B invoice or quote ([10](10-b2b-wholesale-prd.md) §6–§7), a line's price can be **derived
by markup at document time** rather than pulled from the catalog. This is the parts-on-a-repair
-invoice case and the ad-hoc/manual line case.

- A line added from the catalog defaults to its catalog price, but the user can switch it to
  "price by markup" and apply a rule (or the matrix) against the line's cost.
- A **manual line** (a part not in the catalog, a sublet charge, freight, shop materials) lets the
  user enter a cost and a markup; the matrix can price it automatically.
- The **applied markup is snapshotted onto the line** (rule, method, value, cost basis used,
  computed price, timestamp). The invoice is then reproducible forever, even after the part's
  catalog cost changes. This snapshot is mandatory — invoices are financial records.

> **Dependency / gap:** Sparx has no standalone "manual invoice" or "repair order" entity today —
> invoices are generated _from orders_ ([10](10-b2b-wholesale-prd.md) §7). The full invoice-markup
> experience (especially service/repair invoices that mix labor + marked-up parts + sublet) needs
> that surface to exist. Until then, invoice-time markup is limited to lines on order-derived
> invoices. Tracking the manual-invoice/repair-order surface is **out of scope for this doc** but
> noted as the blocker for Phase 3.

---

## 6. Surcharges & fee pass-through (credit-card fees)

Markup turns a product cost into a price. A **surcharge** is the mirror image at the _document_
level: a configurable fee added to an order or invoice to **pass through a cost the merchant
incurs on the transaction itself** — most commonly the **credit-card processing fee** (default
**3%**, configurable per tenant), but also a handling fee, a small-order fee, or a fuel/freight
surcharge.

How a surcharge differs from product markup:

- It applies to a **document total (or subtotal)**, not to a per-line product cost.
- It is usually **conditional on payment method** — a card surcharge applies to card payments but
  **not** to ACH/check/cash or B2B net-terms; debit/prepaid cards are frequently exempt too.
- It is shown as its **own line** on checkout and on the invoice ("Card processing fee — 3%"),
  never folded silently into product prices.

### 6.1 Surcharge config (per tenant)

| Field             | Meaning                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| `type`            | `percentage` or `flat`                                                        |
| `value`           | e.g. `3.0` (% ) — **configurable**, default 3% for the card-fee preset        |
| `basis`           | `subtotal` \| `subtotal_plus_shipping` \| `total` — what the % is computed on |
| `payment_methods` | which methods trigger it, e.g. `["card"]`; exclude ACH/check/net-terms        |
| `applies_to`      | `checkout` (site), `invoice` (B2B), or `both`                                 |
| `label`           | customer-facing line label                                                    |
| `cap`             | optional maximum $ amount                                                     |
| `is_active`       | per-tenant on/off; platform default is **off**                                |

A tenant can hold more than one (e.g. a 3% card fee **and** a $5 small-order handling fee), each
gated independently.

### 6.2 Compliance (do not skip)

Credit-card **surcharging is legally constrained**, and the implementation must respect it rather
than blindly add a percent:

- Several US states restrict, cap, or ban surcharges; where allowed, the surcharge generally
  **must not exceed the merchant's actual cost of acceptance** and **must be clearly disclosed
  before payment**.
- Debit and prepaid cards are commonly exempt.
- Card-network rules require advance disclosure (and, historically, registration).

This ties into the legal/consent framework in [42-legal-and-consent.md](42-legal-and-consent.md).
The platform default is **off**; a tenant opts in, picks jurisdictions/payment methods, and is
responsible for compliance, while Sparx supplies the disclosure surfaces (checkout notice,
invoice line, policy-page copy). Treat per-jurisdiction enablement and disclosure as a
**requirement, not a nicety**. (A "cash discount" framing — list the card price and discount for
cash — is the compliant alternative some merchants prefer; out of scope for v1 but noted.)

### 6.3 Precedence

A surcharge is the **last** step, after markup, tier/discount, shipping, and tax:

```
charged line prices → subtotal → discounts → shipping → tax → SURCHARGE → grand total
```

Computing the surcharge on the post-tax total (when `basis: total`) is the common case for a
card fee, since the processor's fee applies to the full captured amount. Like markup, the applied
surcharge is **snapshotted** onto the order/invoice (type, value, basis, computed amount, payment
method) for reproducibility, and is **recalculated/partially reversed on refund** in proportion to
the refunded amount.

---

## 7. Data model sketch

New tables plus snapshot columns. Follows the [05](05-data-model.md) conventions (UUID PKs,
`tenant_id`, RLS, `created_at`/`updated_at`).

```sql
CREATE TABLE markup_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  name          VARCHAR(255) NOT NULL,
  method        VARCHAR(20) NOT NULL, -- percentage | multiplier | flat | margin_target | matrix
  value         NUMERIC(12,4),        -- for non-matrix methods
  bands         JSONB DEFAULT '[]',   -- matrix: [{cost_min, cost_max, method, value}]
  cost_basis    VARCHAR(20) NOT NULL DEFAULT 'variant_cost',
                -- variant_cost | supplier_cost | average_cost | last_po_cost
  rounding      JSONB DEFAULT '{}',   -- {strategy:'charm'|'nearest'|'none', precision, ending}
  floor_profit  NUMERIC(12,2),
  floor_margin  NUMERIC(5,2),
  ceiling_src   VARCHAR(20) DEFAULT 'none', -- none | compare_at | msrp | fixed
  ceiling_value NUMERIC(12,2),
  applies_to    VARCHAR(10) NOT NULL DEFAULT 'catalog', -- catalog | document | both
  scope         JSONB DEFAULT '{"type":"all"}',
  priority      INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_markup_rules_tenant ON markup_rules(tenant_id);

CREATE TABLE surcharge_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            VARCHAR(255) NOT NULL,
  type            VARCHAR(10) NOT NULL DEFAULT 'percentage', -- percentage | flat
  value           NUMERIC(8,4) NOT NULL,            -- e.g. 3.0 for 3%
  basis           VARCHAR(25) NOT NULL DEFAULT 'total', -- subtotal | subtotal_plus_shipping | total
  payment_methods TEXT[] NOT NULL DEFAULT '{card}', -- which methods trigger it
  applies_to      VARCHAR(10) NOT NULL DEFAULT 'both', -- checkout | invoice | both
  label           VARCHAR(120) NOT NULL,            -- customer-facing line label
  cap_amount      NUMERIC(12,2),
  is_active       BOOLEAN NOT NULL DEFAULT false,   -- platform default OFF
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_surcharge_rules_tenant ON surcharge_rules(tenant_id);
```

Snapshots, for reproducibility:

- On `product_variants`: add `markup_rule_id UUID REFERENCES markup_rules(id)` (null = manually
  priced) and `applied_markup JSONB` (`{method, value, cost_basis_value, computed_price, computed_at}`).
- On order/invoice/quote **lines**: add `cost NUMERIC(12,2)` and `applied_markup JSONB` (the
  snapshot). Order lines are referenced in the [05](05-data-model.md) entity map but not yet given
  a full schema — that schema should include these when it is written.
- On `orders` (and the future invoice entity): add `surcharge_total NUMERIC(12,2) DEFAULT 0` next
  to the existing `subtotal`/`tax_total`/`shipping_total`/`discount_total`/`total`
  ([05](05-data-model.md) §3), plus `applied_surcharges JSONB` snapshotting each fee applied.

---

## 8. Cost-change recompute (events)

Catalog markup is dynamic: when a cost moves, derived prices should follow. Per the platform's
event-driven rule (CLAUDE.md), this is **not** inlined into the write path.

- A cost change (`variant.cost.updated`, a dropship sync, or an inventory-sync cost update from
  [28](28-inventory-sync-integration.md)) publishes to a topic.
- A **markup recompute worker** consumes it, finds variants bound to a rule whose basis changed,
  recomputes the list price, and writes it back — emitting `price.recomputed`.
- Open decision: whether live price bumps are **automatic** or **staged for review** (a cost
  spike silently raising shelf prices is dangerous). Likely a per-rule toggle: auto-apply within a
  tolerance band, queue for approval beyond it. See §11.

Surcharges are computed at checkout/invoice time from the active `surcharge_rules`, not on a
schedule, so they need no recompute worker.

---

## 9. API & MCP

**API-first** (CLAUDE.md): the rule engines are API before UI.

- `GET/POST/PATCH/DELETE /v1/markup-rules` — markup rule CRUD.
- `POST /v1/markup-rules/{id}/preview` — dry-run: returns before/after price + margin for the
  scoped variants, no writes.
- `POST /v1/markup-rules/{id}/apply` — bind + recompute the scoped variants.
- `GET/POST/PATCH/DELETE /v1/surcharge-rules` — surcharge config CRUD.
- Markup/surcharge fields surfaced on invoice/quote/order endpoints
  ([06-api-specification.md](06-api-specification.md)).

**MCP** ([07-mcp-server-spec.md](07-mcp-server-spec.md)) — natural-language pricing is a strong
fit:

> "Mark up all Bosch parts by 35%."
> "Apply the standard parts matrix to the Turbochargers collection and show me what changes."
> "What's my margin on SKU INJ-6.7 after markup?"
> "Turn on a 3% credit-card surcharge for card payments only."

---

## 10. Reporting

Markup feeds the existing margin/profitability reporting
([14](14-dropship-integration-prd.md) §8) for **all** products, not just dropship: cost (from the
basis), charged price, gross margin ($/%), and — because the markup is snapshotted on the line —
realized margin per order/invoice even after catalog costs drift. Surcharges are reported
separately as pass-through income (and netted against actual processor fees), not counted as
product margin.

---

## 11. Open questions / out of scope

- **Auto-apply vs. staged review** of cost-driven price changes (§8) — tolerance band, approval
  queue, notification on bump.
- **Surcharge compliance automation** — per-state enablement, the "actual cost of acceptance"
  cap, and disclosure copy (§6.2); plus the "cash discount" alternative framing.
- **Landed cost** (freight, duty, handling rolled into the cost basis) — depends on the cost model
  in [28](28-inventory-sync-integration.md); markup is only as good as the basis.
- **Manual invoice / repair-order surface** — the prerequisite for the full §5 experience
  (labor + marked-up parts + sublet on one document). Not designed yet; blocks Phase 3.
- **Tax interaction** — markup is strictly pre-tax; tax ([09](09-ecommerce-engine-prd.md) §4)
  applies to the charged price after markup, and a card surcharge is typically computed on the
  post-tax total. Confirm no double-application on B2B tax-exempt lines.
- **Per-customer / per-account markup overrides** — likely belongs in the B2B tier model
  ([10](10-b2b-wholesale-prd.md) §3) as a list→net step, not a second cost→list markup. Decide
  whether a B2B account can carry its own matrix.
- **Multi-currency markup/surcharge** — cost and price in different currencies; out of scope for v1.

---

## 12. Phasing

| Phase | Scope                                                                                                                                                                                                            | Depends on                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1     | Catalog markup rule: `percentage`/`multiplier`/`flat`/`margin_target` + rounding + floor/ceiling; bind on variant; preview/apply. Generalize dropship §4 onto it.                                                | `product_variants.cost`                                                       |
| 2     | Cost-band **matrix**; bulk pricing tool; price-list/catalog import with a rule.                                                                                                                                  | Phase 1                                                                       |
| S     | **Surcharges** (credit-card fee pass-through) — config, payment-method gating, checkout + invoice line, refund proration, disclosure surfaces. _Independent of the markup phases; can ship alongside Phase 1–2._ | [42](42-legal-and-consent.md) for disclosure                                  |
| 3     | Invoice/quote-line markup + matrix on document lines; line-level snapshot.                                                                                                                                       | Manual-invoice/repair-order surface (§11)                                     |
| 4     | Cost-driven auto-recompute worker + staged-review toggle; MCP pricing tools.                                                                                                                                     | Event topics; [28](28-inventory-sync-integration.md) for `average_cost` basis |
