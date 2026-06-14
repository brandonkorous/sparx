# Site Builder Section System & Landing Composition

**Version:** 1.0.1
**Author:** Brandon Korous
**Last Updated:** 2026-06-01

---

## 1. Purpose & forcing function

The Site Builder can dress a commerce site — hero, product grids, collection tiles, a
testimonials row. It cannot yet compose a real **marketing landing page**. This document specifies
the gap precisely and the section model that closes it.

The forcing function was a deliberate exercise: take a high-polish modern brand homepage as a target
and rebuild it inside our E2E store section-for-section, recording everything that blocks a faithful
build. The result was unambiguous. **We can carry the _content_ of such a page but not its _layout
language_.** The target was, structurally, one pattern repeated — a **full-bleed media panel with
stacked calls-to-action**, arranged in 1-up and 2-up rows — plus a side-by-side media+text band, a
band of stat counters, and an embedded interactive map. We have none of those primitives.

### 1.1 Design principle: site-agnostic primitives

The target was a **stress test, not a spec.** Nothing in this model is shaped to one brand: we add
small, composable primitives (a media block, a CTA pair, a panel row) that any tenant assembles
into any layout. A specific homepage is a useful adversary because it surfaces the missing
primitives, but the deliverable is a **general toolkit** — the same pieces compose a SaaS landing, a
restaurant page, an agency portfolio, or an editorial home equally well (§3.1 cross-checks this).

Two rules follow, and they are binding on every future section:

1. **No target-specific anything** — no section type, field, token, or class encodes a particular
   brand or a particular page. If a primitive only makes sense for one site, it is the wrong
   primitive.
2. **Describe in our own design language** — sections and docs name patterns generically
   (media panel, panel row, media+text band), never by an external brand
   ([[feedback_no_competitor_names_in_docs]]). The forcing exercises stay in conversation; the
   shipped catalog is brand-neutral.

Expect more forcing exercises against other archetypes; each should be buildable from this same
catalog or it exposes the next primitive to add — not a one-off section.

**Where this fits.** [docs/36-sitebuilder-layering-model.md](36-sitebuilder-layering-model.md) defines
three tiers: **Brand+Theme** (look), **SiteLayout** (page regions/chrome), **PageLayout** (the
composition of sections that fills the content region). This document is about the **sections
themselves** — the catalog and its capability model — which is the content PageLayout arranges and
which neither doc 36 nor [docs/08-site-builder-spec.md](08-site-builder-spec.md) specs out. It
**refines doc 08's section model** and slots **under doc 36's PageLayout tier**. A handful of gaps
(header overlay, nav, footer) belong to the **SiteLayout** tier and are flagged as such in §3 and
§4.3 rather than solved here.

**Out of scope:** the editor shell and preview transport (doc 30), brand/theme tokens
([docs/33-token-model-v2.md](33-token-model-v2.md)), and layout assignment/resolution (doc 36).
Session-level bugs that are not about composition are listed in §8.

---

## 2. As-built baseline

### 2.1 The section model is a flat, registry-driven stack

A PageLayout's content region is an **ordered, flat list** of sections. Each section type is declared
once in [section-registry.ts](packages/sitebuilder-schemas/src/section-registry.ts) — the single
source consulted by the editor (form generation + the scope-restricted library), the service (config
validation + defaults), and the site (rendering). **Adding a section means:** write its Zod
schema + `SectionField[]`, register it in `SECTION_REGISTRY`, add a site component, and add a
`case` to [section-renderer.tsx](apps/site/components/section-renderer.tsx).

The critical structural fact: **sections do not nest.** A page is a flat stack of full-width blocks.
There is no container that holds child blocks side by side. This single constraint is the root of the
biggest gap below.

The editor's field system ([fields.ts](packages/sitebuilder-schemas/src/fields.ts)) is richer than
the current sections use. It already supports `list` with nested `itemFields` (testimonials prove
it), plus `color`, `media`, `boolean`, `range`, `select`, `url`. **Multi-CTA and multi-panel configs
are expressible with the existing field infra** — they need new _schemas_ and _renderers_, not new
editor primitives.

### 2.2 The seven static sections and their exact ceilings

| Section               | Config (source of truth)                                                                                                             | Hard ceiling that blocks landing-page use                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hero**              | `backgroundMediaId`, `heading` (≤160), `subheading` (≤400), **one** `ctaLabel` (≤60)/`ctaUrl`, `align` L/C/R, `overlayOpacity` 0–100 | Padding clamps `3.5–7rem` (never full-viewport); **single CTA**; text block always centered vertically; image only (no video); white text forced when a bg is set.                                                        |
| **Image banner**      | `imageMediaId`, `heading`, `subheading`, **one** `ctaLabel`/`ctaUrl`, `align`, `height` sm/md/lg                                     | Lives **inside `st-container`** (width-constrained, rounded corners) so it is _not_ full-bleed; text sits in a fixed centered `46ch` dark box (no corner anchor); `height` maxes at **480px**; **single CTA**; one image. |
| **Featured products** | `heading`, `source` newest/collection/manual, `columns` 1–4, `limit`                                                                 | Renders product tiles only; `return null` when zero products resolve (silent).                                                                                                                                            |
| **Collection grid**   | collection tiles                                                                                                                     | `return null` when empty (silent).                                                                                                                                                                                        |
| **Rich text**         | `heading`, sanitized `html` (≤20k), `align`, `width`                                                                                 | Prose only — no CTA, no media slot, **no `<iframe>`/script** (sanitized).                                                                                                                                                 |
| **Testimonials**      | `items[]` (quote/author/avatar/rating), `columns` 1–3                                                                                | Fixed card layout; proves the `list`+`itemFields` pattern works.                                                                                                                                                          |
| **Email signup**      | heading/description/placeholder/button/success                                                                                       | Single inline form.                                                                                                                                                                                                       |

Render path: `SectionRenderer` switches `sectionType` against a component map, themes purely via the
`--st-*` token layer injected by the site layout (the site has its **own** token/CSS
surface — it does **not** consume `@sparx/ui` components), and **skips unknown types** so an old
site tolerates a new section. Empty data-bound sections render nothing.

---

## 3. The complete gap list

Every gap found in the exercise, ranked by leverage (how much of a real landing page it unblocks).
"Tier" marks whether it belongs to this doc's section work (**PageLayout**) or to the deferred
**SiteLayout** chrome tier (doc 36).

| #   | Gap                                         | Target evidence                                                                 | Root cause                                                                                                                        | Tier                |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | **No multi-panel / split-row layout**       | Three 2-up rows of media cards (product pair, offers pair, accessory pair)      | Sections don't nest; only full-width stacking exists. The one grid (`st-grid[data-cols]`) renders product/testimonial tiles only. | PageLayout          |
| 2   | **Media panels too constrained**            | Every panel is a full-bleed photo, tall, text anchored bottom-left              | `ImageBanner` is container-width + rounded + centered `46ch` box + `≤480px`                                                       | PageLayout          |
| 3   | **Single CTA everywhere**                   | Every panel pairs a solid + a ghost button (a primary + a "learn more")         | `Hero` and `ImageBanner` expose exactly one `ctaLabel`/`ctaUrl`                                                                   | PageLayout          |
| 4   | **No side-by-side media+text band**         | A feature band: heading + CTAs on a light side, media strip on the other        | No section composes a text column beside a media column                                                                           | PageLayout          |
| 5   | **No stat / counter section**               | A row of big figures + labels (e.g. counts) with icons                          | No section type for figure+label arrays                                                                                           | PageLayout          |
| 6   | **No embed / map section**                  | A full-width interactive map                                                    | Rich-text is sanitized (no `<iframe>`/script); no embed primitive                                                                 | PageLayout          |
| 7   | **No carousel / slideshow**                 | Hero and each panel row are swipeable (arrows + dot pager)                      | No slideshow container; all sections are static server components                                                                 | PageLayout          |
| 8   | **No video backgrounds**                    | Hero + feature band play video                                                  | Media slot resolves an image URL only                                                                                             | PageLayout          |
| 9   | **No per-section text color**               | One card uses white text on a dark photo, the next dark text on a light bg      | Hero/banner force `#fff` when a bg exists; no `textColor` control                                                                 | PageLayout          |
| 10  | **No vertical/positional text placement**   | Hero copy near top; panel headings bottom-left                                  | `align` is horizontal only; vertical placement is hard-coded                                                                      | PageLayout          |
| 11  | **No full-viewport height**                 | Hero is ~100vh                                                                  | Hero padding clamp / banner `≤480px`                                                                                              | PageLayout          |
| 12  | **Header can't be a landing header**        | Transparent nav overlaying the hero, arbitrary top-level nav, centered wordmark | `SiteHeader` is opaque, above the hero, nav is **collection-derived**, logo capped at 34px                                        | **SiteLayout**      |
| 13  | **Footer can't collapse / no real socials** | One centered row of legal links; real brand glyphs                              | `SiteFooter` is multi-column + social rendered as **single capital letters** + forced "Powered by Sparx"                          | **SiteLayout**      |
| 14  | **Empty section disappears silently**       | — (authoring quality)                                                           | `featured-products`/`collection-grid` `return null` with no editor placeholder                                                    | PageLayout (editor) |

### 3.1 Generality cross-check

Before accepting a primitive, it has to earn its place across archetypes — not just the one target.
The proposed catalog (§4) composes each of these from the **same** pieces, which is the test that it
is a toolkit and not a one-off:

| Archetype                               | Composed from                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Commerce landing** (the target class) | Hero (full-bleed) → Panel row (category/product cards, 2 CTAs each) → Media+Text → Stats → Embed (store locator map)                          |
| **SaaS / product**                      | Hero (2 CTAs: trial + demo) → alternating Media+Text feature rows → Stats (uptime/customers) → Panel row (pricing tiers) → Embed (demo video) |
| **Restaurant / local**                  | Hero (full-bleed food photo) → Media+Text (our story) → Panel row (menu highlights) → Embed (map + reservations)                              |
| **Agency / portfolio**                  | Hero → Panel row (case-study cards) → Media+Text (services) → Stats (awards/clients)                                                          |
| **Editorial / publisher**               | Hero → Panel row (article cards) → Rich text → Email signup                                                                                   |

Every archetype resolves to the same five additions — **media block, CTA pair, Panels, Media+Text,
Stats, Embed** — with nothing brand- or industry-specific. A future archetype that _doesn't_ resolve
to these is the signal to add the next general primitive, and §9's open questions are where that gets
decided.

---

## 4. The target section model

The fix is a small set of **shared primitives** plus a few new section types built from them. Order
of leverage is reflected in the phasing (§7).

### 4.1 Shared primitives

**`Cta` + `ctas[]` (closes #3).** A reusable object, with an array of **max 2** on any banner-like
section:

```ts
const Cta = z.object({
  label: z.string().max(60),
  url: z.string(), // internal "/x" or absolute
  style: z.enum(['solid', 'ghost', 'link']).default('solid'),
});
ctas: z.array(Cta).max(2).default([]);
```

Editor: a `list` field with `itemFields` (`text` label, `url`, `select` style) — **no new field
type**. Site: `solid` → existing `st-btn--primary`; `ghost` needs a new **`st-btn--ghost`**
(outline-on-image) variant in [site.css](apps/site/app/site.css); `link` → text
link. `SbLink` already discriminates internal vs external. A small `SbCtaRow` wraps `ctas.map`.

**`MediaBlock` (closes #2, #8, #9, #10, #11).** The shared "framed media with overlaid content"
fields, mixed into Hero, Image banner, and each Panel:

```ts
mediaId: OptionalUuid,
mediaType: z.enum(['image', 'video']).default('image'),     // #8
fullBleed: z.boolean().default(false),                       // #2  (escape st-container)
height: z.enum(['sm', 'md', 'lg', 'screen']).default('md'),  // #11 ('screen' = 100dvh)
contentPosition: z.enum([                                    // #10 9-point grid
  'top-left','top-center','top-right',
  'center-left','center','center-right',
  'bottom-left','bottom-center','bottom-right',
]).default('center'),
textColor: z.enum(['auto', 'light', 'dark']).default('auto'),// #9  token-driven, never raw hex
overlayOpacity: z.number().min(0).max(100).default(40),
```

`contentPosition` is a `select`; the rest are `select`/`boolean`/`media`/`range` — again **no new
field type**. `textColor: light|dark` maps to `--st-*` tokens, never an arbitrary hex (brand rule,
§6). Video uses a muted/looped/`playsInline` `<video>` with the image as `poster`.

### 4.2 New & upgraded sections (PageLayout tier)

- **Hero (upgrade).** Add `ctas[]`, `mediaType`, `height` incl. `screen`, `contentPosition`,
  `textColor`. Backward compatible: a legacy `ctaLabel`/`ctaUrl` migrates to a single `ctas[0]` at
  parse time (Zod `transform`), so published snapshots keep rendering.
- **Image banner (upgrade).** Add `fullBleed`, `ctas[]`, `contentPosition`, `height: 'screen'`,
  `textColor`. Same legacy-CTA migration.
- **Panels (NEW — closes #1, the headline gap).** A self-contained section holding **1–4 child
  panels**, each a `MediaBlock` + `eyebrow` + `heading` + `subcopy` + `ctas[]`. Responsive: 4/3/2-up
  on desktop, **collapsing to a single stacked column on mobile** (per
  [[feedback_responsive_builder_mobile]]). This is the recurring 2-up "feature card row" — product
  pairs, offer pairs, category pairs.
  - **Self-contained, not section-nesting.** Panels live in a `list` field on the one section, the
    same shape as testimonials `items[]` — _not_ a recursive section tree. True nesting (arbitrary
    sections inside sections) is a much larger change to the flat model, the editor DnD, and the
    preview bridge; we explicitly defer it (§9) and ship the self-contained container, which covers
    every observed landing layout.
- **Media + Text (NEW — closes #4).** A two-column band: a `MediaBlock` on one side, a text column
  (eyebrow/heading/body/`ctas[]`) on the other, with a `mediaSide: left|right` toggle. Stacks on
  mobile. This is the classic alternating feature/explainer band.
- **Stats (NEW — closes #5).** `items[]` of `{ value, label, icon }` (icon = lucide name), `columns`
  2–4. A `list` field.
- **Embed (NEW — closes #6).** An allowlisted `<iframe>` (height + title + URL), host
  **allowlist-validated** server-side (maps, video, forms). Closes the embedded-map case without
  opening rich-text to arbitrary HTML. Security in §9.

### 4.3 Chrome (SiteLayout tier — closes #12, #13)

These are **not** section work; they belong to the SiteLayout tier that doc 36 §2 names and §11
defers. Captured here so the landing-page story is whole, and recommended to fold into the SiteLayout
build:

- Transparent/overlay header mode (header renders over a full-bleed hero, opaque-on-scroll).
- Arbitrary top-level nav (a menu the tenant defines, not only collection-derived links) + logo
  sizing.
- Footer: optional single centered legal row, real social glyphs (icon set, not first-letter), and
  "Powered by Sparx" as a **plan entitlement** (see §9).

---

## 5. Field-system & editor impact

- **No new `SectionFieldType` is required** for §4.1–§4.2. `list`+`itemFields`, `select`, `boolean`,
  `media`, `range`, `url` cover CTAs, panels, stats, positions, heights, and toggles. A later
  refinement (media **focal point**, richer icon picker) can add field types when needed.
- **Empty-section placeholder (closes #14).** The editor canvas must render a "Nothing to show yet —
  configure this section" placeholder for any section that would render `null` (no products resolved,
  no panels added), instead of vanishing. This is editor-only; the site still renders nothing.
- **Responsive authoring.** Panels / Media+Text / Stats collapse to one stacked column on small
  screens, and the editor's two-pane inspector collapses the same way
  ([[feedback_responsive_builder_mobile]]).
- **Preview bridge.** Static sections stay server components and resolve clicks via the existing
  `data-section-id` bridge. The carousel (§7 Phase E) is the **first interactive section** — see §9.

---

## 6. Theming & brand-rule compliance

Every new section themes **exclusively** through the `--st-*` token layer, like the existing ones —
no hardcoded colors, consistent with the CLAUDE.md brand rule and [[feedback_sparx_ui_decisions]]:

- `textColor: light|dark` selects token sets (`--st-text` / inverse), never a raw hex.
- The new `st-btn--ghost` variant is defined once in `site.css` alongside `st-btn--primary` —
  feature/section code references the class, it does not hand-build hover/focus states.
- The only inline style any section uses remains the background-image URL (the existing Hero/banner
  pattern); no new `style={{ color/background }}` fingerprints.
- Site sections render on the site's own CSS surface (not `@sparx/ui`), so this is
  additive CSS in `site.css` — the same place Hero/banner styles already live.

---

## 7. Phasing

Each phase is independently shippable and publishable (deploy-early ethos, [[feedback_deploy_early_deploy_small]]),
sequenced by leverage and dependency:

| Phase | Scope                                                                                                     | Unblocks                              | Notes                                                                |
| ----- | --------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| **A** | `Cta`/`ctas[]` primitive + `st-btn--ghost`                                                                | #3 — every panel's two-button pairing | Smallest change; legacy single-CTA migration.                        |
| **B** | `MediaBlock` upgrade on Hero + Image banner (fullBleed, height:screen, contentPosition, textColor, video) | #2, #8, #9, #10, #11                  | Hero becomes a real landing hero.                                    |
| **C** | **Panels** section                                                                                        | #1 — the three 2-up rows              | The headline gap; depends on A + B primitives.                       |
| **D** | **Media+Text**, **Stats**, **Embed**                                                                      | #4, #5, #6                            | Embed needs the allowlist (§9).                                      |
| **E** | **Slideshow/Carousel** container                                                                          | #7                                    | First interactive (client island); hydration + preview-bridge work.  |
| **F** | Chrome: overlay header, custom nav, footer                                                                | #12, #13                              | **SiteLayout tier** — folds into doc 36's deferred SiteLayout build. |

After Phases A–D, a tenant can build a static recreation of a modern brand homepage (full-bleed
hero, panel rows, media+text bands, stats, embedded map) minus the swipe interaction; Phase E adds
motion; Phase F makes the chrome match.

---

## 8. Out of scope / tracked elsewhere

Session findings that are **not** composition gaps (tracked in project memory, not here):

- Draft theme not previewable on the site (layout injects **published** tokens while the page
  renders **draft** sections).
- Social links live on the Brand & Theme surface; they are business identity and belong at the
  **tenant** level.
- Local dashboard preview points at the **live** site when `SPARX_SITE_URL` is unset.

The theme-not-applying bug (brand color overrides masking a selected theme) was fixed separately
(doc 33 model; released 2026-06-01).

---

## 9. Open questions

1. **Section nesting vs. self-contained containers.** We ship self-contained Panels (§4.2). Do
   tenants ever need arbitrary nesting (sections inside panels)? If so it's a flat-model rework —
   revisit only on real demand.
2. **Embed allowlist & CSP.** Which hosts (Google/Mapbox maps, YouTube/Vimeo, form providers)? The
   allowlist is enforced server-side at publish; the site's CSP `frame-src` must match. Needs a
   security sign-off before Phase D.
3. **"Powered by Sparx" removal as a plan entitlement** — ties into
   [docs/17-billing-subscriptions.md](17-billing-subscriptions.md). Decide before Phase F.
4. **Carousel as a client island.** How does the preview bridge resolve a click into a specific
   slide, and what's the hydration budget for a previously all-static page?
