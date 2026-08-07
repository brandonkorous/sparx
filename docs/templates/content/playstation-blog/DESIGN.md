# PlayStation.Blog — design study → `sparx-brand-newsroom`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06
**Reference:** PlayStation.Blog — https://blog.playstation.com (structure captured 2026-08-06 via fetch; visual pass to `./images/`)
**Archetype:** Brand community newsroom — a company's first-party content arm on a true-dark ground: launch/announcement posts with big cover art, category chips (News / Games / Hardware / Guides), team bylines, a launch-cadence feed, and comment/community energy under an electric accent.
**sparx slug:** `brand-newsroom` · **Example vertical:** a product studio's community newsroom · **Theme:** bespoke — `console` (see §6; closest presets `amplitude` / `expanse`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

PlayStation.Blog is the defining **brand community newsroom**: not a news publisher covering an industry, but a **company's own content arm** — every post is first-party, launch-driven, and written to an audience that already owns the product. It anchors our content set as the **first-party brand newsroom** archetype, distinct from TechCrunch's independent-outlet feed in three load-bearing ways: (1) the content is **announcements and drops** ("available today," "out now"), not reporting; (2) it runs on a **true-dark ground with big cover art** where the product art _is_ the design, the opposite of TechCrunch's utilitarian monochrome thumbnails; and (3) the conversion is **community + product**, not a subscription — comment counts on every card, social follows, and a direct cross-link to the studio's store. It is the cleanest study of how a brand turns a **release cadence** into an ongoing content surface: a launch feed where recency reads as momentum, cover art carries the identity, category chips sort News from Guides, and a small in-house team of bylines gives a corporate voice a human face. This is the template every product studio, game/app maker, hardware brand, dev-tools company, or membership community needs — the content half of a **content + commerce** business, with the store one click away.

## 2. Screenshots

Captured to `./images/` (visual pass).

- `home-fold.png` — Top fold on a true-dark ground: logo-left header + primary nav (product lines) + login/search, then a **big cover-art lead feature** (one dominant announcement — full-width cover image, category chip, bold headline, team byline + role, date) with a row of secondary lead cards beneath.
- `home-full.png` — Full scroll: Lead Stories (feature + 3 up) → **Trending** row (4 high-engagement cards) → **Latest Posts** chronological launch feed with **Load More** → **Latest Podcast/Media** embed card → **Spotlight** highlighted drop → **Stay Connected** social band → **More from the studio** (cross-link rail to the shop / product). Cover art dominates every band; separation by ground-shift, not rules.
- `nav.png` — Header + category chips: logo left, product/section nav, **category-chip filter row** (News / Games / Hardware / Guides) that scopes the feed, search + login right, mobile hamburger → full nav.
- `article.png` — Single announcement post: category chip rubric, big headline, **team byline** (author + role + org + avatar) + date + comment count, a **full-width cover image**, then a comfortable single-column body with **inline media (gallery / video / trailer embeds)**, tag chips, a **cross-link to the related product**, and a **comments/community** section below.
- `archive.png` — Category feed (e.g. "Games"): category masthead + the same dark cover-art card feed filtered to one chip, **Load More**.
- `author.png` — Team member page: avatar + name + role + short bio, then their posts as the same dark feed.
- `footer.png` — Footer on the darkest ground: multi-column link map (Company · Support · Legal · Developers · Follow), social row, copyright + policy bar.

## 3. Design language

- **Palette:** **True-dark ground, one electric accent, cover art carries the color.** Page ground is a near-black (not grey) so full-bleed cover images glow against it; ink is near-white; a single **electric violet** accent lives on category chips, links, "Load More," active nav, and the primary CTA. Everything structural is monochrome dark — **the product cover art is where color lives**, exactly like the reference lets game key-art carry the page. Mood: premium, energetic, launch-night, first-party-official. (We take the _strategy_ — dark + one electric accent — not PlayStation blue; ours is violet.)
- **Typography:** **All sans, heavy display, weight-driven hierarchy.** A clean geometric/grotesque throughout — bold, slightly condensed announcement headlines that hold their own over cover art; medium bylines with a **role line** ("Community Lead, Launch Notes"); small uppercase tracked category chips; a lighter (but still readable) meta line for date + comment count. No serif — this is a modern product voice, not a magazine. Headlines are the second-loudest thing on screen after the art.
- **Imagery:** **Cover-art-first, full-bleed, 16:9.** Every post leads with a large landscape cover image; the feature card goes near-full-width. Art is treated edge-to-edge with a subtle dark scrim so white headline text stays legible **over** the image on the feature. Inline article media is rich: galleries, trailer/video embeds, screenshot strips. The image is the statement, not a locator.
- **Shape & density:** **Medium radius** on cards (soft, modern, console-UI feel), **no hairline rules** — surfaces separate by **ground-tone shift** (card sits on a slightly lighter dark than the page) and by the cover art's own edge. Comfortable density: fewer, larger cards than a news river — this is curated momentum, not a firehose. Generous section headers. Shadow/glow is allowed here (tenant surface) and suits the dark ground.
- **Motion:** Cover-art hover lift/scale on cards, **Load More** progressive feed, sticky solid header, autoplay-muted trailer embeds in-article, subtle accent glow on the primary CTA. Energy without carousels — the cadence of new drops is the motion.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Optional slim strip (region/login) or none — kept minimal so the feature art owns the fold.
- **Header / nav:** Logo left; **primary nav** across the studio's product lines / top sections; a **category-chip row** (News / Games / Hardware / Guides) as secondary wayfinding that scopes the feed; search + login/account right; hamburger on mobile. Sticky, solid, on the darkest ground.
- **Hero:** **No abstract hero — the hero is the lead feature.** One dominant announcement rendered as a **big cover-art card**: full-width cover image with a dark scrim, category chip, large white headline, team byline + role, date, comment count. The lead is a _curated drop_, not pure recency (an editor picks the day's headline launch), with 3 secondary lead cards beneath.
- **Homepage section sequence** (this IS the blueprint's home composition):
  1. **Lead Stories** — big cover-art feature + a 3-up row of secondary featured announcements (cover / chip / headline / byline / date / comments).
  2. **Trending** — a row of 4 high-engagement posts (same card, ordered by a "popular/most-commented" source) — the brand's version of social proof.
  3. **Latest Posts** — the **launch-cadence feed**: a chronological dark card feed of everything new, with **Load More**. This is the spine of a newsroom — recency as momentum.
  4. **Latest Media / Podcast** — a featured **media embed card** (video/podcast/trailer) — brand newsrooms are media-forward.
  5. **Spotlight** — one highlighted drop given extra room (a marquee for the current big launch).
  6. **Stay Connected** — a **social band** (follow row) — community is the conversion.
  7. **More from the studio** — a **product cross-link rail** tying the newsroom to the studio's shop / product pages (the content→commerce bridge).
  8. **Footer.**
- **Article anatomy** (the "PDP" of a brand newsroom): category **chip rubric** → big **announcement headline** → **team byline row** (author + role + org + avatar + date + **comment count**) → **full-width cover image** → **single-column body** at a comfortable measure with **inline media** (gallery, trailer/video embed, screenshot strip), callouts, and **release-info** ("Available today on…"), → **tag chips** → a **cross-link to the related product** (buy/learn-more) → a **comments/community** section. The conversion is community engagement + the product link, not a subscription.
- **Archive / category feed:** a **category masthead** (chip name + short description) over the same dark cover-art feed filtered to that taxonomy, with **Load More**. Author/team pages = an author bio header (avatar + role + bio) + their posts in the same feed.
- **Footer:** **multi-column link map** (Company · Support · Legal · Developers · Follow) on the darkest ground, a social row, policy + copyright bar.

## 5. Signature interaction patterns

1. **Big cover art on a true-dark ground:** the full-bleed product image with a dark scrim + white headline over it is the whole identity — reproduce the dark ground + cover-art feature and the "first-party launch" feel comes for free. Color comes from the art, not the chrome.
2. **Category chips that scope the feed:** the News / Games / Hardware / Guides chip row is both wayfinding and a live filter — the newsroom's primary sort, distinct from a nav.
3. **The launch-cadence feed + Load More:** a chronological drop feed where "latest" reads as momentum; comment counts on every card turn recency into community energy.
4. **Content ↔ product cross-link:** a post links to the thing it announces, and the home page ends on a rail into the studio's shop — the content+commerce bridge surfaced as design (the one pattern a pure publisher never needs).

## 6. The sparx translation

- **Theme:** **bespoke — `console`** (closest shipped: `amplitude` / `expanse`). A **true-dark, electric-violet, cover-art-forward** brand-newsroom theme.
  - **Grounds (4 surfaces):** `base-100` page = `#0B0B10` (true near-black with a faint violet cast — not grey, so cover art glows); `base-200` card/raised ground = `#14141C` (a slightly lighter dark cards sit on); `base-300` borders/dividers/hairline chrome = `#24242F`; `base-content` ink = `#F4F4F8` (near-white, AA-clean on all three dark grounds). Footer/header use a `base-100`-or-darker `#08080C` band.
  - **Primary / accent strategy:** **one electric violet** `oklch(~62% 0.20 292)` (≈ `#8B5CF6` family) — used ONLY on category chips (fill with white ink, or soft-tint outline), links, active nav, "Load More," the primary CTA, and accent glow. AA-clean as a chip fill with white ink and as a link on the dark ground (confirm both the fill+ink and the on-dark link contrast clear the catalog-sweep). No second brand hue — **cover art is the color**; the violet is the only chrome hue, kept scarce so it reads as "the accent," not a wash. Status still resolves via `statusTone()` on its own axis where a post shows state (New / Updated / Live).
  - **Fonts:** display + body = a single **clean geometric/grotesque** (Inter / Space Grotesk feel), **heavy** for announcement headlines (a slightly condensed, tight-leading display weight that holds over cover art); category chips uppercase + tracked; byline **role line** in medium; date + comment-count meta in a lighter grey-violet but kept **above the readable ink floor** (RULE #3 — meta is information, not decoration). Body at ≥16px on the dark ground (dark surfaces need a touch more size/line-height for comfort — lean 17px).
- **Section mapping:**

  | PlayStation.Blog homepage band                        | sparx catalog key                                          |
  | ----------------------------------------------------- | ---------------------------------------------------------- |
  | Header nav + footer                                   | `sparx_layout` (silica frame navbar/footer, dark)          |
  | Category-chip filter row (News/Games/Hardware/Guides) | **NEW: `category_chip_row`** (taxonomy chip filter)        |
  | Lead feature (big cover-art announcement)             | **NEW: `cover_feature`** (full-bleed cover + scrim + head) |
  | Secondary lead cards (3-up)                           | `blog_post_grid` _(cover-card / dark variant — see §7)_    |
  | Trending row (high-engagement)                        | `most_popular` _(card-row variant of the shared add)_      |
  | Latest Posts (launch feed + Load More)                | **NEW: `launch_feed`** (chronological cover-card feed)     |
  | Latest Media / Podcast embed                          | **NEW: `media_feature`** (video/podcast/trailer embed)     |
  | Spotlight (marquee drop)                              | `cover_feature` _(reused, `size:'spotlight'`)_             |
  | Stay Connected (social band)                          | **NEW: `social_band`** (follow row)                        |
  | More from the studio (product cross-link)             | **NEW: `product_crosslink_rail`** (content→commerce)       |

  **Article:** chip rubric + headline + team byline + comment count → `article_header` (**brand-newsroom variant** of the shared add — adds a `role` line + comment count + a `chip` rubric style); full-width cover → `cover_feature` (article-lead mode); body + inline media → `article_body` with **inline media embeds** (gallery / video); the announced product → `product_crosslink_rail` (single-item mode); related → `blog_post_grid` (cover-card variant); comments → `comments_block` (if the community/comments capability is present; else a static "join the discussion" CTA). **Archive:** category masthead → `collection_header` (content/dark variant) + `launch_feed` filtered by chip + Load More. **Author/team:** author bio header + `launch_feed` filtered to author.

- **Example business:** **Launch Notes** — a **product studio's community newsroom** ("Every drop, straight from the makers"). A believable, industry-agnostic studio that ships digital products/tools and runs its newsroom as the front door to the community. Seeds **~18 `cms.blog_post` records** across the four chips:
  - **News** (5) — company/announcement posts: "Launch Notes 3.0 is live today," "We're joining forces with…," "Year in review," a policy/roadmap update, a hiring/community milestone.
  - **Games / Products** (6) — the drop posts, each with big cover art: "Introducing Nimbus — our new focus timer, out now," "Aurora hits 1.0," "Meet the Field Kit," a major feature launch, a limited collab drop, a beta invite.
  - **Hardware** (3) — device/kit posts: "The Launch Notes Deck — first look," "Firmware 2.4 rolls out today," "Unboxing the Field Kit."
  - **Guides** (4) — how-tos / tips: "Getting the most out of Aurora," "5 workflows our team lives in," "Setting up your Deck," "Migrating from 2.x."

    Each post carries a category chip, a team author, a date (spread over ~6 months so the launch feed has cadence), a full cover image, a dek, a comment count, and a 5–9 paragraph body with at least one inline media block (gallery or video embed) and, where relevant, a product cross-link. **~5 author/team records** with role lines + avatars + short bios ("Community Lead," "Product Design," "Founder," "Hardware," "Developer Relations") so team pages + role bylines resolve. **Taxonomy** = the four chips (News, Games/Products, Hardware, Guides) + a handful of series/product tags (Aurora, Nimbus, Deck, Field Kit).

    **Light commerce slice (the content+commerce demo):** a small **shop** of the studio's products — ~4–6 commerce records (Aurora license, Nimbus, the Deck hardware, the Field Kit, a membership) on a **light** commerce surface — so the `product_crosslink_rail` and article product links resolve to real product pages. The newsroom (dark) is the spine; the shop (light) is the paired slice — a strong single-site demonstration of sparx running **content and commerce** together, each in its own tone.

- **Design freedom used (tenant-only affordances):** the **true-dark ground**, **full-bleed cover art with a scrim + white overlay text**, **card hover lift + subtle accent glow/shadow**, **inline video/trailer/podcast embeds**, and **medium-radius soft cards** — several of these (shadow/glow, full-bleed media, dark-on-dark) are things sparx's _own_ product surfaces forbid but tenant sites fully permit ([[feedback_design_restraints_are_sparx_only]]). This template is the clearest case in the content ten for exercising that freedom.
- **Deliberate departures:** the vertical is a **generic product studio**, never a games console maker — no PlayStation/Sony name, wordmark, PS marks, product names, cover art, typeface, or their **blue** (our accent is deliberately **violet**, chosen so it reads as _our_ electric direction, not theirs); "PS5/PS Store/PS Plus" product nav generalises to the studio's own product lines; the "Games" chip is framed as **Games/Products** so the archetype stays industry-agnostic; comments render only if the community capability is present (static CTA fallback otherwise), and the paired shop is a light demo slice, not a full storefront.

## 7. Build notes / catalog gaps

Catalog additions (propagate once, never per-bundle inlines) — this teardown is the
**dark, cover-art, brand-first** counterpart to the light editorial feeds, so it
contributes the media-forward and content↔commerce-bridge adds to the
[CATALOG-ADDITIONS](../CATALOG-ADDITIONS.md) pass. Several entries **reuse or extend
shared adds** from the TechCrunch / New Yorker teardowns rather than re-inventing them.

- **`cover_feature`** — a single ranked announcement rendered as a **full-bleed cover image** with a dark scrim and **overlaid** category chip + headline + byline + date + comment count. Bound `blog_post`. Sizes: `feature` (home lead), `spotlight` (marquee), `article-lead` (the article-page cover). The dark-newsroom counterpart to `lead_story` — confirm whether `lead_story` can gain an `overlay:true` + `scrim` mode instead of a new section (preferred: extend, don't fork).
- **`launch_feed`** — a chronological **cover-card feed** with **Load More**, bound to a recent-posts source, taxonomy-scopable (drives both the home "Latest Posts" band and the category/author archives). The brand-newsroom counterpart to TechCrunch's river; confirm it's the same section as `blog_post_grid` in "feed + load-more" mode with a **cover-card (dark)** card variant.
- **`category_chip_row`** — a horizontal **taxonomy chip filter** (News / Games / Hardware / Guides): each chip is a bound category link that scopes the feed below (client filter where the behaviors runtime is present; links to archives as the static fallback). New — the commerce set's facet filters don't cover a content-taxonomy chip strip.
- **`media_feature`** — a featured **media embed card** (video / podcast / trailer) — a bound or authored embed with a poster frame. Brand newsrooms are media-forward; the commerce/editorial sets never needed an embed-forward section.
- **`social_band`** — a **follow row** of social links/handles (the community conversion), themeable to the dark ground. Distinct from the footer social row — this is a full band mid-page.
- **`product_crosslink_rail`** — the **content→commerce bridge**: a rail that links posts to the studio's **commerce** products (single-item mode in an article; multi-item "More from the studio" mode on home). This is the one genuinely cross-module catalog add — it binds a `blog_post` (or the page) to `commerce` product records, and is the section that makes the **content + commerce on one site** story concrete. Confirm the binding vocabulary can reference a product source from a content page.
- **`article_header` brand-newsroom variant** (extends the shared add) — the TechCrunch/New Yorker `article_header` gains a **`role` line** on the byline (author + role + org), a **comment count** meta slot, and a **chip** rubric style (filled category chip vs small-caps rubric). One section, three rubric/byline modes.
- **`blog_post_grid` cover-card (dark) variant** — confirm the grid card can render the **cover-art-forward, dark-ground** anatomy (large 16:9 cover, filled category chip, role byline, date + **comment count**) — add the comment-count slot and the cover-card treatment if missing.
- **`comments_block`** — an article **comments/community** section (gated on a community/comments capability; static "join the discussion" CTA fallback, matching the dismissible-banner / countdown static-fallback precedent). Flag whether comments are in scope for the CMS module or a future capability — the template must degrade gracefully either way.
- **Dark-theme catalog sweep** — this is the first content template on a **true-dark ground**; confirm every catalog section used (nav, cards, chips, feed, footer, article header/body) renders correctly with dark `base-*` tokens and that **near-white ink on all three dark grounds** + **violet chip fill / on-dark links** clear the catalog-sweep AA. This is the analogue to the serif-everything sweep the New Yorker doc flagged — the whole look leans on the dark tokens resolving cleanly across every section.
