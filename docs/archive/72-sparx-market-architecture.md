# sparx Platform — sparx.market Marketplace Architecture

**Version:** 1.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-26

> **BUILT 2026-06-26 (P5).** sparx.market shipped as the channel framework's first-party channel —
> see [docs/106 §4.7](../106-channel-marketplace-strategy.md) for the canonical as-built shape. Two
> deltas from this original design: (1) the opt-in columns are `market_listed` / `market_category` (not
> `public_listing`); (2) **commission is a flat platform rate in basis points with a per-tenant override,
> NOT the plan-tiered table in §4 below** — the platform has modules, not subscription tiers. The
> Phase-1 checklist in §10 is built; the Phase-2 "Growth" items (multi-merchant cart, reviews, featured
> program, search ads, mobile app, affiliate) remain the documented next phase.

---

## 1. Overview

sparx.market is the universal public marketplace for all sparx merchants. Merchants opt individual products into the public graph. Shoppers browse and purchase from any sparx merchant in one place. sparx processes all payments and settles with merchants via ACH — merchants never need Stripe Connect to participate.

**Domain:** sparx.market  
**Category subpaths:** sparx.market/auto, /beauty, /home, /fashion, /food, /tech  
**sparx commission:** 1–2% tiered by plan  
**Merchant of record:** sparx (for marketplace transactions)

---

## 2. The Product Graph

Every sparx merchant can mark individual products as public. Public products enter the sparx product graph — the single data layer that powers sparx.market, all category subpaths, and future discovery surfaces.

```sql
ALTER TABLE products ADD COLUMN public_listing  BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN market_category VARCHAR(50);
-- auto | beauty | home | fashion | food | tech | general
ALTER TABLE products ADD COLUMN market_featured  BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN market_approved  BOOLEAN DEFAULT true;
-- sparx can delist products that violate policies
```

Merchant workflow:

```
Products list → select product → toggle "List on sparx.market"
  → Choose category (auto-suggested based on product type)
  → Product appears on sparx.market within minutes
  → Merchant's store link shown on product page
```

---

## 3. sparx.market Site Structure

```
sparx.market
  /                     → Hero + featured products + category navigation
  /[category]           → /auto /beauty /home /fashion /food /tech
  /products             → All public products, search + filter
  /products/[slug]      → Product detail page
  /merchants            → Directory of all sparx merchants
  /merchants/[slug]     → Merchant profile → links to their sparx.zone site
  /cart                 → Unified cart (Phase 1: single merchant per cart)
  /checkout             → Stripe-powered checkout
  /orders/[id]          → Order status page (no login required, UUID URL)
  /search               → Typesense-powered full search across all public products
```

### Category Pages

Each category path is a real, indexed, content-rich landing page:

```
sparx.market/auto
  /                     → Automotive category landing
                          Featured auto products
                          "Browse 4,200 auto parts from 180 merchants"
                          Top merchants in this category
                          "Are you an auto parts merchant? Join sparx →"
  /products             → All auto products, faceted search
  /merchants            → Auto merchants on sparx
  /[subcategory]        → sparx.market/auto/diesel, /auto/parts, etc.
```

Category pages build SEO authority independently. Even with zero products, a category page has indexable content, internal linking, and a merchant acquisition CTA. Categories launch when content is ready — not when product count reaches a threshold.

---

## 4. Payment Model — sparx as Merchant of Record

sparx processes ALL sparx.market payments through sparx's own Stripe account. Merchants receive ACH settlements — they never need Stripe Connect to sell on sparx.market.

```
Shopper checks out on sparx.market
  → sparx's Stripe account charges full amount
  → Order created in sparx DB
  → Pub/Sub: market.order.created

sparx settles with merchant weekly (every Monday):
  → Calculate: product sales - sparx commission - any chargebacks
  → ACH transfer to merchant's bank account
  → Settlement report emailed to merchant
  → Settlement record in merchant's sparx dashboard
```

This model:

- Works for any merchant regardless of payment processor
- Gillett Diesel gets an ACH transfer, doesn't need Stripe
- sparx handles all payment complexity
- Merchant just sells and gets paid

### Commission Structure (tiered by plan)

| Plan            | sparx.market commission |
| --------------- | ----------------------- |
| Spark ($10)     | 3%                      |
| Starter ($79)   | 2.5%                    |
| Growth ($149)   | 2%                      |
| Pro ($299)      | 1.5%                    |
| Business ($449) | 1%                      |
| Enterprise      | Negotiated              |

Commission is deducted from settlement, never charged separately. Merchant sees gross sale → commission deducted → net payout in their settlement report.

---

## 5. Multi-Merchant Cart (Phased)

### Phase 1 — Single Merchant Per Cart

When shopper adds a second merchant's product:

```
"Your cart contains items from Gillett Diesel.
 Add this item and check out separately, or start a new cart."
```

Simple to build. Ships with the initial marketplace launch.

### Phase 2 — Unified Cart, Split Fulfillment

One Stripe checkout. One receipt. Multiple merchants fulfill independently. Shopper gets separate shipments but pays once. Stripe PaymentIntents with split transfers. Builds when Phase 1 is stable and multi-merchant use is proven.

---

## 6. Product Detail Page

```
sparx.market/products/bosch-6-7l-injector-set

[Product images]

Bosch 6.7L Power Stroke Injector Set (8-pack)
★★★★½  (24 reviews)

$1,289.00

Sold by:  [Gillett Diesel logo]  Gillett Diesel Service
          ★★★★★  (180 merchant reviews)
          Bluffdale, Utah · Ships within 2 business days
          [Visit their store →]  gillettdiesel.sparx.zone

Fits: 2017–2022 Ford F-250/F-350 6.7L Power Stroke

[Add to Cart]   [Chat with Gillett Diesel]  ← Chat module integration

Product details, specifications, fitment guide...

---

More from Gillett Diesel          More diesel injectors
[product grid]                    [product grid]
```

---

## 7. Merchant Profile on sparx.market

Every sparx merchant gets a public profile page:

```
sparx.market/merchants/gillett-diesel

[Merchant banner + logo]
Gillett Diesel Service
Bluffdale, Utah · Member since 2026
★★★★★ 4.9 · 180 reviews

Industrial-grade diesel parts and service supplies.
Specializing in 6.7L Power Stroke components.

[Visit their store →]  gillettdiesel.sparx.zone
[Chat with Gillett Diesel →]

Products (47)          [product grid]
```

Merchant profile is auto-generated from their sparx account data. They can customize banner, bio, and featured products from their dashboard.

---

## 8. SEO Strategy

sparx.market and category subpaths build SEO authority independently from sparx.works. The interlinking network:

```
sparx.works ←→ sparx.market (mutual links)
sparx.market/auto ←→ sparx.works/modules/b2b (thematic links)
sparx.market/merchants/[slug] ←→ [slug].sparx.zone (merchant ↔ marketplace)
```

Each category page targets category-specific keywords:

- sparx.market/auto → "buy auto parts online," "auto parts marketplace"
- sparx.market/beauty → "independent beauty brands," "small business beauty"

Product pages target long-tail product keywords that individual merchant sites can't compete on alone — but the aggregate marketplace can.

---

## 9. Analytics — Market Revenue

Market revenue surfaces alongside other channels in the sparx analytics dashboard:

```
Revenue by channel · Last 30 days
Site          $48,200
sparx.market         $8,100  ← marketplace sales
TikTok Shop         $12,800
B2B Portal          $18,400
```

Merchant dashboard shows:

- sparx.market GMV (their products sold through marketplace)
- Commission deducted
- Net payout from marketplace
- Top products on sparx.market
- Shopper acquisition: "12 new customers from sparx.market this month"

---

## 10. Implementation Checklist

### Phase 1 — Core Marketplace

- [ ] `public_listing`, `market_category` columns on products
- [ ] Product opt-in UI in merchant dashboard
- [ ] sparx.market Next.js app (sparx/apps/market in monorepo)
- [ ] Homepage with featured products + category nav
- [ ] Category landing pages (/auto, /beauty, /home, /fashion, /food, /tech)
- [ ] Product listing page with Typesense search + faceted filters
- [ ] Product detail page with merchant attribution
- [ ] Merchant profile pages
- [ ] Single-merchant cart + checkout (sparx Stripe account)
- [ ] Order confirmation page + email
- [ ] sparx → merchant settlement worker (weekly ACH)
- [ ] Settlement report email via Postal
- [ ] Settlement dashboard in merchant analytics
- [ ] Commission calculation by plan tier
- [ ] Chat integration on product pages

### Phase 2 — Growth

- [ ] Multi-merchant cart + unified checkout
- [ ] Merchant reviews and ratings
- [ ] Featured merchant program
- [ ] sparx.market search ads (merchants can pay for placement)
- [ ] Category-specific SEO content (blog posts, guides)
- [ ] Mobile app (React Native — browse + purchase)
- [ ] Affiliate/referral program (share product link, earn %)
      EOF
