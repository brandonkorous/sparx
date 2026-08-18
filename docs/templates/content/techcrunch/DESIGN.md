# TechCrunch — design study → `sparx-news-feed`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06
**Reference:** TechCrunch — https://techcrunch.com (structure captured 2026-08-06 via fetch; visual pass to `./images/`)
**Archetype:** Dense news "river" / high-frequency feed publishing — a scannable multi-column river of posts, category-coded tags, byline+timestamp cards, a "Most Popular" sidebar, section rails down the page.
**sparx slug:** `news-feed` · **Example vertical:** independent tech & industry news · **Theme:** bespoke — `dispatch` (see §6; closest presets `press` / `wire`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

TechCrunch is the defining **high-frequency news feed**: dozens of posts a day, no
single "story of the week," organised so a returning reader can scan what's new in
seconds. It anchors our content set as the **feed / river** archetype — the hardest
content homepage to lay out well, because it must stay legible while packing a firehose
of posts into categories, a lead grid, a "top headlines" text list, and a sticky
"Most Popular" + newsletter sidebar. It is the cleanest study of how **timestamps,
category tags, and byline density** carry a publishing homepage where imagery and
whitespace can't. Where Kith taught restraint, TechCrunch teaches **information
density done cleanly** — the opposite discipline, and the one every news, blog,
changelog, or industry-wire site needs.

## 2. Screenshots

Captured to `./images/` (manual visual pass).

- `home-fold.png` — Top fold: logo-left header + horizontal category nav (Latest/Startups/Venture/AI/Security/Apps/Events), dismissible event promo banner, then the "Recent Stories" lead grid — landscape image cards with a colored category tag, bold headline, linked byline, relative timestamp ("3 hours ago").
- `home-full.png` — Full scroll: lead grid → "Top Headlines" imageless text list (5 items, tag + byline) → per-section rails (AI, Startups, Security, Venture, Apps, Transportation) each with a "See More" link, interleaved with the sticky right sidebar (Most Popular ranked list, Upcoming Events, Newsletter signup).
- `nav.png` — Header + megamenu: horizontal section nav, search, newsletter/podcast utility links, mobile hamburger → full section list.
- `article.png` — Single post: category rubric, big headline, byline + avatar + timestamp, single lead image w/ caption, single-column body at a comfortable measure, inline related links, tag chips, "Most Popular" + newsletter rail persists.
- `archive.png` — Category/tag archive: section masthead + the same card river filtered to one topic, paginated / load-more.
- `footer.png` — Footer: multi-column link map (sections, company, legal, follow), newsletter capture, copyright bar.

## 3. Design language

- **Palette:** **Black on white, one hot accent.** Page ground pure white; ink near-black `#121212`; a single vivid brand accent (TechCrunch's is a green `~#00D084`, but the _strategy_ is one saturated accent) used on category tags, links, "See More" and the primary CTA. Category tags are the only place color lives — everything else is monochrome. Mood: fast, utilitarian, trustworthy, current.
- **Typography:** **All sans, weight-driven hierarchy.** A clean neutral grotesque throughout — no serif. Hierarchy comes entirely from **weight and size**: heavy bold headlines, medium bylines, small-caps/uppercase category tags with tracking, light-grey small timestamps. Headlines are tight leading, 2–3 lines max. This is the antithesis of the New Yorker's serif — legibility and scan-speed over voice.
- **Imagery:** **Utilitarian landscape thumbnails**, 16:9 / 3:2, one per lead card; the "Top Headlines" list carries **no images at all** (pure text scanning). No full-bleed heroes, no art direction — the image is a locator, not a statement.
- **Shape & density:** **Small radius** on cards/tags, hairline dividers between list items, **tight vertical rhythm** (many items above the fold). Multi-column: a wide content river (2–3 up) + a narrow sticky sidebar. Generous only at section headers. No shadows — separation is dividers + ground.
- **Motion:** Minimal — sticky sidebar, sticky header on scroll, load-more/infinite scroll on archives, dismissible promo banner. No carousels on the feed; content velocity IS the motion.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** A **dismissible event/promo banner** ("Get \$400 off Disrupt 2026") pinned above the header — high-visibility, closable.
- **Header / nav:** Logo left; **horizontal section nav** (Latest, Startups, Venture, AI, Security, Apps, Events, Disrupt) as the primary wayfinding; search + newsletter/podcast utility links right; megamenu/hamburger on mobile. Sticky, solid.
- **Hero:** **No single hero** — the "hero" is the **"Recent Stories" lead grid**: a 2–3-up row of the newest posts as image cards (category tag + headline + byline + timestamp). The lead is _recency_, not a curated feature.
- **Homepage section sequence** (this IS the blueprint's home composition):
  1. **Recent Stories** — lead grid of newest posts (image cards, tag/headline/byline/timestamp).
  2. **Top Headlines** — an **imageless 5-item text list**, tag + byline, for fast scanning.
  3. **Section rails** — repeated per topic (AI, Startups, Security, Venture, Apps, Transportation): a section header + a small row/list of that section's latest + a **"See More"** link to its archive.
  4. **Sticky right sidebar** (runs alongside 1–3): **Most Popular** ranked list (numbered), **Upcoming Events** (date + register), **Newsletter** signup, section quick-links.
  5. **Footer** (below).
- **Article anatomy** (the "PDP" of a publisher): category **rubric** above a big headline; **byline row** (author link + avatar + relative timestamp + read-time); one **lead image + caption**; **single-column body** at a comfortable reading measure with inline links, blockquotes, embeds; **tag chips**; a **related-reading** rail; the **Most Popular + newsletter sidebar persists**. No commerce buy-box — the conversion is the newsletter/subscribe.
- **Archive / category feed:** a **section masthead** (topic name + description) over the same card river filtered to that taxonomy, with **load-more / pagination**. Author pages are the same river filtered to one author + an author bio header.
- **Footer:** **multi-column link map** (Sections · Company · Legal · Follow), a newsletter capture block, social row, copyright bar.

## 5. Signature interaction patterns

1. **The scannable river:** category tag + bold headline + byline + **relative timestamp** on every card — the timestamp and tag are what make a high-frequency feed usable. Reproduce these and the "news" feel comes for free.
2. **Mixed card density:** an **image-card lead grid** immediately followed by an **imageless text list** ("Top Headlines") — two densities on one page so the eye gets both a visual entry and a fast-scan list.
3. **Per-section rails with "See More":** the homepage is a set of **topic previews**, each linking to its archive — the site as a directory of live sections, not one funnel.
4. **Sticky "Most Popular" + newsletter sidebar:** social proof (ranked reads) + the primary conversion (subscribe) travel with the reader down the whole page and into articles.

## 6. The sparx translation

- **Theme:** **bespoke — `dispatch`** (closest shipped: `press` / `wire`). A **pure-white, one-accent, high-density** news theme. **Built + AA-verified** in `wizeworks/packages/silica-catalog/src/content-themes.ts` (the name `signal` was taken by a shipped shelf).
  - **Grounds (4 surfaces):** `base-100` page = `#FFFFFF`; `base-200` muted card/list ground = `#F6F7F8`; `base-300` hairline dividers = `#E7E9EC`; `base-content` ink = `#121212`.
  - **Primary / accent strategy:** **one saturated accent** — an emerald `oklch(52% 0.13 158)` (light) / `oklch(60% 0.14 158)` (dark), verified AA-clean through silica's own contrast engine, used ONLY on category tags, links, "See More," and the newsletter/subscribe CTA. Everything else monochrome.
  - **Fonts:** display + body = a single **clean grotesque** (Inter/Söhne feel); category tags uppercase + tracked; timestamps in a lighter grey but still ≥ the readable ink floor (RULE #3 — timestamps are meta, not decoration, so keep them legible, not faded to nothing).
- **Section mapping:**

  | TechCrunch homepage band                 | sparx catalog key                                  |
  | ---------------------------------------- | -------------------------------------------------- |
  | Header nav + footer                      | `sparx_layout` (silica frame navbar/footer)        |
  | Dismissible promo banner                 | `promo_band` _(dismissible variant — see §7)_      |
  | "Recent Stories" lead grid (image cards) | `blog_post_grid` _(feed-card variant — §7)_        |
  | "Top Headlines" imageless text list      | **NEW: `headline_list`** (tag + headline + byline) |
  | Per-section rail + "See More"            | **NEW: `section_rail`** (taxonomy-scoped feed row) |
  | Sticky sidebar: Most Popular             | **NEW: `most_popular`** (ranked post list)         |
  | Sticky sidebar: Newsletter               | `newsletter_signup`                                |
  | Sticky sidebar: Upcoming Events          | `event_list` (if present; else content list)       |

  **Article:** rubric + headline + byline row → **NEW: `article_header`**; body → `article_body` (rich-text render of the post); related rail → `blog_post_grid` (related source); tags → tag chips. **Archive:** section masthead → `collection_header` (content variant); river → `blog_post_grid` filtered by taxonomy + load-more.

- **Example business:** **Frequency** — an independent **tech & industry news outlet** ("What shipped today"). Seeds ~24 `cms.blog_post` records across sections — **AI, Startups, Security, Hardware, Policy, Culture** — each with a category, author, timestamp, lead image, dek, and 4–8 paragraph body, so the lead grid, headline list, section rails, Most Popular, archives and article page all render real. ~6 author records with bios/avatars (so author pages + bylines resolve). Taxonomy = the six sections + a handful of tags. A light commerce slice is optional (a "Frequency Pro" subscription) to demo content+commerce, but content is the spine.
- **Design freedom used (tenant-only affordances):** none of the reference's look needs shadow/glass/gradient — it's monochrome + one accent, separation by divider/ground, exactly what sparx surfaces already allow. The tenant-only affordance used is **information density** (tight rhythm, imageless lists) and a **sticky multi-column** article/home layout.
- **Deliberate departures:** vertical stays adjacent (tech _news_ rather than tech _products_); no TechCrunch logo, wordmark, green, or section naming; the event-promo banner becomes a generic dismissible promo; "Disrupt" event modules generalise to an events list only if the example seeds events.

## 7. Build notes / catalog gaps

Catalog additions (propagate once, never per-bundle inlines) — these are the
**content-side** additions that the commerce ten never needed, so they seed the
[CATALOG-ADDITIONS](../CATALOG-ADDITIONS.md) pass:

- **`headline_list`** — an imageless post list: per row a category tag + headline (bound `title`/`url`) + byline, hairline-divided. Bound to a `blog_post` source, N items. The fast-scan counterpart to the image grid.
- **`section_rail`** — a taxonomy-scoped feed row: section header (bound category name) + a small horizontal/stacked list of that section's latest posts + a "See More" link to the archive. Repeatable per section on the home page.
- **`most_popular`** — a ranked (numbered) list of posts from a "popular/most-read" source; the sidebar social-proof module. (Needs a `popular` post source, or falls back to `recent`.)
- **`article_header`** — rubric + headline + byline row (author link + avatar + relative timestamp + read-time). The article-page counterpart to `buy_box`'s identity block. Binds `title`, `category`, `author`, `publishedAt`.
- **`blog_post_grid` feed-card variant** — confirm the existing grid can render the TechCrunch card anatomy (colored category **tag**, byline, **relative timestamp**) not just title+image+excerpt; add the tag + timestamp slots if missing.
- **`promo_band` dismissible variant** — a closable announcement strip (needs a dismiss behavior; static fallback if the behaviors runtime isn't present, matching the countdown precedent from the commerce set).
- **Sticky sidebar layout** — confirm the home + article templates can express a **wide-content + narrow-sticky-sidebar** two-column shell via catalog layout sections (or add a `content_with_sidebar` layout). This is the one structural pattern the commerce PDP's single sticky buy-box doesn't quite cover.
