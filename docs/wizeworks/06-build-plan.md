# WizeWorks — Build Plan (as a sparx tenant)

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-30

---

## 1. The premise

`wize.works` is built **on sparx**, as an ordinary tenant with an ordinary site. No special-cased
platform code, no bespoke Next.js app, no escape hatches.

That constraint is the whole point. Every place the platform makes this site harder to build is a
real bug report from a real customer who happens to be us. **File those as sparx work — never work
around them with custom CSS or a one-off component.**

---

## 2. Tenant and site setup

**Verified live 2026-07-30 via `list_sites`.**

| Item      | Value                                                     |
| --------- | --------------------------------------------------------- |
| Tenant    | `1bfef66a-a489-4e0f-99fd-f041adc7ffaa`                    |
| **Site**  | **WizeWorks — `d5d60023-38cc-4db2-ade7-925b8ba7d754`**    |
| Primary?  | Yes                                                       |
| Canonical | `wize.works` — **custom domain, active, already serving** |
| Also      | `wizeworks.sparx.zone`, `wizeworks.wizeworks.sparx.zone`  |

> ⚠️ **This tenant owns four sites.** Pass `propertyId` on **every** call. Omitting it targets the
> primary — which happens to be correct here — but a wrong id would overwrite a live site that has
> nothing to do with this project:
>
> | Site          | Id                                     | What it is                          |
> | ------------- | -------------------------------------- | ----------------------------------- |
> | **WizeWorks** | `d5d60023-38cc-4db2-ade7-925b8ba7d754` | **Our target**                      |
> | brandonkorous | `d6ee04f0-fd79-4bba-8f81-4ed0a6ffd438` | `brandonkorous.com` — personal site |
> | silicaui      | `1a81a37c-9eb9-4282-9511-1182f6c7acda` | silicaui docs site                  |
> | Template      | `c99e0e23-dae2-4814-b670-b73de5eec0f1` | The "perfect site" reference build  |
>
> Every site-editing tool echoes the resolved `site` — confirm it before continuing.

### What is there now

**Not greenfield, and cleared for replacement** (Brandon, 2026-07-30). The current state is two
overlapping builds on one property:

- An **older WizeWorks corporate site** (published 2026-07-05): Home, About, Products
  (`our-products`), Careers, Contact — with real SEO copy.
- A **generic starter set** seeded over the top (published 2026-07-16): Home `/`, Shop `/shop`,
  About `/about`, Contact `/contact`.

That leaves **duplicate published Home, About, and Contact pages** competing for the same paths,
plus `Blog post` / `Product page` / `Customer Story` collection templates and two layouts
(`WizeWorks layout` active). All of it is replaceable.

**The current theme is the exact thing this brand exists to get away from:** `apex` with primary
`#4F46E5` / accent `#7C3AED` — indigo-violet, the single most default palette in software
([research §4](01-design-research-2026.md)) — set in Space Grotesk + Inter. Replacing it with pine
on bone in Instrument Serif is a real move, not a lateral one. `appearancePolicy` is already
`toggle`, which matches [brand §4.5](04-brand-and-visual-identity.md).

## 3. Modules to activate

A new tenant starts with **zero modules on**. Turn on exactly these and nothing else.

| Module      | On? | Why                                                                |
| ----------- | --- | ------------------------------------------------------------------ |
| **Builder** | ✅  | The site itself — pages, layout, theme                             |
| **CMS**     | ✅  | Industries and products as content types                           |
| **CRM**     | ✅  | Inbound project inquiries become real records, not an inbox        |
| **Email**   | ✅  | Inquiry acknowledgements and internal notifications                |
| **SEO**     | ✅  | Metadata, schema, sitemap, `llms.txt`                              |
| Commerce    | ❌  | Nothing is sold on this site                                       |
| B2B         | ❌  | —                                                                  |
| Inventory   | ❌  | —                                                                  |
| Invoicing   | ⏳  | Later, if client billing moves onto the platform                   |
| Scheduling  | ⏳  | Later, if `Book a 20-minute call` becomes native instead of a form |
| Automations | ⏳  | Later, for inquiry routing                                         |
| AI/MCP      | ⏳  | Later — and only ever on our own credentials, never platform-level |

Activating a module later is a normal operation. Do not turn something on speculatively.

---

## 4. Build order

Sequenced so each step produces something real and publishable.

### The rule this plan is under

**Every step below is a sparx MCP call, made as the tenant.** No `@sparx/*` or `@wizeworks/*`
package edits, no app code, no `globals.css`. If a step cannot be done through the MCP surface, it
does not get done by reaching around it — it gets **logged as a platform gap and worked around
using only what a tenant has.**

That is the entire value of building this site. A package edit is invisible progress: it makes our
site work and leaves every real customer exactly as stuck as they were.

| Job                      | Tenant path (what we use)                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Colors, fonts, shape     | `create_saved_theme` / `set_silica_theme` — `tokens` is an **open map**, any token                  |
| Per-mode token overrides | `update_site_settings` → `settings.tokens.light` / `.dark` — open string maps                       |
| Logo + favicon           | `upload_image` → `update_site_settings` → `logoLightMediaId` / `logoDarkMediaId` / `faviconMediaId` |
| Header, nav, footer      | `get_builder_layout` → `update_builder_layout` → `publish_builder_layout`                           |
| Pages                    | `create_builder_page` / `update_builder_page` / `publish_builder_page`                              |
| Industries & products    | `create_content_type` → `create_content_entry` → `publish_content_entry`                            |
| Imagery                  | `upload_image` / `set_image_from_url`                                                               |
| SEO                      | page `seoTitle` / `seoDescription`, `set_page_seo`                                                  |
| Last-resort escape hatch | `update_site_settings` → `settings.customCss` (20k) — **log it as a gap when used**                 |

### Phase 1 — Foundation

1. **Design the wordmark + monogram**, then **upload them as tenant media** — `upload_image` for
   the light and dark lockups and the favicon, then `update_site_settings` with the three media
   ids. **Not** a `@sparx/brand` export: that package holds the _platform's_ marks, and a tenant
   has no way to publish into it. (If sparx's own chrome ever needs a WizeWorks mark — "a
   WizeWorks company" in a footer — that is a separate platform task, not part of this build.)
2. **Set the type in the theme**, not in code — `fontHeading: 'Instrument Serif'`,
   `fontBody: 'Geist'`. If the font doesn't resolve from theme data alone, **that is the finding**:
   log it, don't add it to a font pipeline.
3. **Create and apply the theme** — `create_saved_theme` → `apply_saved_theme` (or
   `set_silica_theme`), scoped to the WizeWorks `propertyId`, carrying the full palette from
   [brand §4.2](04-brand-and-visual-identity.md) including the eight industry hue tokens in the
   open `tokens` map.
4. **Industry hues — BLOCKED on a platform capability.** A tenant cannot name a color; the
   palette is a fixed list of ten roles, and there is no working tenant-side workaround (the
   theme emitters build a closed variable list — see [brand §10](04-brand-and-visual-identity.md)).

   > **This is the finding, and it is the most valuable thing this build produces.** Ship the
   > tenant-named-color primitive + generic `hue-N` namespace **as a platform feature for every
   > tenant** — then come back and build these pages with it. Do not hardcode eight WizeWorks
   > industry names into `globals.css` to unblock ourselves; that converts a customer-facing
   > feature into a private hack and teaches us nothing.
   >
   > Until it ships, industry pages use the existing roles and read as under-differentiated. That
   > is the honest interim state, not a reason to reach around the platform.

5. **Build and publish the site layout** — header, five-item nav, footer, mobile sheet with the
   sticky action. Publish the layout before any page.

### Phase 2 — The spine

6. **Homepage**, all nine sections per [architecture §4](05-site-architecture.md). Build every
   section static first; motion is added last or not at all.
7. **`/how-we-work`** — the process page the homepage's condensed version links to.
8. **`/contact`** with the project-inquiry form wired to CRM.
9. **`/pricing`** with real numbers.

### Phase 3 — Range

10. **Content types** (§5) and the `/industries` index.
11. **Three industry pages** for launch, chosen for maximum spread — recommend **beauty**,
    **trades**, and **manufacturing**: a two-person service business, a field business, and a
    B2B business.
12. **`/products`** — the two product cards.
13. **`/about`**, **`/security`**, **`/credits`**, and the legal pages.

### Phase 4 — Depth

14. **The remaining five industry pages.**
15. **`/architecture`** with the systems-diagram treatment.

### Phase 5 — Launch

16. Full pass against the acceptance criteria in [architecture §7](05-site-architecture.md).
17. Score all ten axes of the [research §14](01-design-research-2026.md) scorecard. Anything below
    8 gets fixed, not noted.
18. Domain cutover.

---

## 5. Content types

Authored in CMS so pages are content, not code — the same way any customer would do it.

### `industry`

| Field                         | Type            | Notes                                             |
| ----------------------------- | --------------- | ------------------------------------------------- |
| `name`                        | text            | "Beauty, wellness & personal care"                |
| `slug`                        | slug            |                                                   |
| `dayHeadline`                 | text            | Their day in their words — the page's `display-l` |
| `friction`                    | repeatable text | 3–4 specific broken things                        |
| `whatWeBuild`                 | rich text       |                                                   |
| `artifactImage`               | image           | The real screenshot for this industry             |
| `tuesday`                     | rich text       | The one-day narrative                             |
| `priceBand`                   | text            |                                                   |
| `heroImage`                   | image           | Pexels, graded, with a manifest row               |
| `seoTitle` / `seoDescription` | text            |                                                   |

### `product`

`name`, `tagline`, `whoItsFor`, `accentColor`, `mark`, `url`.

---

## 6. Forms

One form: **project inquiry**, on `/contact` and at the foot of every industry page.

| Field                               | Required | Notes                                        |
| ----------------------------------- | -------- | -------------------------------------------- |
| What's broken right now?            | ✅       | Free text, first field, no character minimum |
| Business name                       | ✅       |                                              |
| Industry                            | —        | Select, with a free-text option              |
| Roughly how many people work there? | —        | Ranges, not a number input                   |
| Name                                | ✅       |                                              |
| Email                               | ✅       |                                              |
| Phone                               | —        |                                              |

**Rules:** seven fields maximum, three required. The problem is asked first and the identity last —
people describe the pain more honestly before they've committed their name. Confirmation copy says
what happens next and by when. No email gate anywhere else on the site.

**Wiring:** submission creates a CRM record, publishes an `email.send` event for the
acknowledgement, and notifies internally. **Never call `sendTemplate()` directly** — outbound email
publishes to the event bus.

---

## 7. Build log — what actually happened

### Done 2026-07-30

| Step                     | Result                                                                     |
| ------------------------ | -------------------------------------------------------------------------- |
| Wordmark + icon designed | 8 SVGs in [assets/](assets/) — [brand §3](04-brand-and-visual-identity.md) |
| Marks uploaded as media  | wordmark `0649020a…`, wordmark-dark `3fd7f6b6…`, icon `76ede25a…`          |
| Site identity wired      | `logoLightMediaId` / `logoDarkMediaId` / `faviconMediaId` set              |
| Theme created            | **WizeWorks Pine** `2449dd4e-2167-4de7-b793-2e9f46a41da6`, base `apex`     |
| Theme applied            | Draft on the WizeWorks site; `appearancePolicy: toggle`                    |
| Site layout authored     | Header + footer + Outlet, **draft** on `2919fba1…` (the active layout)     |

Every call passed `propertyId` and every response echoed `site: WizeWorks`.

**The layout is deliberately NOT published.** Its nav points at `/how-we-work`, `/industries`,
`/pricing`, and `/about` — four pages that do not exist yet. `wize.works` is a **live domain**, so
publishing now would put four broken links in front of real visitors. The plan's original
"publish the layout before any page" assumed a fresh site; it doesn't survive contact with a live
one. Publish chrome and pages together.

### Platform findings

**1. Applying a saved theme does not clear the legacy v1 token overlay. (Real bug, high impact.)**

After `apply_saved_theme`, `draftSettings.presentation` correctly held the new pine palette — but
`draftSettings.tokens` still held the _previous_ brand:

```
tokens.light: { colorPrimary: "#4F46E5", colorAccent: "#7C3AED",
                fontHeading: "Space Grotesk", fontBody: "Inter" }
```

Those feed the `--st-*` bridge that `--color-*` reads. **Any tenant switching themes keeps the old
theme's primary colour and fonts** unless something else overwrites them. It had to be corrected by
hand with `update_site_settings`. `apply_saved_theme` should clear or rewrite the v1 overlay.

**2. `update_site_settings.settings` replaces wholesale, not per-key.** Sending `{tokens}` alone
would have dropped `presentation` and `activeSavedThemeId`. The full object had to be resent.
Worth either documenting on the tool or making it a merge.

**3. A page can hold a slug the API refuses to accept.** The starter Home page `f3ef690c…` has
`slug: "/"` persisted, but `update_builder_page` rejects `"/"` with _"Use lowercase letters,
numbers, and hyphens."_ That page therefore **cannot be edited without changing its slug** — the
stored data violates the write validator. It also produced the duplicate-root situation: one page
with `slug: "/"` and one slugless (the real root). Either accept `"/"` on write or stop persisting
it.

**4. Confirmed working, contrary to an earlier assumption in these docs:** `create_saved_theme`
round-trips `colorSecondary` + `colorSecondaryForeground`, `colorAccentForeground`, a full
light/dark `presentation`, and an open `brand.tokens` bag (shape/radii). The theme model is not the
constraint — see [brand §10](04-brand-and-visual-identity.md).

### Still expected

| Area    | Gap                                                                                   |
| ------- | ------------------------------------------------------------------------------------- |
| Colors  | Tenant-named colours (`hue-1 … hue-12`) — in flight; blocks the eight industry hues   |
| Fonts   | Whether `Instrument Serif` + `Geist` resolve from theme data alone — verify on render |
| Builder | Asymmetric splits, full-bleed bands, visible-grid sections                            |
| Imagery | AVIF + `srcset`, per-image alt/dimension enforcement                                  |
| CMS     | Repeatable field groups (the `friction` list on an industry)                          |
| SEO     | `Service` + `FAQPage` schema; a maintained `llms.txt`                                 |
| Forms   | Conditional free-text on a select; identity fields ordered last                       |

## 7.5 RESUME HERE — state as of 2026-07-31

Everything below is **draft**. Nothing has been published; `wize.works` still serves the old site.

### Ids

| Thing                | Id                                                              |
| -------------------- | --------------------------------------------------------------- |
| Tenant               | `1bfef66a-a489-4e0f-99fd-f041adc7ffaa`                          |
| Site (WizeWorks)     | `d5d60023-38cc-4db2-ade7-925b8ba7d754` — **pass on every call** |
| Saved theme          | `2449dd4e-2167-4de7-b793-2e9f46a41da6` (WizeWorks Pine)         |
| Active layout        | `2919fba1-5886-4552-8495-dcd7d46559db` (WizeWorks chrome)       |
| Media: wordmark      | `0649020a-f4bc-4d7d-9771-edeed599ba57`                          |
| Media: wordmark dark | `3fd7f6b6-d1fa-4e42-86aa-70b32f38acf1`                          |
| Media: icon          | `76ede25a-d8d8-41fa-afc7-31c42de373d8`                          |

### Page inventory + disposition

| Page              | Id          | Slug            | Do                                                                     |
| ----------------- | ----------- | --------------- | ---------------------------------------------------------------------- |
| **Home**          | `fbc5a2a5…` | _(none — root)_ | ✅ **Built.** Our homepage.                                            |
| Home (starter)    | `f3ef690c…` | `/`             | **Delete** — duplicate root, and uneditable (finding 3)                |
| About             | `adb6dbee…` | `about`         | Rewrite                                                                |
| About (starter)   | `15e6ab44…` | `/about`        | **Delete** — duplicate                                                 |
| Contact           | `bab8dcb7…` | `contact`       | Rewrite + wire the form to CRM                                         |
| Contact (starter) | `8955a8ae…` | `/contact`      | **Delete** — duplicate                                                 |
| Products          | `7432b10d…` | `our-products`  | Rewrite; **see slug mismatch below**                                   |
| Careers           | `16ede198…` | `careers`       | Out of scope — leave alone for now                                     |
| Shop (starter)    | `db2ca299…` | `/shop`         | **Delete** — nothing is sold here                                      |
| Customer Story    | `556ca69f…` | collection      | **Delete** — no social proof ([02 §8](02-positioning-and-audience.md)) |
| Blog post         | `c62e02de…` | collection      | Decide — no blog in the sitemap yet                                    |
| Product page      | `a21f981c…` | collection      | **Delete** — commerce template, unused                                 |

> ⚠️ **Slug mismatch to resolve before publishing.** The layout nav links to `/how-we-work`,
> `/industries`, `/products`, `/pricing`, `/about`, `/contact`. Existing pages use **bare** slugs
> (`about`, `contact`, `our-products`) and the starters use leading-slash ones (`/about`). Pick one
> convention, fix the pages, and re-check every nav + button href in the layout and the homepage.
> `products` vs `our-products` is a live broken link today.

### Next steps, in order

1. Build the four missing pages the nav points at: `/how-we-work`, `/industries`, `/pricing`,
   `/contact` (with the project-inquiry form → CRM, [§6](#6-forms)).
2. Rewrite `about` and `products`.
3. Delete the duplicates + the commerce/story leftovers per the table.
4. Resolve the slug convention; re-check every href.
5. Render and eyeball light + dark, desktop + 375px. Verify **Instrument Serif and Geist actually
   resolve** from theme data — that is still unverified.
6. Swap the industries grid onto the eight hues once the tenant-named-colour capability lands.
7. Publish layout + pages **together**, then `publish_site`.

Blocked on Brandon: pricing numbers, kanNINJA + AGCONN hues, a real product screenshot.

---

## 8. Launch checklist

- [ ] `WizeWorks LLC` everywhere — prose, footer, legal, and `Organization` schema; zero `Inc.`
- [ ] Wordmark and monogram shipping from `@sparx/brand`; favicon correct at 16px
- [ ] Theme applied to the correct `propertyId`; verified in both light and dark
- [ ] Every page carries at least three hues by function; no page is pine-and-neutrals only
- [ ] Layout published before any page
- [ ] Every page's acceptance criteria met ([architecture §7](05-site-architecture.md))
- [ ] Every image graded, sized, alt-texted, and present in the manifest
- [ ] `/credits` lists every photographer
- [ ] Contact form creates a CRM record and sends the acknowledgement, end to end
- [ ] Schema validates; `llms.txt` accurate
- [ ] Real mid-tier phone: LCP < 1.8s, CLS < 0.05
- [ ] Keyboard-complete; reduced-motion page is complete
- [ ] Scorecard ≥ 8 on all ten axes
- [ ] Domain cutover with SSL verified
- [ ] Platform gaps from §7 filed as sparx work
- [ ] **Zero `@sparx/*` / `@wizeworks/*` / app-code edits were needed to ship this site**
- [ ] Every `customCss` use logged as a gap, with the tenant-facing feature it should have been
