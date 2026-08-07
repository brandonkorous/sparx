# Reference-driven site templates — the CONTENT ten (WordPress)

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06

## What this is

The content-first counterpart to the [commerce ten](../README.md). A set of
first-party sparx **site blueprints** whose designs are modelled on the biggest,
most-proven **WordPress** publishers and media brands (late 2026) rather than
invented from scratch. Each template mimics a real flagship's **layout, section
rhythm, article structure, nav behaviour and overall aesthetic** — rendered in
sparx's own silica design system, paired with a fitting theme, and populated with
our own example-business content.

**Why a second set, and why WordPress.** The commerce ten model Shopify storefronts
and exercise the shop / PLP / cart / **PDP** surfaces. But sparx is **content and/or
commerce** — a CMS-only publisher is as first-class as a store. WordPress runs a huge
share of the world's serious publishing (news, magazines, newsrooms, institutions,
government, artists), so its flagships are the proven references for the **other**
half: the index/feed, **article**, archive/category, and author surfaces. Modelling
them gives us a content template library as battle-tested as the storefront one,
spanning genuinely different editorial design languages instead of ten near-identical
news grids.

## The rules (binding for every template here)

Identical to the commerce set:

1. **Structure & aesthetic, not identity.** We mimic layout, rhythm, article anatomy,
   nav, type feel and colour mood. We NEVER copy a publisher's logo, name, trademarks,
   photography, or literal brand palette. Every template ships sparx branding, our own
   example business, and royalty-free / original imagery.
2. **Tenant sites get full design freedom.** These are tenant blueprints, so the
   sparx-surface restraints (no shadow / no glass / no gradient / RULE #3) do NOT
   apply — see [[feedback_design_restraints_are_sparx_only]]. Use whatever the
   reference design calls for.
3. **silica-native.** Compose from the `SPARX_CATALOG` sections and the golden
   blueprint spine. New patterns a reference needs that the catalog lacks are added to
   the catalog (so they propagate), never hand-inlined per bundle. Content sites lean
   on the **CMS** side of the catalog (article, feed, archive, author) far more than
   the commerce set did — expect a content-focused [CATALOG-ADDITIONS](./CATALOG-ADDITIONS.md) pass.
4. **Industry-agnostic.** Vary the example verticals — never default to one industry.
5. **Faithfulness bar: "closest clone allowed"** — match the reference's structure AND
   overall aesthetic feel as closely as we can while staying on sparx components +
   branding and using no trademarked assets.

## The ten templates

Each row is a distinct **editorial** design language.

| #   | Reference (real WP site)      | Archetype                                | Example business (ours)                          | sparx slug          | Bespoke theme                           | Status          |
| --- | ----------------------------- | ---------------------------------------- | ------------------------------------------------ | ------------------- | --------------------------------------- | --------------- |
| 1   | **TechCrunch**                | Dense news "river" / feed publishing     | _Frequency_ — independent tech & industry news   | `news-feed`         | `dispatch` (white + one accent, dense)  | ✅ doc ✅ build |
| 2   | **The New Yorker**            | Literary longform, serif restraint       | _The Meridian_ — essays & ideas magazine         | `longform-literary` | `broadsheet` (cream + serif + red rule) | ✅ doc ✅ build |
| 3   | **Vogue**                     | High-fashion glossy, full-bleed image    | _Mode & Object_ — style & design magazine        | `glossy-fashion`    | `runway` (pure B/W editorial serif)     | ✅ doc ✅ build |
| 4   | **Rolling Stone / Variety**   | Bold entertainment & culture magazine    | _Static_ — music & pop-culture magazine          | `culture-bold`      | `amplitude` (black + hot accent)        | ✅ doc ✅ build |
| 5   | **National Geographic**       | Immersive photo-led storytelling         | _Wayfarer_ — travel & photography journal        | `immersive-photo`   | `expanse` (dark photo + bright frame)   | ✅ doc ✅ build |
| 6   | **TED (blog)**                | Ideas / talks, video-forward hub         | _The Commons_ — ideas & talks nonprofit          | `ideas-talks`       | `podium` (light + coral, video cards)   | ✅ doc ✅ build |
| 7   | **PlayStation.Blog**          | Brand community newsroom, launch cadence | _Launch Notes_ — a product studio's newsroom     | `brand-newsroom`    | `console` (true-dark + violet)          | ✅ doc ✅ build |
| 8   | **Harvard Gazette**           | University / institutional news          | _Northgate University_ — campus newsroom         | `institution-news`  | `quad` (navy + crimson, serif)          | ✅ doc ✅ build |
| 9   | **NASA / whitehouse.gov**     | Government / public-service portal       | _City of Rivermark_ — civic & public-agency site | `civic-portal`      | `agency` (deep federal-blue, clarity)   | ✅ doc ✅ build |
| 10  | **Sony Music / artist sites** | Recording artist / band, media-rich      | _Vela_ — a recording artist / band               | `artist-media`      | `amp` (stage-dark + vivid accent)       | ✅ doc ✅ build |

_(All confirmed WordPress / WordPress-VIP sites. Condé Nast titles — Vogue, The New
Yorker — hard-block automated capture like Sephora did in the commerce set; those are
studied from the live archetype + knowledge, screenshots captured in a manual pass.)_

Content catalog additions the ten docs converge on: [CATALOG-ADDITIONS.md](./CATALOG-ADDITIONS.md) — consolidated across all ten (the content-side Phase-2a build list).

## How the doc format adapts to content pages

We reuse the commerce [\_TEMPLATE.md](../_TEMPLATE.md) verbatim, with two sections
re-read for a publisher instead of a store:

- **§4 Layout anatomy** — the page set is **Home/index → Article → Category/Archive →
  Author → About → Contact**, plus each archetype's signature page (longform reader,
  photo story, talk/video library, tour dates). Where the commerce template says "PDP
  anatomy," read **"Article anatomy"** (title/rubric, byline & date, body measure,
  pull-quotes, inline media, related-reading rail); where it says "PLP / collection,"
  read **"Archive / category feed."**
- **§6 The sparx translation** — the seed data is **`cms.blog_post` / article records**
  (and taxonomy/authors) rather than commerce SKUs. A template MAY still seed a light
  commerce slice where the reference monetises (merch, subscriptions) — a good demo of
  content **and** commerce on one site — but content is the spine.

## How a template is built (once the doc is done)

Mirrors the commerce flow: a blueprint bundle under
`marketplace-catalog/blueprints/sparx-<slug>/` with `site.json` (home + content pages
composed from catalog sections), a `theme`, `brand` (identity only), example
`content.json` (articles, authors, taxonomy), and a `sparx.json` manifest. The catalog
self-publishes at api-rest boot, so no manual ingest step ships them.

See [\_TEMPLATE.md](../_TEMPLATE.md) for the per-brand doc format.
