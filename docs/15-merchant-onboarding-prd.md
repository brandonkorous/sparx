# sparx Platform — Onboarding PRD

**Version:** 2.0
**Author:** Brandon Korous
**Last Updated:** 2026-06-11

---

## 1. North Star: Live in Under 5 Minutes

Every onboarding decision is measured against one thing: **time from signup to a live site** — a published page, a shop taking orders, or a headless API a developer can call, depending on what the tenant came to do. Target: under 5 minutes.

Selling is one capability, never the assumption. A CMS-only publisher, a CRM-only team, and a B2B distributor are all first-class. Onboarding copy says "tenant"/"site"/"workspace" — never "merchant"/"store" — unless the tenant has turned on a selling module.

If information can be collected later without blocking launch, it is collected later (see §6).

---

## 2. Shape: A Full-Page, Two-Pane Flow

Onboarding is **not a modal**. It is a focused full-screen route (`apps/dashboard/app/(onboarding)`) outside the dashboard shell — no sidebar, no topbar.

- **Persistent left rail** (Builder Indigo): the sparx wordmark, an **always-visible vertical journey** (every step with done/current state), and a one-line context blurb that changes per step. The rail never moves — it is the single source of progress and a sense of place.
- **Clean working pane** on the right: the only thing that changes between steps. Left-aligned headline + supporting line at the top of each step. Nothing floats center-stacked in a void.
- **Responsive** (top-2 rule): under ~940px the rail collapses to a slim indigo top bar with a compact dot-progress; the pane goes full width; grids stack to one column.

The frame must _earn_ being full-page — it is not a modal with the walls removed.

---

## 3. Principle: Modules First

The opening move is choosing **capabilities (modules)** — not a theme, not a template. This is deliberate:

1. **It is the honest expression of "modules, not plans."** The tenant explicitly chooses the capabilities they will be billed for, up front, instead of discovering them implicitly.
2. **It is the only filter that scales.** The blueprint catalog will hold hundreds to thousands of templates. Modules are the primary cut that makes the gallery tractable before search and category even apply.
3. **It inverts activation.** Historically the blueprint installer derived modules from the chosen template (`enableModules(blueprint.requiresModules)`). Now the **explicit module selection drives activation and billing**, and a template's `requiresModules` becomes a **compatibility filter** (show only templates whose needs ⊆ the selected modules). The template installs _content_ within the capabilities already chosen — it never surprise-activates a module.

---

## 4. The Flow

Six steps. The **Payments** step is conditional (§4.5), so a content/CRM-only tenant sees five.

```
Sign up ──▶ ① Modules ──▶ ② Template ──▶ ③ Workspace ──▶ ④ Domain ──▶ ⑤ Payments* ──▶ ⑥ Launch
                                                                         (*if a selling module is on)
```

### 4.1 — Step 1 · Modules

An exact replica of the marketing **pricing switchboard** (`apps/web/components/marketing/pricing-switchboard.tsx`): one toggle row per module + a live **calculated plan card** (total $/mo, per-module breakdown, "save $X on one bill," module count). Same modules, prices, colors, and copy — onboarding and the public pricing page must never diverge.

- Modules and prices are owned by **docs/17 §2**. Defaults on: **Builder ($10) + Commerce ($49) + CMS ($49)** = $108/mo.
- The plan card shows what the tenant pays **after** the 14-day trial. The CTA is **Continue** (the trial already started at signup; see §8). Subtext: _"Free for 14 days · no card today."_
- **Builder can be turned off.** Builder renders and serves the hosted site; a tenant running sparx **headless** (own frontend against the API/MCP, or a content/CRM-only back office) does not need it. Turning Builder **off** triggers a **warn + confirm** ("Your hosted site won't be served — you'll use sparx headlessly. Continue?") per the destructive-action rule.
- The selection is the input to Step 2's filter and to billing.

### 4.2 — Step 2 · Template

A gallery of complete, themed blueprints — pages, design, products, and copy in place from the first second. Picking one installs a full site **as a draft** and confirms the module set.

- **Filtered to the selected modules** (strict subset: show templates whose `requiresModules ⊆ selection`). A **search** box narrows further; a **count** ("Showing 6 of 340") and a **locked hint** ("4 more unlock with Email, B2B — add one on the Modules step") keep the relationship legible. This is what scales to thousands of blueprints.
- **Only blueprints with a real preview screenshot are shown** (filtered server-side) — a new tenant never sees a placeholder. Capturing missing previews is a separate, tracked effort.
- **Start from scratch** is the quiet secondary path (blank canvas, no install).

### 4.3 — Step 3 · Workspace

Names the tenant's company and its first site. Signup already ran `slugify(company)` and created the tenant + one primary Property; this step **surfaces and refines** that — it is confirm, not re-type.

- **Company name** — pre-filled from signup, editable.
- **Workspace address (slug)** — live preview `<slug>.sparx.zone`. **Editable here, locked after.** The slug can change up until onboarding finalizes; once the workspace is established it is read-only (changing it later is a support operation). See §7 decision C.
- **Site name** — defaults to **"Primary"** (not the company name — avoids "Bob's Barbers → Bob's Barbers"). Editable; multi-site tenants name their first property here.

### 4.4 — Step 4 · Domain (a featured upsell — never minimized)

**Claiming a custom domain is a significant revenue moment, and it is treated as one.** This is its own step, led by search — not a checkbox tucked under the subdomain field.

- **Lead with search.** A prominent "find your domain" field with live availability + pricing (registrar integration; see `settings/domains`). Offer the obvious match as a hero result (`bobsbarbers.com — available — $X/yr`) plus alternatives.
- **Aspirational, not pushy framing.** A custom domain reads as _making it yours / official_, not an add-on being sold. One-tap purchase via the existing `PurchaseDialog`.
- **Never blocks.** The free `<slug>.sparx.zone` address always works and is one click ("start free for now — add a domain anytime"). The step is **skippable**.
- **Domain attach rate is a tracked metric** (§9). Do not bury this step or shrink it in future iterations.

### 4.5 — Step 5 · Payments (conditional)

**Stripe Connect** — connects the tenant's _own_ account so their site can accept customer payments and receive payouts. This is entirely separate from the tenant's sparx subscription (docs/17 §5).

- **Conditional:** shown only if a **selling module** (Commerce / B2B / Dropship) is enabled. A content/CRM-only tenant skips this step — there is nothing to collect.
- **Skippable;** the site still launches, and checkout simply stays off until Connect is finished.

### 4.6 — Step 6 · Launch

One tap publishes the installed draft. No embedded iframe — the site serves only published data, so a pre-publish preview reads as empty. Instead: a confident "your site is ready" summary (what's installed) + **Publish** + **Preview in a new tab** (full-fidelity draft via preview token) + Customize / different-template.

---

## 5. Information Policy: Need / Like / Later

| Information                 | Stage                          | Class     | Why there                                                                         |
| --------------------------- | ------------------------------ | --------- | --------------------------------------------------------------------------------- |
| Name · email · password     | Sign up                        | **Need**  | Can't mint an identity without it                                                 |
| Company name → slug         | Sign up → confirm in Workspace | **Need**  | Creates the tenant + `<slug>.sparx.zone`; refined later                           |
| Module selection            | Onboarding · 1                 | **Need**  | Explicit capability choice — drives activation & billing, filters the catalog     |
| Template choice             | Onboarding · 2                 | **Need**  | Installs the whole site as a draft                                                |
| Site name                   | Onboarding · 3                 | **Need**  | Defaulted ("Primary"), editable                                                   |
| Custom domain               | Onboarding · 4                 | **Like**  | Featured upsell; free subdomain works instantly                                   |
| Payments (Stripe Connect)   | Onboarding · 5                 | **Like**  | Only to take real orders; conditional + skippable                                 |
| Business / physical address | Dashboard checklist            | **Later** | Captured when a module needs it — shipping origin, tax nexus, invoices, local SEO |
| Real catalog · team · media | Dashboard checklist            | **Later** | Template seeds a believable site; swap in the real thing after launch             |

**Physical address is deliberately omitted from onboarding** (decision A). It means different things per module and a CMS/CRM-only tenant has no use for it; forcing it taxes the 5-minute goal.

---

## 6. Post-Onboarding: Welcome Checklist

After launch the tenant lands in the dashboard. Everything deferred to protect the 5-minute path surfaces here — **contextually, when a module needs it**, as non-blocking checklist items (never modal interrupts):

- Add business / physical address (prompted by the first module that needs it).
- Add real products, pricing, media.
- Invite team members.
- Connect a custom domain (if skipped in onboarding — the upsell continues here).
- Connect an AI client (if the AI module is on).

---

## 7. Locked Decisions (2026-06-11)

- **Modules first**, then template, with modules filtering the catalog (§3).
- **A — Physical address omitted** from onboarding; captured contextually later.
- **B — Site name defaults to "Primary"** (not the company name).
- **C — Slug editable before creation, locked after.** The Workspace step is the last place it can change; once onboarding finalizes the slug is read-only.
- **Builder can be turned off** (headless / content-only / CRM-only), behind a warn + confirm.
- **Domain is a featured upsell** with its own step — never minimized.
- **Template filter is strict subset** (requiresModules ⊆ selection). (Revisit against real catalog data if it feels empty for single-module pickers.)

---

## 8. Billing & Trial (summary — full detail in docs/17)

- **Modules, not plans.** No tiers. Each module is an independent, priced toggle; the tenant pays only for what's on.
- **14-day trial, no card.** At module-select a Stripe subscription is created **trialing**, with one line item per active module and no payment method. The plan card shows the post-trial monthly.
- **Card is never collected during onboarding** — it is captured later via a dashboard trial banner, and required only to continue past day 14. This protects the "no card to start" promise and the 5-minute path.
- The full **trial → grace → suspend** lifecycle (including the site "site unavailable" overlay and the dashboard prompting ladder) lives in **docs/17 §6**.

---

## 9. Success Metrics

| Metric                                                      | Target       |
| ----------------------------------------------------------- | ------------ |
| Time to live site                                           | < 5 minutes  |
| Onboarding completion rate                                  | > 80%        |
| **Domain attach rate (custom domain bought in onboarding)** | track + grow |
| Payment (Connect) connection rate, day 1 — selling tenants  | > 60%        |
| Trial-to-paid conversion                                    | > 30%        |
| Day-7 retention                                             | > 70%        |

---

## 10. Error Handling

- **Slug taken** — suggest 3 alternatives automatically (Workspace step).
- **Domain purchase fails** — fall back to the free `<slug>.sparx.zone`; the site still launches; retry from Settings.
- **Stripe Connect fails** — the site still launches; a "connect payments" banner appears in the dashboard.
- **Email unverified** — non-blocking; the site launches; a verification banner shows.
- **Blueprint install fails** — surface the error on the Template step; the tenant can retry or pick another (a different template resets any partial install).

---

## 11. Status

Design-complete; **not yet built**. Interactive mockups: `mockups/onboarding.html` (the wizard) and `mockups/new-user-flow.html` (this flow + the billing lifecycle). Platform billing (docs/17 §6) is intentionally deferred until the onboarding UI is concrete; the onboarding UI has no billing dependency and ships first.
