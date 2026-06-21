# sparx Platform — Pricing Model Spec

**Version:** 2.2
**Author:** Brandon Korous
**Last Updated:** 2026-06-17

---

## 1. Core Philosophy

**Open access. Physical limits only. 14 days free, then pay per module.**

sparx does not gate features behind plan tiers. Every tenant has access to every capability of their activated modules — unlimited products, unlimited posts, unlimited customers, unlimited orders, unlimited automations, unlimited team members.

The only metered resources are physical:

- **Storage** (files, images, videos)
- **Email send volume** (Postal infrastructure has real cost at scale)

This philosophy eliminates the resentment that feature gating creates. Tenants never hit an artificial wall. They understand and accept physical limits intuitively.

---

## 2. The 14-Day Free Trial

```
14 days free. Full access. No card to start.
```

Every tenant starts on a 14-day free trial with full access to every module — build the whole site, add products, draft content, design email templates, all of it. No credit card to start.

**How the trial works:**
At signup the tenant picks the modules it wants, and a Stripe subscription is created **trialing** — one line item per active module, no payment method. The public site can go live during the trial.

**The payment moment:**
A card is captured **after** onboarding (via a dashboard trial banner) and is required only to continue past day 14 — this protects the "no card to start" promise and the 5-minute path. Billing begins when the trial ends.

**End of trial — trial → grace → suspend:**
The authoritative lifecycle lives in [17-billing-subscriptions.md](17-billing-subscriptions.md) §6. No card by day 14 → paid module features pause, but the **public site stays live** through the grace window. Tenant data is preserved for 30 days.

---

## 3. Module Pricing

### The Spark plan (Builder only) — $10/mo

The entry point: a real, hosted website on sparx.

Includes:

- One live site on a sparx.zone subdomain or your own custom domain
- Full theme customizer
- Unlimited pages
- Custom domain + SSL, hosting + CDN
- Generous fair-use storage (see [17-billing-subscriptions.md](17-billing-subscriptions.md) §3)

Builder is the website itself. Commerce (selling), CMS (blog and content), Email, and CRM each come from their own module — switch one on when you need it, and nothing is rebuilt. Builder is also optional: a headless tenant can run those modules off the API/MCP with no Builder at all (see [34-platform-glossary.md](34-platform-glossary.md)).

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
| Scheduling      | +$29/mo | Standalone            |

---

## 4. The Toggle Pricing UI

The pricing page uses a toggle calculator instead of plan cards. Each module is a row with a toggle. The right panel shows the live bill as modules are activated.

```
Switch on what you use.

Builder          Site host · $10 [●──]  ← on; optional — no Builder = headless
Commerce              + $49    [○──]
CMS                   + $49    [●──]  ← on
CRM                   + $49    [○──]
Email                 + $29    [○──]
B2B · Fleet           + $99    [○──]
AI · MCP              + $49    [○──]
Dropship              + $29    [○──]
Chat                  + $19    [○──]
Scheduling            + $29    [○──]

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

Storage upgrades stack — a tenant can add multiple tiers.

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

Opt-in image compression at upload. Reduces file sizes 60–70% with no visible quality loss. Free. Enabled by default for new tenants, opt-in for existing.

---

## 6. Email Send Volume

### Included (all plans with Email module)

**10,000 sends/mo** — covers most SMB tenants.

### Additional sends

$1 per 1,000 additional sends. Auto-charged. Always visible in dashboard.

```
Email sends this month
██████░░░░  6,200 of 10,000 used

On track for ~8,400 this month.
Included in your plan.
```

Tenants approaching or exceeding 10,000/mo are notified with their projected overage cost before it happens — never surprised on billing day.

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
**Failed payment:** 3-day grace period → store enters read-only mode → 7 more days → store paused (not deleted). Tenant can reactivate by updating payment method at any time.  
**Cancellation:** Tenant can cancel at any time. Data export available immediately. Store remains accessible for remainder of paid period.

---

## 10. The Honest Pricing Page Principles

**Flat per module.** The price shown is the price charged. No hidden fees, no "plus applicable taxes" surprises beyond actual tax.

**Off-coupon.** Coupons exist but the page price is the real price. No artificial "original price" strikethrough.

**One invoice.** One Stripe charge, one receipt, one line item per module. No surprise charges.

**No asterisks.** If something has a condition, it's explained inline — not buried in fine print.
EOF
