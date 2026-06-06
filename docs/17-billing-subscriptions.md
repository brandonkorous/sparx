# Sparx Platform — Billing & Subscriptions

**Version:** 2.3
**Author:** Brandon Korous
**Last Updated:** 2026-06-06

---

## 1. Philosophy

Sparx billing is modular and honest. Tenants pay only for what they activate. No hidden tiers. No "you need to upgrade to access that." Every module has a clear price and a clear value proposition.

The CMS and Commerce engines are deliberately separated — a content publisher shouldn't pay for a shopping cart they'll never use, and a wholesale distributor shouldn't pay for a blog module they'll never touch.

---

## 2. Module Pricing

Each module is independently activatable:

| Module            | Monthly | Annual (20% off) | What It Includes                                                                  |
| ----------------- | ------- | ---------------- | --------------------------------------------------------------------------------- |
| **Builder**       | $10     | $96              | Site builder, themes, visual customizer, pages, custom domain, SSL, hosting + CDN |
| **Commerce**      | $49     | $470             | Products, variants, inventory, cart, checkout, Stripe payments, discounts         |
| **CMS**           | $49     | $470             | Full content editor, blog, media library, SEO tools, navigation, landing pages    |
| **CRM**           | $49     | $470             | Customer profiles, pipeline, activity log, tasks, segmentation                    |
| **Email**         | $29     | $278             | Transactional + marketing email via Mailgun, automations, templates, broadcasts   |
| **B2B/Wholesale** | $99     | $950             | Account pricing, RFQ/quotes, net terms, credit limits, fleet management           |
| **AI/MCP**        | $49     | $470             | MCP server for Claude, ChatGPT, Copilot — all tools included                      |
| **Dropship**      | $29     | $278             | Supplier connectors (DSers, Spocket, Faire), catalog sync, order routing          |

### Module Rules

- Every module is independent and optional — a tenant activates only the ones it uses (minimum one).
- Builder is optional, not a required base. It hosts and serves a website (pages, themes, domains, SSL, CDN); a tenant that wants a hosted Sparx site turns it on.
- Headless consumers don't need Builder — a content-only publisher (CMS), a CRM-only team, or anyone driving their own frontend off the API/MCP can run without it.
- B2B requires Commerce.
- Modules can be added or removed at any time (prorated).

### Transaction Fees

- Commerce only: 0.5% per transaction
- When CRM is added: 0.3% per transaction
- When active modules total $299+/mo: 0% transaction fee

---

## 3. Usage & Fair Use

Sparx does not meter the things a business grows into. Consistent with the per-module model:

- **Unlimited team members** — no per-seat pricing on any plan.
- **No per-record metering** — products, customers, and content are unlimited; you're never billed per row or per contact.
- **Flat email** — included with the Email module; no per-email fees and no contact-tier surcharges.

Infrastructure-cost resources (media storage, API and MCP request volume) carry generous fair-use allowances rather than hard caps or automatic overage billing. Sustained, abnormal usage that drives real infrastructure cost is handled case-by-case, and Enterprise plans can set explicit custom limits.

---

## 4. Enterprise & Managed Hosting

### Enterprise Plan

For clients requiring custom frontends, dedicated infrastructure, or contractual SLAs:

- All modules included
- Custom frontend development (scoped separately)
- Dedicated Cloud SQL instance
- Dedicated Mailgun IP pool
- 99.99% uptime SLA
- Dedicated support contact
- Pricing: custom, starting ~$2,000/mo

### Managed Hosting Add-On

Available on any plan for tenants who want Sparx to operate their infrastructure:

**$750/month includes:**

- Cloud hosting (GKE, Cloud SQL, Redis, GCS)
- Uptime monitoring + alerting
- Automated backups (daily snapshots, 30-day retention)
- Security patch management
- SSL certificate management
- Platform updates and upgrades
- Direct support line (email + phone)
- Monthly performance report

Gillett Diesel Service Inc. is the first managed hosting client at $750/month, on the Enterprise plan with a custom frontend.

---

## 5. Stripe Integration

All billing handled via Stripe:

- Subscription plans defined as Stripe Products + Prices
- Modules as Stripe subscription items (add/remove mid-cycle, prorated)
- Annual plans as upfront charge with Stripe subscription
- Managed hosting as a recurring add-on line item
- **Additional sites** as a recurring per-site add-on line item — the tenant's
  **primary** web property is included in the base plan; each **additional** site
  (`properties` rows where `is_primary = false`) is one add-on, same shape as a
  module item ([49-multi-site-per-tenant.md §7](49-multi-site-per-tenant.md)).
  Metering/gating is deferred — create-site is open until the billing build wires
  this item; the Sites settings page is where the count surfaces.
- Transaction fees calculated via Stripe Connect (when applicable)
- Failed payment: 3 retry attempts over 7 days → store read-only → 30 days → deactivated (data retained 90 days)

### Stripe Customer Portal

Tenants manage billing via embedded Stripe Customer Portal:

- View current modules and usage
- Add/remove modules
- Switch between monthly/annual
- Update payment method
- Download invoices
- Cancel subscription (with exit survey)

No custom billing UI — the Stripe Customer Portal is embedded into Sparx dashboard settings.

---

## 6. Trial

- 14-day free trial with full access to all modules
- No credit card required to start
- Full access during trial
- Day 12: in-app prompt to choose your modules
- Day 14: choose the modules to keep, and add a payment method to continue
- Trial data preserved 30 days after expiry

Trial-to-paid conversion is tracked as a primary business metric. Target: >30%.

---

## 7. Billing for the WizeWorks Portfolio

Each WizeWorks product (kanNINJA, HelpNinja, Sparx, etc.) has independent billing. Sparx billing is not shared with other WizeWorks products. Future consideration: a WizeWorks portfolio bundle that gives clients across multiple products a combined discount — but that's a future-state decision after each product has its own customer base.
