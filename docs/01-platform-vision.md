# Sparx Platform — Vision & Strategy

**Version:** 2.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-03

---

## 1. The Problem

The content and commerce platform market is dominated by tools that have optimized for feature breadth at the expense of usability and honest pricing. Shopify's merchant onboarding now takes hours. HubSpot requires a dedicated admin. Combining them requires Zapier, custom integrations, and ongoing maintenance. The result: small and mid-size businesses paying $2,000–$3,000/month for a fragmented stack that still doesn't give them a unified view of their business.

Worse: businesses are forced to buy features they don't need. A blogger who just wants to publish — or to sell a single digital product — pays the same as a wholesale distributor managing 500 SKUs and 200 fleet accounts.

AI tools (Claude, ChatGPT, Copilot) have become indispensable — but they have zero visibility into business data. A business owner cannot ask their AI "what are my top 10 customers this quarter" because no platform exposes that natively.

And the newest problem runs the other way. A wave of AI tools can now generate an entire website from a prompt in seconds — but a generated site is a snapshot, not a system. The moment you need to maintain it, add real commerce, connect customer data, or change it next quarter, you are back to a developer or starting from scratch. The market is filling with sites that are effortless to _create_ and impossible to _keep_.

## 2. The Solution — Sparx

Sparx is a modular content and commerce operating system. You activate only the modules you need — content, commerce, or both. Every module shares the same data layer, the same dashboard, and the same API — so there's never a sync problem, never a missing integration, never a "you need the $2,400/month plan for that."

**The modules:**

- **Site** — Site builder, themes, pages, live in 5 minutes
- **Commerce** — Products, cart, checkout, orders, payments
- **CMS** — Content editor, blog, media library, SEO (standalone — no shop required)
- **CRM** — Customer intelligence, pipeline, activity log, automation
- **Email** — Transactional and marketing email, tied to the tenant's own domain, powered by Postal
- **B2B/Wholesale** — Account pricing, RFQ, net terms, fleet management, service scheduling
- **AI/MCP** — Native MCP server; Claude, ChatGPT, and Copilot speak your business data
- **Dropship** — Supplier connectors, catalog sync, automated order routing

Each module is independently activatable. A publisher running a content site pays for Site + CMS. A wholesale distributor pays for Commerce + B2B + CRM. A dropship entrepreneur pays for Commerce + Dropship.

And Sparx is built to _last_, not just to launch. Generate your site with AI if you want — Sparx is MCP-native, so you can. But Sparx is where a site **lives** afterward: you maintain and enhance it yourself in a visual, no-code editor, with full code available as an option and never a requirement (the four-tier escape ladder, [doc 47](47-class-first-authoring-model.md)). **AI to start; Sparx to last.**

## 3. The WizeWorks Context

Sparx is built and operated by WizeWorks (wize.works), based in Visalia, California, incorporated in 2026. WizeWorks owns and operates a portfolio of software products including kanNINJA (project management), HelpNinja (AI support), and others. Sparx is the flagship content and commerce platform.

The first Enterprise client is Gillett Diesel Service Inc. (Bluffdale, Utah) — migrating from Shopify + HubSpot ($35,400/year) to Sparx (custom frontend, managed hosting). Gillett's requirements drove the initial B2B, fleet, and MCP feature set.

## 4. Target Market

**Primary: SMB Merchants ($50K–$5M ARR)**
Currently on Shopify + HubSpot + Mailchimp + Zapier. Paying $1,500–$3,000/month for a fragmented stack. Want things to just work.

**Secondary: Content Publishers & Creators**
Want a fast, beautiful CMS with optional commerce. Don't need a full Shopify setup. Currently on WordPress + WooCommerce or Webflow + Stripe — paying for complexity they don't need.

**Tertiary: Industrial / B2B Businesses**
Fleet accounts, wholesale buyers, complex pricing. Currently using manual processes or legacy ERP. Underserved by every existing platform.

**Quaternary: Dropship Entrepreneurs**
Building product businesses without inventory. Need supplier sync, margin calculation, automated fulfillment.

## 5. Competitive Differentiation

| Capability                     | Sparx | Shopify    | HubSpot | WordPress   |
| ------------------------------ | ----- | ---------- | ------- | ----------- |
| Store live < 5 min             | ✅    | ❌         | ❌      | ❌          |
| Modular pricing                | ✅    | ❌         | ❌      | ❌          |
| Per-module activation          | ✅    | ❌         | ❌      | ❌          |
| CMS standalone                 | ✅    | ❌         | ❌      | ✅          |
| Built-in CRM                   | ✅    | ❌         | ✅      | ❌          |
| Native MCP / AI                | ✅    | ❌         | ❌      | ❌          |
| Built-in email (Postal)        | ✅    | ❌         | ✅      | ❌          |
| B2B / Wholesale native         | ✅    | +$2,400/mo | ❌      | ❌          |
| Dropship native                | ✅    | Via apps   | ❌      | Via plugins |
| Headless / API-first           | ✅    | +cost      | ❌      | Via REST    |
| Single monthly bill            | ✅    | ❌         | ❌      | ❌          |
| Self-hosted option             | ✅    | ❌         | ❌      | ✅          |
| No-code editing, code optional | ✅    | Themes/dev | ❌      | Plugins/dev |
| Maintain & extend, no rebuild  | ✅    | Via apps   | ❌      | Via plugins |

## 6. Pricing Model

### Module Pricing

| Module        | Price               |
| ------------- | ------------------- |
| Site          | $49/mo              |
| Commerce      | +$49/mo             |
| CMS           | $49/mo (standalone) |
| CRM           | +$49/mo             |
| Email         | +$29/mo             |
| B2B/Wholesale | +$99/mo             |
| AI/MCP        | +$49/mo             |
| Dropship      | +$29/mo             |

### Bundles (for simplicity)

| Bundle         | Modules                                               | Price   |
| -------------- | ----------------------------------------------------- | ------- |
| **Starter**    | Site + Commerce                                       | $79/mo  |
| **Content**    | Site + CMS                                            | $79/mo  |
| **Growth**     | Site + Commerce + CRM + Email                         | $149/mo |
| **Pro**        | All modules except B2B                                | $299/mo |
| **Business**   | All modules                                           | $449/mo |
| **Enterprise** | All modules + custom frontend + managed hosting + SLA | Custom  |

### Transaction Fees

- Starter / Growth: 0.5% per transaction
- Pro / Business / Enterprise: 0%

### Managed Hosting Add-On

For clients who want Sparx to operate their infrastructure:

- $750/month — hosting, uptime, backups, security patches, support, updates
- Gillett Diesel is the first managed hosting client

## 7. The Sparx Promise

> A new customer signs up, picks a theme, activates the modules they need, and is live — publishing their first page or taking their first order — in under 5 minutes. No developer required. No app store required. No Zapier required.

Every product decision is evaluated against this promise. If a feature slows the 5-minute path, it goes behind "Advanced Settings." If it enables it, it gets prioritized.

### The second promise: built to last

The 5-minute promise gets you live. The permanence promise keeps you there. In an era when anyone can generate a website in seconds — and abandon it just as fast — Sparx is the platform a site grows up on. You maintain and enhance it yourself, in a no-code editor, for years: no rebuild, no developer on retainer. Coding is always optional, never required, and never out of reach when you want it ([doc 47](47-class-first-authoring-model.md) escape ladder). You own the data and the site; Sparx is the platform, not the warden.

> **AI builds it. Sparx keeps it.**

These two promises are one arc, not a tension: _fast to start, permanent to keep._ "Live in 5 minutes" is the on-ramp; "built to last" is why you stay.

## 8. Domain Strategy

Sparx owns a portfolio of domains creating independent SEO acquisition channels:

- **sparx.works** — Primary brand and platform home (dashboard, API, MCP, marketing)
- **sparx.zone** — Tenant sites (`acme.sparx.zone` + custom-domain CNAME target). Shopify-style split keeps tenant reputation/cookies/SEO isolated from the platform brand.
- **sparxcms.com** — CMS module acquisition ("headless CMS for small business")
- **sparxcrm.com** — CRM module acquisition ("CRM built for commerce")
- **sparxemail.com** — Email module acquisition ("email marketing built in")
- **sparxb2b.com** — B2B module acquisition ("wholesale platform")
- **sparx.email** — Postal sending infrastructure + platform-to-tenant transactional emails (`sparx.mx` was unavailable; `sparx.email` now plays both roles)
- **sparx.host** — Managed hosting product marketing (currently 301 → sparx.works/hosting)
- **sparx.software** — Developer portal: SDK docs, API reference, MCP guides (currently 301 → sparx.works/docs)
- **sparx.exchange** — Defensive registration (currently 301 → sparx.works)
- **sparx.market** — Future theme/plugin/connector marketplace
