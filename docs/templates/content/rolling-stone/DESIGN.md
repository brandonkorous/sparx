# Rolling Stone — design study → `sparx-culture-bold`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06
**Reference:** Rolling Stone — https://www.rollingstone.com (secondary: Variety — https://variety.com). Both now sit behind a Tollbit AI-crawler tollgate (307 → **402 Payment Required**) that blocks automated capture — same posture as the Condé Nast titles in the commerce set; studied from the live archetype + knowledge, visual pass to `./images/`.
**Archetype:** Bold entertainment & pop-culture magazine — a loud masthead, **heavy condensed display headlines**, a high-energy dense grid saturated with music/celebrity imagery, one **hot accent** on a black ground, signature **ranked lists** ("100 Greatest…"), and video/audio embeds. The high-voltage opposite of the New Yorker.
**sparx slug:** `culture-bold` · **Example vertical:** music & pop-culture magazine · **Theme:** bespoke — `amplitude` (see §6; closest presets `press` inverted / `wire`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

Rolling Stone is the defining **bold culture magazine**: a black-grounded, hot-accented, condensed-display grid that reads as loud, current, and opinionated — the energy of a concert poster applied to journalism. It anchors our content set as the **entertainment / pop-culture** archetype, the deliberate opposite of the New Yorker's serif restraint and of TechCrunch's utilitarian monochrome. Where the New Yorker whispers in paper-and-serif and TechCrunch optimises for scan-speed, Rolling Stone **shouts in condensed all-caps over full-bleed imagery** and organises identity around two things the other two never lean on: **star-power photography** and the **ranked list** ("100 Greatest Guitarists," "500 Greatest Albums"). It is the cleanest study of how a **dark ground + one saturated hot hue + heavy condensed type** reads as attitude, and how a **numbered countdown feature** becomes a whole content format. Variety is the same archetype in a trade-news register — the same bold grid and hot accent, tilted toward industry reporting — so it validates the pattern rather than changing it. This is the template every music, film, culture, nightlife, or fan-media site needs.

## 2. Screenshots

Captured to `./images/` (manual pass — automated capture is Tollbit-gated: `rollingstone.com`/`variety.com` 307-redirect to `tollbit.*` which answers 402).

- `home-fold.png` — Top fold: bold wordmark masthead (near-black bar) + horizontal section nav (Music / TV & Movies / Culture / RS Charts / Lists), a **full-width feature band** — one full-bleed image with a huge condensed headline + category kicker overlaid — then the lead grid begins.
- `home-full.png` — Full scroll: feature band → **lead grid** of large image cards (hot category tag + heavy condensed headline + byline + relative timestamp) → **per-section rails** (Music, Screen, Culture) each with a "More" link → a **ranked-list promo** ("The 100 Greatest…" countdown teaser) → **most-read** ranked sidebar → newsletter band → light **merch/tickets** strip.
- `nav.png` — Header + menu: dark bar, wordmark, horizontal section nav, search, subscribe/newsletter utility; mobile hamburger → full section list + social row.
- `article.png` — Single culture story: category rubric, **oversized condensed headline**, dek, byline + avatar + timestamp + read-time, a full-bleed lead image with caption, single-column body with **inline media embeds** (a music player / video card) and a **pull-quote**, tag chips, related-reading rail, most-read sidebar.
- `list.png` — **The signature page:** a ranked listicle ("The 100 Greatest…") — an intro band, then numbered entries each with a big rank number, image, entry title, and a short blurb; sticky "jump to rank" / pager; share rail.
- `archive.png` — Category/archive: section masthead (Music / Screen / Culture) over the same dense card grid filtered to one taxonomy, load-more.
- `footer.png` — Footer: dark multi-column link map (Sections · Company · Follow · Legal), newsletter capture, social row, copyright.

## 3. Design language

- **Palette:** **Near-black ground, near-white ink, one hot accent.** The page ground is a true near-black `#0A0A0A`; ink is a bright near-white `#F5F5F5`; a single **saturated hot hue** (Rolling Stone's is a pure red, but the _strategy_ is one voltage-hot color) carries category tags, links, rank numbers, the section-rail "More" links, and the primary CTA. Everything else is monochrome on black — the accent is the entire palette's worth of color, spent deliberately. Mood: loud, current, high-contrast, after-dark. (Variety runs the same black-ground + hot-red logic in a trade register.)
- **Typography:** **Heavy condensed display, weight- and case-driven.** Headlines are a **tall, tight, near-black-weight condensed** face set in **ALL CAPS or tight sentence case** at large sizes (a Druk / Anton / Bebas-compressed feel) — the single loudest identity signal. Body is a clean neutral grotesque at a comfortable reading size. Category tags are small, uppercase, tracked, and **filled with the hot accent**. Rank numbers on lists are enormous. The condensed display is the voice — the exact inversion of the New Yorker's serif.
- **Imagery:** **Star-power photography, full-bleed and cropped tight.** Big, high-energy music/celebrity/performance images; the feature band and article lead go **full-bleed**; grid cards run 16:9 / 3:2 with the image doing the pulling. Frequent **portrait crops** and **live-performance frames**. Imagery is a statement, not a locator — the opposite of TechCrunch's utilitarian thumbnails. (Ours: royalty-free / original performance + culture imagery, never any RS/Variety photography.)
- **Shape & density:** **Small radius, edge-to-edge bands, tight rhythm.** Cards and tags carry a small radius; separation on the dark ground comes from **base-tone shifts + hairline borders**, not shadow. High density — many cards above the fold — punctuated by full-width feature/list bands that break the grid. Generous only at section headers and the list intro.
- **Motion:** **Kinetic but restrained** — sticky dark header, hover lift/zoom on image cards, autoplaying/scroll-triggered media embeds inside articles, a "jump to rank" pager on lists. Content velocity + big imagery carry the energy; no gratuitous carousels on the feed.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Optional slim strip — a subscribe/newsletter or event promo — on the dark ground.
- **Header / nav:** **Bold wordmark masthead** on a near-black bar; **horizontal section nav** (Music, TV & Movies, Culture, Charts, Lists) as primary wayfinding; search + subscribe/newsletter utility right; social row + full section list under the mobile hamburger. Sticky, solid, dark.
- **Hero:** A **full-width feature band** — one full-bleed image with a big condensed headline + category kicker + byline overlaid — a single curated loud feature, _not_ a recency river. It's the concert-poster opening statement, then the grid takes over.
- **Homepage section sequence** (this IS the blueprint's home composition):
  1. **Feature band** — full-bleed image + oversized condensed headline + category + byline (the loud curated lead).
  2. **Lead grid** — large image cards (hot category tag + heavy condensed headline + byline + relative timestamp) of the newest / editor-picked stories.
  3. **Section rails** — repeated per section (Music, Screen, Culture): a section header + a row of that topic's latest + a **"More"** link to its archive.
  4. **Ranked-list promo** — a teaser band for a signature countdown ("The 100 Greatest…") linking to the list page — the format that defines this archetype.
  5. **Most-read sidebar** (runs alongside 2–4): a **numbered ranked list** of popular stories (social proof), plus quick section links.
  6. **Newsletter band** — the primary conversion, styled loud on the dark ground.
  7. **Merch / tickets strip** _(optional light commerce)_ — a small row of shop products / event tickets, demoing content **and** commerce on one site.
  8. **Footer** (below).
- **Article anatomy** (the "PDP" of this publisher): category **rubric** → **oversized condensed headline** → **dek** → **byline row** (author link + avatar + relative timestamp + read-time) → **full-bleed lead image + caption** → **single-column body** with **inline media embeds** (audio player / video card), inline links, and a **pull-quote** breaking the column → **tag chips** → **related-reading** rail → **most-read** sidebar persists. Conversion is subscribe/newsletter (+ optional merch/ticket callout), not a buy-box.
- **List / ranked feature** (the signature page): an **intro band** (title + dek + byline) → **numbered entries** each = big rank number + image + entry title + short blurb, descending or ascending → sticky **"jump to rank" pager** + share rail. This is the archetype's defining format and gets its own catalog section (see §7).
- **Archive / category feed:** a **section masthead** (Music / Screen / Culture + description) over the same dense card grid filtered to that taxonomy, load-more. Author pages = author bio header + that author's stories in the same grid.
- **Footer:** dark **multi-column link map** (Sections · Company · Follow · Legal), newsletter capture, social row, copyright bar.

## 5. Signature interaction patterns

1. **Condensed-display + hot-accent-on-black:** oversized condensed headlines and hot-filled category tags on a near-black ground. Reproduce the type + the single hot accent on black and the "loud culture magazine" feel comes for free — it's the whole identity in two tokens.
2. **The ranked countdown ("100 Greatest…"):** a numbered list feature with big rank numbers, an image and a blurb per entry, and a jump-to-rank pager — a content _format_, not just a page. It's the single most recognisable thing this archetype does and the commerce set never needed it.
3. **Full-bleed feature band breaking a dense grid:** the home and article leads go edge-to-edge with a huge headline over the image, then the tight card grid resumes — two densities (statement + firehose) alternating down the page.
4. **Media-embedded articles:** culture stories carry **inline audio/video players** (a track, a trailer, a performance) as first-class body blocks — the article is a mixed-media object, not just text.

## 6. The sparx translation

- **Theme:** **bespoke — `amplitude`** (closest shipped: `press` inverted / `wire`). A **near-black-ground, one-hot-accent, condensed-display** culture theme. This is the set's first **dark** default ground, so the four surfaces invert relative to the light exemplars.
  - **Grounds (4 surfaces):** `base-100` page = `#0A0A0A` (near-black); `base-200` raised card/band ground = `#161616`; `base-300` hairline borders/dividers = `#262626`; `base-content` ink = `#F5F5F5` (bright near-white). A secondary muted ink `#A3A3A3` for meta/timestamps — still above the readable floor (RULE #3: meta is legible, not faded to nothing).
  - **Primary / accent strategy:** **one saturated hot hue** — a voltage crimson-magenta `oklch(~63% 0.24 12)` (≈ `#FF1F4B`), deliberately distinct from both RS's pure red and sparx's own Ember `#E04631`. Used ONLY on category tags (filled, white ink), links, rank numbers, section-rail "More," and the primary subscribe/CTA. Everything else is monochrome on black. (Confirm via catalog-sweep AA: as a **fill** with white ink at tag/button sizes, and as **text** on `#0A0A0A` at link/rank sizes — a hot hue at ~63% lightness clears AA on near-black, but verify at small tag copy.)
  - **Fonts:** **display = a heavy condensed grotesque** (a Druk / Anton / Bebas-compressed feel — tall, tight, near-black weight) for headlines, rubrics, and rank numbers, set large and often uppercase/tracked; **body = a clean neutral grotesque** at the readable floor (16px min; lists/deks lean 17–18px). Category tags uppercase + tracked. The condensed display token is the single most important identity choice — the loud counterpart to the New Yorker's serif pairing.
- **Section mapping:**

  | Rolling Stone homepage band                   | sparx catalog key                                              |
  | --------------------------------------------- | -------------------------------------------------------------- |
  | Header masthead (dark) + footer               | `sparx_layout` (silica frame navbar/footer, dark theme)        |
  | Full-bleed feature band (headline over image) | **NEW: `feature_band`** (full-bleed lead, overlaid headline)   |
  | Lead grid (large image cards)                 | `blog_post_grid` _(feed-card variant — shared, §7)_            |
  | Per-section rail + "More"                     | `section_rail` _(shared w/ TechCrunch — taxonomy row)_         |
  | Ranked-list promo ("100 Greatest…" teaser)    | **NEW: `ranked_list`** _(promo/teaser mode)_                   |
  | Most-read sidebar (numbered)                  | `most_popular` _(shared w/ TechCrunch — ranked list)_          |
  | Newsletter band                               | `newsletter_signup` _(subscribe-CTA variant)_                  |
  | Merch / tickets strip (optional)              | `product_grid` / `product_rail` _(existing commerce sections)_ |

  **Article:** rubric + condensed headline + dek + byline → `article_header` _(bold/culture variant of the shared header — oversized condensed headline)_; full-bleed lead → the header's `lead:'full-bleed'` treatment; body → `article_body`; inline audio/video → **NEW: `media_embed`** block; quote → `pull_quote` _(shared)_; related → `blog_post_grid`; tags → tag chips. **List page:** `ranked_list` _(full/countdown mode)_ + `collection_header` intro. **Archive:** `collection_header` (content variant) + `blog_post_grid` filtered by taxonomy + load-more.

- **Example business:** **Static** — a **music & pop-culture magazine** ("Turn it up."). Seeds **~22 `cms.blog_post` records** across four sections — **Music, Screen (TV & Movies), Culture, Lists** — each with a category, author, timestamp, full-bleed lead image, dek, and a 5–10-paragraph body (several carrying an inline `media_embed` and a `pull_quote`), so the feature band, lead grid, section rails, most-read, article page, and archives all render real. **2–3 of the 22 are ranked-list features** ("The 50 Greatest Debut Albums," "25 Films That Rewired Pop Culture," "The 40 Best Live Sets of the Decade") with **~12–20 numbered entries each** so the signature list page renders with real depth. **~6 author records** with bios + avatars (author pages + bylines resolve). Taxonomy = the four sections + a handful of tags (interviews, reviews, festivals, oral-history). **Light commerce slice:** a small **Static Shop** (~6 merch SKUs — tees, vinyl, tote) + **~3 event/ticket** entries, wired to the merch/tickets strip — a clean content **and** commerce demo, content still the spine.
- **Design freedom used (tenant-only affordances):** the **dark near-black ground** as the site default; a **heavy condensed display face** loaded by the tenant theme; **full-bleed feature/article imagery**; **inline media embeds** (audio/video players) as body blocks; **image-card hover lift/zoom**. None require shadow/glass/gradient as chrome — the look is dark ground + hot accent + condensed type + big photography — but all of these are exactly the tenant-only latitude sparx's own surfaces would forbid ([[feedback_design_restraints_are_sparx_only]]).
- **Deliberate departures:** vertical stays a general music/pop-culture magazine (avoids leaning on any one artist or genre); **no Rolling Stone or Variety wordmark, no RS red, no "RS Charts"/section naming, no trademarked typeface, no their photography**; the hot accent is our voltage crimson-magenta, not RS red; the paywall/subscribe becomes a generalised subscribe + newsletter band (no hard paywall shipped); commerce stays a _light optional_ strip, never the spine.

## 7. Build notes / catalog gaps

Catalog additions (propagate once, never per-bundle inlines). Several are **shared with the TechCrunch / New Yorker teardowns**, so they land once in [CATALOG-ADDITIONS](../CATALOG-ADDITIONS.md) and every template reuses them; only the genuinely archetype-unique ones are new here.

- **`ranked_list`** _(NEW — the signature add)_ — a numbered countdown feature: bound to a `blog_post`'s ordered entry set (or a dedicated list source), each entry = a **big rank number** + image + entry title + short blurb, with an **ascending/descending** order prop and a **`mode`** of `promo` (a home-page teaser: title + top-N preview + "See the full list") vs `full` (the whole list page with a jump-to-rank pager). This is the format that defines the archetype and the commerce set + other content docs never needed.
- **`feature_band`** _(NEW)_ — a **full-bleed** lead: one image edge-to-edge with an overlaid **oversized condensed headline** + category kicker + byline, bound to a single `blog_post`. The loud, statement-making counterpart to `lead_story` (New Yorker) — same "one ranked feature" job, opposite volume (full-bleed + overlaid vs. framed serif). Confirm whether `lead_story` can carry a `treatment:'full-bleed-overlay'` prop instead of a whole new section; if the overlay + condensed-headline styling is more than a variant, ship it standalone.
- **`media_embed`** _(NEW — article body block)_ — an inline audio/video player card inside `article_body`: a bound embed URL/provider (a track, a trailer, a performance) rendered as a first-class body block with a caption, not raw HTML. The mixed-media article is core to this archetype; the reading-only exemplars never needed it. (Static fallback = a poster image + external link if the behaviors/media runtime isn't present, matching the countdown/dismiss precedents.)
- **`article_header` bold/culture variant** _(shared — extends the existing add)_ — the shared `article_header` needs an **oversized condensed headline** treatment and a **`lead:'full-bleed'`** option (full-bleed lead image with overlaid rubric/headline), alongside the TechCrunch news variant and the New Yorker serif/longform variant. One section, three variants driven by the theme's `font-heading` + a `lead` prop.
- **`blog_post_grid` feed-card variant** _(shared)_ — reuse as-is; confirm it renders the loud card anatomy on a **dark ground** (hot-filled category tag + condensed headline + byline + relative timestamp) and supports a **hover lift/zoom** — a tenant-only affordance, so gate it as an opt-in card behavior.
- **`section_rail`** _(shared w/ TechCrunch)_ — reuse verbatim (taxonomy-scoped row + "More" link); no change beyond dark-theme styling.
- **`most_popular`** _(shared w/ TechCrunch)_ — reuse verbatim (numbered most-read sidebar list).
- **`pull_quote`** _(shared w/ New Yorker)_ — reuse verbatim; confirm the large-quote treatment reads on the dark ground with the condensed display face.
- **`newsletter_signup` subscribe-CTA variant** _(shared w/ New Yorker)_ — reuse; the conversion band styled loud on `base-100` dark.
- **Dark-theme + condensed-display token support** — this is the first bundle whose **default ground is dark** and whose **`font-heading` is a heavy condensed** face. Confirm (a) the theme token bag carries a dark 4-surface set cleanly through navbar/footer/cards, (b) `font-heading` loads a condensed display without breaking line-height/tracking in existing sections, and (c) the **catalog-sweep AA** passes for the hot accent as both a fill (white ink) and as text on near-black at tag/link/rank sizes. The whole look leans on these three, exactly as the New Yorker leaned on serif-across.
- **Commerce-on-content wiring** — confirm the existing commerce sections (`product_grid` / `product_rail` / a tickets/event list) drop into a **content** blueprint's home + article without assuming a full storefront spine, so the optional Static Shop / tickets strip renders as a light slice rather than pulling in the whole shop surface.
