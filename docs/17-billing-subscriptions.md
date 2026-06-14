# Sparx Platform — Billing & Subscriptions

**Version:** 2.5
**Author:** Brandon Korous
**Last Updated:** 2026-06-12

---

## 1. Philosophy

Sparx billing is modular and honest. Tenants pay only for what they activate. No hidden tiers. No "you need to upgrade to access that." Every module has a clear price and a clear value proposition.

The CMS and Commerce engines are deliberately separated — a content publisher shouldn't pay for a shopping cart they'll never use, and a wholesale distributor shouldn't pay for a blog module they'll never touch.

---

## 2. Module Pricing

Each module is independently activatable:

| Module            | Monthly | Annual (20% off) | What It Includes                                                                                                                |
| ----------------- | ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Builder**       | $10     | $96              | Site builder, themes, visual customizer, pages, custom domain, SSL, hosting + CDN                                               |
| **Commerce**      | $49     | $470             | Products, variants, inventory, cart, checkout, Stripe payments, discounts                                                       |
| **CMS**           | $49     | $470             | Full content editor, blog, media library, SEO tools, navigation, landing pages                                                  |
| **CRM**           | $49     | $470             | Customer profiles, pipeline, activity log, tasks, segmentation                                                                  |
| **Email**         | $29     | $278             | Transactional + marketing email via Mailgun, automations, templates, broadcasts                                                 |
| **B2B/Wholesale** | $99     | $950             | Account pricing, RFQ/quotes, net terms, credit limits, fleet management                                                         |
| **AI/MCP**        | $49     | $470             | MCP server for Claude, ChatGPT, Copilot — all tools included                                                                    |
| **Dropship**      | $29     | $278             | Supplier connectors (DSers, Spocket, Faire), catalog sync, order routing                                                        |
| **Invoicing**     | $19     | $182             | Authored estimates → work orders → invoices, line types, snapshots, payments, AR aging — **included free with Commerce or B2B** |

### Module Rules

- Every module is independent and optional — a tenant activates only the ones it uses (minimum one).
- Builder is optional, not a required base. It hosts and serves a website (pages, themes, domains, SSL, CDN); a tenant that wants a hosted Sparx site turns it on.
- Headless consumers don't need Builder — a content-only publisher (CMS), a CRM-only team, or anyone driving their own frontend off the API/MCP can run without it.
- **B2B requires Commerce** — enabling B2B auto-activates **and bills** Commerce (B2B is wholesale _on top of_ the commerce engine), and Commerce cannot be turned off while B2B is on. Enforced in the activation handlers (`@sparx/modules` `REQUIRES` graph), not just documented.
- **Invoicing is a bundled-free capability of Commerce and B2B** — either one activates the full Invoicing surface (authoring, AR, aging, templates, MCP tools) at **$0**. A tenant with neither pays **$19** for it standalone (a service business — contractor, repair shop, consultant — that quotes and bills without a site). Modeled as the `@sparx/modules` `BUNDLED_FREE` graph: the standalone `invoicing` flag is only ever set on a real $19 purchase, so the bundled case is never billed.
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

### Two Stripe integrations — never conflated

1. **Platform billing (tenant pays Sparx)** — Stripe **Billing / Subscriptions**. One subscription per tenant; **one item per active module** (add/remove mid-cycle, prorated). The 14-day trial and the lifecycle in §6 live here. The card is collected post-onboarding, **never during it**.
2. **Merchant payouts (the tenant's customers pay the tenant)** — Stripe **Connect**. Connected in the onboarding "Payments" step (docs/15 §4.5), conditional on a selling module being active. Transaction fees (above) are taken here. Entirely independent of the tenant's own subscription.

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
- Failed payment / trial expiry: handled by the **Trial → Grace → Suspend** lifecycle in §6 — a 7-day grace window (site stays live), then a non-bypassable site overlay; modules pause, the dashboard stays open, and data is retained throughout.

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

## 6. Trial → Grace → Suspend Lifecycle

Modules are chosen up front in onboarding (docs/15 §3), so the trial is about _keeping_ them, not picking them. The whole lifecycle is deliberately humane: the public site rides out a grace window, **only the public site ever locks** (the owner is never shut out of the dashboard), and **data is retained throughout**.

**Build status:** designed and locked (2026-06-11); deferred until the onboarding UI is concrete. No Stripe subscription code exists yet — this is greenfield.

### Day 0 — Trial starts (no card)

At module-select a single Stripe subscription is created **trialing** (`trial_period_days: 14`), with **one line item per active module** and **no payment method**. Everything is on. The onboarding plan card shows the post-trial monthly.

### Days 7 / 12 / 14 — Heads-up

Dashboard banner + emails count down: "3 days left — add a payment method to keep Builder, Commerce, CMS." Nothing changes yet.

### Day 14 — Trial ends (forks)

- **Card on file → active.** Subscription goes live; first invoice = sum of active modules, one bill.
- **No card → modules pause.** `trial_settings.end_behavior.missing_payment_method: 'pause'`. Paid module features gate in the dashboard ("add payment to reactivate"). **The public site stays live** — the grace window begins.

### Days 14–21 — Grace (7 days)

The site stays live for visitors; the dashboard nudges daily. A lapsed **active** subscription (failed renewal → Stripe Smart Retries + dunning) lands in this same grace state.

### Day 21 — Suspend

No active subscription past grace → the **site** (`apps/site`) serves a full-page, **non-bypassable** "site unavailable" overlay — a friendly Sparx-flavored message (e.g. _"Catching a fresh spark — back in a flash"_) that never exposes a billing problem to the tenant's customers. The site is suspended to the public; **the dashboard stays fully open** so the owner can add a card or export. **Nothing is deleted.**

### Anytime — Reactivate

Adding a card switches modules back on and lifts the overlay; the subscription resumes from its retained items — no rebuild, no data loss.

### Dashboard prompting ladder

The in-app counterpart to the site overlay — escalation, not nagging:

| When               | Treatment                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Trial days 1–6     | Quiet `Trial · N days left` chip in the topbar                                                    |
| Day 7              | First **dismissible** banner → Billing                                                            |
| Days 12–14         | Persistent banner with live countdown                                                             |
| Day 14 (paused)    | Prominent banner: "modules paused · site live for 7 more days" + ModuleGate on each paused module |
| Days 15–21 (grace) | Countdown intensifies: "site goes offline in N days"                                              |
| Day 21 (suspended) | Can't-miss banner: "your site is offline — add payment to restore instantly"                      |

### Implementation notes

- **The site billing-state check is on the public hot path** — it must be cached (per-tenant, short TTL, invalidated on subscription webhooks) so it does not tax TTFB.
- **Module toggle ↔ subscription item must stay in sync.** Toggling a module in the dashboard switchboard flips `tenants.settings.modules.<slug>.enabled` **and** adds/removes the matching Stripe subscription item (prorated), with **Stripe webhooks as the source of truth** for subscription state.
- **Platform/internal tenants are exempt** from trial suspension (the dogfood `wizeworks` tenant and any reserved/platform tenant via `SPARX_PLATFORM_TENANT_ID`).

Trial-to-paid conversion is a primary business metric. Target: >30%.

---

## 7. Billing for the WizeWorks Portfolio

Each WizeWorks product (kanNINJA, HelpNinja, Sparx, etc.) has independent billing. Sparx billing is not shared with other WizeWorks products. Future consideration: a WizeWorks portfolio bundle that gives clients across multiple products a combined discount — but that's a future-state decision after each product has its own customer base.
