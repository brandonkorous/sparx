# WizeWorks Platform — E-Commerce Engine PRD

**Version:** 1.3  
**Author:** Brandon Korous  
**Last Updated:** 2026-10-01

---

## 1. Overview

The e-commerce engine is the transactional core of WizeWorks. It handles everything from product catalog to checkout to fulfillment. It is designed to serve both direct-to-consumer (D2C) retail and B2B wholesale from the same codebase, with B2B-specific behavior toggled per tenant and per customer account.

---

## 2. Product Catalog

### Product Model

Every product has:

- **Title, slug, description** (rich text)
- **Status:** draft | active | archived
- **Type & vendor** (for filtering and organization)
- **Tags** (freeform, multi-value)
- **SEO fields:** title, description, OG image
- **One or more variants**

### Variants

Every purchasable item is a variant. A product with no options (e.g. a single-size item) still has one variant. Variant fields:

- SKU (optional but recommended)
- Price, compare-at price, cost (for margin tracking)
- Weight (for shipping calculation)
- Inventory quantity + policy (deny/continue when out of stock)
- Option values (e.g. `{ color: "red", size: "XL" }`)
- Dropship source link (optional)

### Options System

Products define option names (e.g. `["Color", "Size"]`). Variants define option values for each dimension. The UI generates a variant matrix from option combinations.

### Images

- Multiple images per product, ordered
- Primary image used for thumbnails
- Stored in GCS, served via Cloudflare CDN
- Automatic WebP conversion + responsive srcset generation
- Max 20 images per product, max 10MB per image

### Inventory

- Per-variant inventory count
- Inventory policy: `deny` (can't buy when 0) or `continue` (allow backorders)
- Low inventory threshold configurable per product
- Inventory alerts published to `inventory.low` Pub/Sub topic
- Bulk inventory adjustment via CSV or API

### Collections

- Manual collections (merchant curates product list)
- Automated collections (rules-based: all products tagged "diesel", all products from vendor "Bosch", all products under $50)
- Collections nested (parent/child) for navigation hierarchy
- SEO fields per collection

---

## 3. Cart

### Cart Lifecycle

```
Created → Items Added → Discounts Applied → Checkout Started → Completed / Abandoned
```

### Cart Features

- Persistent carts (stored in DB, cookie-linked for guests)
- Guest carts merged with customer cart on login
- Abandoned cart threshold configurable (default: 2 hours of inactivity)
- Cart abandonment triggers `cart.abandoned` Pub/Sub event → email automation

### Cart Validation

On every cart modification and at checkout start:

- Inventory availability re-checked
- Prices re-fetched (no stale prices)
- B2B pricing applied if customer is B2B account member
- Discounts re-validated (expiry, usage limits)

---

## 4. Checkout

### Standard Checkout Flow

```
Cart Review → Customer Info → Shipping → Payment → Confirmation
```

### Guest vs. Authenticated

- Guests provide email at checkout (account created or matched)
- Authenticated customers: address pre-populated, payment methods saved

### Address Handling

- Address validation via Google Maps / Smarty Streets API
- International addresses supported
- B2B accounts have default shipping addresses per account

### Shipping

- Flat rate rules (per order, per item, by weight, by price threshold)
- Free shipping threshold
- Carrier-calculated rates (FedEx, UPS, USPS) via EasyPost integration
- Local pickup option
- Dropship products: shipping calculated separately per supplier

### Tax

- Automatic tax calculation via TaxJar or Avalara
- Tax exempt status per customer (B2B accounts)
- Nexus configuration per merchant
- Tax included in price toggle (for international merchants)

### Payment Processing

- **Stripe** as primary processor
- Supported methods: card, Apple Pay, Google Pay, Link (Stripe's one-click checkout)
- 3D Secure handled automatically
- Payment intent created at checkout start, confirmed on submit
- Strong Customer Authentication (SCA) compliant
- Test mode for staging environment

### B2B Checkout Variations

- Net terms option (if customer's B2B account has terms set)
- Purchase order number field
- Approval workflow (order placed as "pending approval" if above threshold)
- Invoice generation instead of immediate payment

### Order Confirmation

- Confirmation page shown immediately
- Order confirmation email fired via email worker
- Order created event published to Pub/Sub
- Inventory decremented atomically

---

## 5. Orders

### Order States

```
pending → confirmed → processing → fulfilled → delivered
                   ↘ cancelled
                   ↘ refunded (partial or full)
```

### Financial States

```
pending → paid → partially_refunded → refunded
       → invoiced → overdue (B2B)
```

### Fulfillment

- Orders can have multiple fulfillments (partial shipment)
- Each fulfillment has: items, carrier, tracking number, tracking URL
- **One shipping rule for every way out** (`crm-schemas/src/ship-gate.ts`): an order
  that is cancelled, refunded or still waiting for B2B approval cannot ship, and a
  line bought by sending the old part first ships one unit per old part that has
  arrived. `createFulfillment` enforces it, so the pick list, the box, the pack scan,
  pack-and-ship, a handover and a label purchase all do; the warehouse refuses early
  in the same words (persona issues 057, 058).
- Tracking number entry triggers `order.fulfilled` event → shipping email
- Dropship fulfillments created automatically when supplier ships

### Refunds

- Full or partial refunds
- Refund back to original payment method via Stripe
- Inventory restocked on refund (configurable)
- Refund reason recorded for reporting

### Order Notes & Tags

- Internal notes (staff only)
- Customer-visible notes
- Tags for filtering and automation triggers

### Order Timeline

Every order has a chronological timeline:

- Order placed
- Payment received
- Note added
- Fulfillment created
- Tracking updated
- Refund issued
- Status changes

### Core charges (rebuilt parts)

A core charge is a refundable deposit on a remanufactured part. The buyer pays it
on top of the price and gets it back when the old part (the "core") comes back
fit to rebuild. Added 2026-10-01 for persona P01 (sparx persona issue 051).

- **Where it is set.** Per variant (`ProductVariant.coreChargeCents`). Editable on
  the variant, through MCP (`update_variant`), and by the import's **Core charge**
  column.
- **Or the old part comes first.** A part with a deposit may also offer
  `coreFirstOffered`: the buyer sends the old part FIRST, pays no deposit, and the
  part ships when it arrives. The shopper picks on the product page ("Pay the
  deposit now" or "Send your old part first"), and can switch in the basket. The
  line carries `coreFirst` instead of a deposit (cart, checkout, order; a check
  forbids both). The order, the receipt email and the account page say where to
  send the old part (Business details address). Recording the old part's arrival
  releases one unit to ship; "Ship without waiting" (`release_core_hold`, with a
  reason) releases the line while the old part stays owed. Refused on a part the
  supplier ships, since the old part cannot come here first. Added for persona
  issue 057.
- **Where it rides.** On the part's OWN line at every stage: cart line
  (snapshot like the price), order line (`OrderItem.coreCharge`), invoice line
  (`BillingDocumentLine.coreCharge`). Never a separate item, so picking, stock,
  top-product and sales figures never count a deposit as something sold.
- **The money rules.** Never discounted, never taxed, never surcharged, never in
  a subtotal. Always in the total and in what the card is charged. A gift card or
  account credit may pay it. Every document that adds up (cart, checkout, order,
  receipt email, invoice, invoice email, printed invoice) names it as its own row:
  "Refundable core deposits".
- **The product page says it before the button.** One deposit across every
  version reads as one sentence; versions that differ name their own deposit in
  the version picker. Pages saved before this get the notice from the page
  repair on next edit (`upgrade-page.ts`, `coreDeposit.shown`).
- **How each core ends.** Every unit ends one of three ways: the part itself came
  back (a return: its deposit goes back with it automatically), the old part came
  back (`coresReturned`, deposit refunded), or the business kept the deposit
  (`coresKept`, with a reason). The rest is a core still owed.
- **Getting the money back.** "Core came back" on the order line. An invoice
  still open on the order takes the deposit off what is owed first (a fleet on
  Net 30 is never handed back money it has not paid). Anything already paid goes
  back to the card it came from (through the gateway, or recorded for the shop to
  hand back when it was cash or a cheque), or onto the customer's account credit.
- **Cores owed.** A workbench list (After the sale > Cores owed), filterable by
  age, and the MCP tools `list_cores_owed`, `receive_cores` and
  `keep_core_deposits`. REST: `GET /v1/commerce/cores`,
  `POST /v1/commerce/order-items/:id/cores/received` and `…/cores/kept`.
- **Revenue.** A deposit whose core is still out is the customer's money, so the
  revenue summary and job profit leave it out; one paid back is a refund, one
  kept is revenue.
- **The shopper.** The cart, checkout and receipt say what the deposit is; the
  account's order page says how many old parts are still to send back and where.
- **A core charge another store faked as a choice.** A store with no deposit sells
  a rebuilt part as two versions: "Accept Core Charge (+$150)" (dearer, ship now)
  and "Defer Core Charge" or "Ship when core received" (the part alone, old part
  first). That is one part on one shelf sold as two, with its stock split. "Core
  charges set up as choices" (workbench; REST `GET /v1/commerce/core-choices`,
  `POST …/core-choices/convert`; MCP `list_core_choices`, `convert_core_choices`)
  lists every such product and turns each, after the owner reviews it, into one
  version: the plain code stays at the part price with the deposit its WORDS name
  (never the price difference, which on Gillett Diesel's 84 matched almost none),
  the other side stops being sold, its photos move over, open baskets move onto the
  one that stays, and "send the old part first" stays on offer. A product with
  stock on the side that would go is refused until it is counted onto the other.
  Move in imports these as they are and points to the screen; bringing the same
  file in again leaves a converted product's choice and prices alone.

---

## 6. Discounts & Promotions

### Discount Types

- **Percentage off** — 10% off entire order or specific products/collections
- **Fixed amount** — $15 off orders over $100
- **Free shipping** — Waive shipping cost
- **Buy X get Y** — Buy 3 get 1 free

### Application Methods

- **Discount code** — Customer enters code at checkout
- **Automatic discount** — Applied based on rules (no code needed)

### Rules & Limits

- Minimum order value
- Minimum quantity
- Specific products or collections only
- Customer-specific (one-time use per customer)
- Start/end date
- Total usage limit
- One per customer limit

### B2B Pricing (Not Discounts)

B2B account-specific pricing is handled separately via pricing tiers, not as discounts. See B2B & Wholesale PRD.

---

## 7. Site

### Pages

- **Home** — Configurable sections (hero, featured products, collections, etc.)
- **Product** — Gallery, title, description, variants, add-to-cart, related products
- **Collection** — Product grid with filtering and sorting
- **Cart** — Item list, totals, discount code, checkout CTA
- **Checkout** — Multi-step form
- **Account** — Order history, address book, profile
- **CMS Pages** — Blog posts, landing pages, legal pages

### Search

- Full-text product search powered by Elasticsearch
- Autocomplete suggestions
- Filters: price range, vendor, tag, availability
- Sort: relevance, price, date, title, best selling

### Performance Targets

- Site page load (p95): < 200ms TTFB via SSR + CDN caching
- Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- Product images lazy-loaded, WebP served, responsive srcset

---

## 8. Analytics & Reporting

### Built-In Reports

- Revenue by period (day/week/month/year)
- Orders by status
- Top products by revenue and units
- Top customers by spend
- Conversion funnel (sessions → add-to-cart → checkout → purchase)
- Abandoned cart recovery rate
- Average order value trend
- Inventory valuation

### Data Export

- All reports exportable as CSV
- Order export with all fields
- Customer export with GDPR-compliant field selection
