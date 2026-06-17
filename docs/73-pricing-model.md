# sparx Platform — Pricing Model Spec

**Version:** 2.0
**Author:** Brandon Korous
**Last Updated:** 2026-05-31

---

## 1. Core Philosophy

**Open access. Physical limits only. Free to build, pay to publish.**

sparx does not gate features behind plan tiers. Every merchant has access to every capability of their activated modules — unlimited products, unlimited posts, unlimited customers, unlimited orders, unlimited automations, unlimited team members.

The only metered resources are physical:

- **Storage** (files, images, videos)
- **Email send volume** (Postal infrastructure has real cost at scale)

This philosophy eliminates the resentment that feature gating creates. Merchants never hit an artificial wall. They understand and accept physical limits intuitively.

---

## 2. The Free-to-Build Model

```
Build free. No card. No clock. Pay when you go live.
```

Every merchant can build their entire store — products, content, email templates, theme, everything — before paying a cent. No time limit. No 14-day countdown.

**What "going live" means:**
Publishing their site to their sparx.zone URL or a custom domain. Everything before that — building, designing, adding products, drafting content — is free with no time limit.

**The payment moment:**
When a merchant clicks "Publish" or "Go Live," they're prompted to add a payment method. The billing cycle starts the day they publish. Nothing before that.

**Inactive store archival:**

- 90 days inactive (no login, no publish) → email: "Your store is still waiting"
- 180 days inactive, no engagement → store archived (content preserved, URL released)
- Merchant can restore at any time by logging in

---

## 3. Module Pricing

### The Spark Plan (Builder only)

**$10/mo** — activates on publish

Includes:

- One live site on sparx.zone subdomain
- Full theme customizer
- Unlimited pages (published via CMS)
- Custom domain + SSL
- 5GB storage
- Full product catalog builder (products visible but not purchasable)
- Content editor (posts draftable but not indexed)
- Email template designer (templates buildable but not sendable)
- Everything ready to activate — upgrade any module to go live

The Spark plan is the entry point of a journey, not a stripped product. Products, content, and email templates built on Spark are instantly live when the relevant module is activated — no rebuilding.

### Module Pricing (additive)

| Module          | Price   | Requires              |
| --------------- | ------- | --------------------- |
| Builder (Spark) | $10/mo  | —                     |
| Commerce        | +$49/mo | Builder               |
| CMS             | $49/mo  | Standalone OR Builder |
| CRM             | +$49/mo | Any active module     |
| Email           | +$29/mo | Any active module     |
| B2B / Fleet     | +$99/mo | Commerce              |
| AI / MCP        | +$49/mo | Any active module     |
| Dropship        | +$29/mo | Commerce              |
| Chat            | +$19/mo | Any active module     |

### Bundles (for pricing page display)

Bundles are pre-configured toggle states — not separate products. The toggle calculator shows bundle savings when relevant combinations are active.

| Bundle   | Modules                                                | Price   | vs. separate |
| -------- | ------------------------------------------------------ | ------- | ------------ |
| Starter  | Builder + Commerce                                     | $59/mo  | saves $0     |
| Content  | Builder + CMS                                          | $59/mo  | saves $0     |
| Growth   | Builder + Commerce + CRM + Email                       | $147/mo | saves $0     |
| Pro      | Builder + Commerce + CMS + CRM + Email + AI + Dropship | $274/mo | saves $29    |
| Business | All modules                                            | $373/mo | saves $29    |

Note: bundles save less than expected because individual module pricing is already fair. The real savings story is vs. competitive stack (see Section 6).

---

## 4. The Toggle Pricing UI

The pricing page uses a toggle calculator instead of plan cards. Each module is a row with a toggle. The right panel shows the live bill as modules are activated.

```
Switch on what you use.

Builder          Base · $10    [●──]  ← always on, can't toggle off
Commerce              + $49    [○──]
CMS                   + $49    [●──]  ← on
CRM                   + $49    [○──]
Email                 + $29    [○──]
B2B · Fleet           + $99    [○──]
AI · MCP              + $49    [○──]
Dropship              + $29    [○──]
Chat                  + $19    [○──]

                              ┌──────────────────┐
                              │ Your plan  2 on  │
                              │                  │
                              │ $59        /mo   │
                              │                  │
                              │ Builder      $10 │
                              │ CMS          $49 │
                              │                  │
                              │ Same elsewhere:  │
                              │ $69/mo           │
                              │ ✓ You save $10   │
                              │                  │
                              │ [Launch — $59/mo]│
                              │ no card to start │
                              └──────────────────┘
```

The "Same elsewhere" comparison updates dynamically:

| Module   | Real-world equivalent | Comparison price  |
| -------- | --------------------- | ----------------- |
| Builder  | Webflow Starter       | $23/mo            |
| Commerce | Shopify Basic         | $39/mo            |
| CMS      | WordPress + hosting   | $30/mo            |
| CRM      | HubSpot Starter       | $50/mo            |
| Email    | Mailchimp Standard    | $100/mo           |
| B2B      | Shopify B2B add-on    | $200/mo           |
| AI/MCP   | No equivalent         | "Unique to sparx" |
| Dropship | DSers Pro             | $20/mo            |
| Chat     | Intercom Starter      | $74/mo            |

---

## 5. Storage Metering

### Included Storage (all plans)

**5GB included** — covers ~5,000 product images at typical sizes, or ~50 short product videos, or ~500,000 text pages.

### Storage Upgrades

| Tier | Additional storage | Price   |
| ---- | ------------------ | ------- |
| S    | +10GB              | $5/mo   |
| M    | +50GB              | $20/mo  |
| L    | +200GB             | $60/mo  |
| XL   | +1TB               | $200/mo |

Storage upgrades stack — a merchant can add multiple tiers.

### Storage Dashboard UI

Visible in Settings → Storage. Only surfaced prominently when within 20% of limit:

```
Storage
████████░░  4.2GB of 5GB used  (84%)

Free options:
  ✓ Enable auto-compression    saves ~1.8GB, no quality loss  [Enable]
  ✓ Delete unused media        review unused files            [Review]

Need more space?
  +10GB for $5/mo                                             [Upgrade]
```

Lead with free options before paid. Never show a red warning — calm, informative UI only.

### Auto-Compression

Opt-in image compression at upload. Reduces file sizes 60–70% with no visible quality loss. Free. Enabled by default for new merchants, opt-in for existing.

---

## 6. Email Send Volume

### Included (all plans with Email module)

**10,000 sends/mo** — covers most SMB merchants.

### Additional sends

$1 per 1,000 additional sends. Auto-charged. Always visible in dashboard.

```
Email sends this month
██████░░░░  6,200 of 10,000 used

On track for ~8,400 this month.
Included in your plan.
```

Merchants approaching or exceeding 10,000/mo are notified with their projected overage cost before it happens — never surprised on billing day.

---

## 7. Transaction Fees

| Plan value    | Transaction fee |
| ------------- | --------------- |
| Spark ($10)   | 1%              |
| Up to $100/mo | 0.5%            |
| Up to $200/mo | 0.25%           |
| $299/mo+      | 0%              |

Transaction fees only apply to sparx-processed payments (Commerce module checkout). B2B orders with manual payment (invoices, wire transfers) are not subject to transaction fees.

sparx.market has a separate commission structure (see 62-sparx-market-architecture.md).

---

## 8. Enterprise Pricing

Custom pricing for:

- 10+ locations / brands under one account
- $10K+/mo GMV requirements
- SLA commitments (99.9% uptime)
- Dedicated infrastructure (managed hosting)
- Custom integrations and migrations
- Dedicated account manager

Managed hosting add-on: $750/mo (GDS is first client at this tier).

---

## 9. Billing Mechanics

**Billing cycle:** Monthly, on the anniversary of publish date.  
**Proration:** Modules activated mid-cycle are prorated to the cent.  
**Downgrade:** Module deactivated → billing stops next cycle. Data preserved indefinitely.  
**Failed payment:** 3-day grace period → store enters read-only mode → 7 more days → store paused (not deleted). Merchant can reactivate by updating payment method at any time.  
**Cancellation:** Merchant can cancel at any time. Data export available immediately. Store remains accessible for remainder of paid period.

---

## 10. The Honest Pricing Page Principles

**Flat per module.** The price shown is the price charged. No hidden fees, no "plus applicable taxes" surprises beyond actual tax.

**Off-coupon.** Coupons exist but the page price is the real price. No artificial "original price" strikethrough.

**One invoice.** One Stripe charge, one receipt, one line item per module. No surprise charges.

**No asterisks.** If something has a condition, it's explained inline — not buried in fine print.
EOF
