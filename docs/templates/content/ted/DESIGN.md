# TED — design study → `sparx-ideas-talks`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06
**Reference:** TED — https://blog.ted.com + https://www.ted.com (structure captured 2026-08-06 via fetch; talk-library + talk-page anatomy from the live archetype + knowledge; visual pass to `./images/`)
**Archetype:** Ideas / talks video-forward knowledge hub — a bright single accent on a clean light ground, video/talk cards (thumbnail + speaker + duration), an ideas blog, a topics/themes browse, an events module, and a mission-driven nonprofit voice.
**sparx slug:** `ideas-talks` · **Example vertical:** ideas & talks nonprofit · **Theme:** bespoke — `podium` (see §6; closest presets `signal` / `press`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

TED is the defining **ideas-and-talks knowledge hub**: a nonprofit media brand whose
spine is not text posts but **video** — a talk is the atomic unit, and every surface is
built to surface, browse, watch, and share one. It anchors our content set as the
**video-forward** archetype, the one surface the feed (TechCrunch) and the reading page
(New Yorker) never exercise: a **talk-card library** (thumbnail + play affordance +
speaker + duration), a **watch page** (embedded player + speaker bio + transcript), a
**topics/themes browse**, and an **events/upcoming** module, all wrapped in an
**optimistic, mission-driven** voice where a single bright accent does the energy work
on an otherwise clean white ground. It is the cleanest study of how a content site
whose product is **media, not prose** organises itself — the template every nonprofit,
conference, video series, course library, podcast network, or ideas org needs.

## 2. Screenshots

Captured to `./images/` (manual visual pass).

- `home-fold.png` — Top fold: light header (wordmark left + Watch / Read / Topics / Events / About nav, Newest/Popular filter, search) over a **featured-talk hero** — a large video poster with a play affordance, the coral accent on the play button + topic tag, talk title, speaker byline, and duration.
- `home-full.png` — Full scroll: featured talk → **talk-card grid** (the "watch" river — poster + duration badge + speaker + title, coral topic tags) → a **topics/themes browse** tile block → an **ideas blog** rail (text-forward posts) → **upcoming events** list → a **donate / membership** CTA band → newsletter → footer.
- `nav.png` — Header + mobile menu: wordmark left, horizontal primary nav (Watch, Read, Topics, Events, About), Newest/Popular toggle + search right; a **Donate** button as the visible mission conversion; hamburger → full nav on mobile.
- `talk.png` — **The watch page** (signature): full-width **media hero** — embedded video / poster + big title + speaker byline + duration + event/date meta + topic tags; below, a **Details / Transcript / Notes** tab set, a **speaker bio** card (portrait + bio + "more talks by"), and a **related talks** grid.
- `article.png` — **Idea post** (the text sibling of the talk): rubric/topic + headline + byline + date + lead image, single-column body at a comfortable measure, inline media, related-reading rail, newsletter.
- `topic.png` — **Topic / theme archive:** topic masthead (name + description) over a talk-card grid + idea posts filtered to that theme, load-more.
- `speaker.png` — **Speaker / author page:** portrait + bio header + their talks (card grid) and idea posts.
- `footer.png` — Footer: multi-column link map (Watch · Read · Topics · About · Follow), newsletter capture, social row (video-platform-forward), donate reminder, copyright.

## 3. Design language

- **Palette:** **Clean white, one bright coral accent.** Page ground pure/near-white; ink near-black `#111214`; a single **energetic coral/red** (TED's is a red `~#E62B1E`, but the _strategy_ is **one optimistic warm accent on white**) carried on the play affordance, topic tags, links, active nav, duration badges, and the Donate CTA. Everything else is monochrome; the coral is what makes the site feel alive and hopeful. Color otherwise comes from the **talk thumbnails** (portraits/stage photography), not chrome. Mood: bright, optimistic, curious, generous.
- **Typography:** **All sans, confident and friendly.** A clean humanist/geometric sans throughout — no serif. Hierarchy from **weight and size**: heavy bold talk/idea titles, medium speaker bylines, small tracked uppercase topic tags, a lighter grey for duration + date meta (still above the readable floor). Titles are tight-leading, 2–3 lines. The tone is warmer and rounder than TechCrunch's utilitarian grotesque — this is a nonprofit that wants you to lean in, not a wire.
- **Imagery:** **Video-forward — the thumbnail is the hero.** Every talk card leads with a **16:9 poster** (speaker on a stage, portrait, or subject still) carrying a **duration badge** and a **play affordance**; the watch page embeds a real player. Idea posts use a single landscape lead image. Art is the color of the page; chrome stays neutral so the thumbnails pop.
- **Shape & density:** **Soft-medium radius** on cards/posters/tags (friendlier than a news wire's sharp corners), a **play-button circle** as a recurring motif, generous card gaps, comfortable section padding. A responsive card grid (3–4 up desktop → 2 → 1). Separation by ground-shift + gap; **shadow is allowed here** (tenant surface) to lift the video cards off the white — a subtle elevation that reads as "clickable media."
- **Motion:** **Media-forward but restrained** — poster → hover reveals the play affordance / a subtle scale, the embedded player is the real motion, a sticky-ish header, load-more on archives, Newest/Popular re-sort. No autoplay walls, no carousels-for-carousels'-sake. The video IS the motion.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** Optional slim mission/event strip ("TED2027 tickets open" → generalised to the tenant's upcoming event) — closable, low-key.
- **Header / nav:** **Wordmark left**; horizontal primary nav (**Watch · Read · Topics · Events · About**) as the wayfinding — note it splits **Watch (video)** from **Read (blog)**, the defining move of a talks hub; a **Newest / Popular** sort toggle + **search**; a prominent **Donate** button as the visible nonprofit conversion. Sticky, solid, light.
- **Hero:** A **featured talk** — one ranked video: large poster + play affordance + topic tag + title + speaker byline + duration. Curated (an editor's pick), not pure recency — the front leads with _a talk worth watching now_.
- **Homepage section sequence** (this IS the blueprint's home composition):
  1. **Featured talk** — a single ranked video hero (poster + play + topic + title + speaker + duration).
  2. **Talk-card grid** ("Watch") — the video river: 3–4-up poster cards, each duration badge + speaker + title + coral topic tag, Newest/Popular sortable. The homepage's center of gravity.
  3. **Topics / themes browse** — a tile block of the site's themes (Technology, Society, Design, Nature, …), each linking to its archive. A talks hub browses by _theme_ as much as by recency.
  4. **Ideas blog rail** ("Read") — a text-forward row of the latest idea posts (lead image + topic + headline + byline), demoting prose beneath video but keeping it first-class.
  5. **Upcoming events** — a dated event list (event + date + place + register), the conference/gathering side of the mission.
  6. **Donate / membership CTA band** — the nonprofit conversion, in-voice ("Ideas are worth spreading — help us keep them free").
  7. **Newsletter** — daily-talk-style capture.
  8. **Footer.**
- **Talk / watch anatomy** (the signature "PDP" of this template): **media hero** (embedded player or poster + title + speaker byline + duration + event/date meta + topic tags) → a **Details / Transcript / Notes** tab set (description, a timestamped transcript, reading-list/footnotes) → a **speaker bio** card (portrait + bio + "more talks by this speaker") → a **related talks** grid (same-topic video cards) → newsletter/donate. The conversion is **watch + share + donate**, never a buy-box.
- **Idea post anatomy** (the text sibling): topic **rubric** + headline + **byline row** (author + avatar + date + read-time) + lead image + caption + **single-column body** at a comfortable measure with inline media + **related reading** rail + newsletter. The New Yorker/TechCrunch article, in this theme's voice.
- **Archive / topic feed:** a **topic masthead** (theme name + description) over a talk-card grid **and** idea posts filtered to that theme, load-more. Speaker/author pages = portrait + bio header + that person's talks (cards) and posts.
- **Footer:** **multi-column link map** (Watch · Read · Topics · About · Follow), newsletter capture, a video-platform-forward social row, a donate reminder, copyright.

## 5. Signature interaction patterns

1. **The talk card:** 16:9 poster + **play affordance** + **duration badge** + speaker name + title + coral topic tag — the single unit that makes the site read as _video, not text_. Reproduce this card and the "talks hub" feel comes for free. It is genuinely new: the commerce set's product card and the news set's post card both lack the play + duration semantics.
2. **Watch page = player + transcript + speaker:** the embedded media hero, the **transcript tab**, and the **speaker bio with "more talks by"** are the three things that make a watch page feel like TED rather than a blog with a video in it. The transcript especially — a talks hub is accessible + searchable because the words are on the page.
3. **Watch / Read split + Topics browse:** the nav separates **video** from **prose** and offers a **theme browse** as a peer to recency — the site is a _library organised by idea_, not one reverse-chron feed.
4. **One bright accent as energy on white:** a single coral does all the "alive/optimistic" work — play buttons, tags, links, Donate — against otherwise monochrome chrome, so the thumbnails carry the color. The restraint is what keeps it from looking like a video store.
5. **Mission conversion, not commerce:** **Donate / become a member** is the visible CTA (chrome + a home band), the nonprofit's version of the subscribe gate — content stays free, support is the ask.

## 6. The sparx translation

- **Theme:** **bespoke — `podium`** (closest shipped: `signal` / `press`). A **clean-white, one-coral, video-forward** theme with a friendlier radius than the news wire.
  - **Grounds (4 surfaces):** `base-100` page = `#FFFFFF` (clean white); `base-200` muted card/section ground = `#F5F6F7` (the ground the topic-browse + events bands sit on); `base-300` hairline dividers / card edges = `#E6E8EA`; `base-content` ink = `#111214`.
  - **Primary / accent strategy:** **one bright coral** `oklch(~64% 0.18 32)` (a warm coral-red, deliberately more _orange_ than the New Yorker's editorial red at hue ~27 so the set stays distinct) used ONLY on the play affordance, topic tags, links, active nav, duration badges, and the Donate CTA. Confirm it clears catalog-sweep AA at **tag fills with white ink**, **links on white**, and **the Donate button**; on a poster overlay the duration badge sits on a dark scrim, not raw coral, to hold contrast. No second brand hue — thumbnails carry all other color.
  - **Fonts:** display + body = a single **warm humanist/geometric sans** (Inter/Söhne with a touch more roundness — a friendly, optimistic grotesque, not a wire's neutral one); titles heavy; topic tags uppercase + tracked; duration + date meta in a lighter grey but kept above the readable ink floor (RULE #3 — meta is legible, not faded to nothing). Body comfortably ≥16px.
- **Section mapping:**

  | TED homepage / template band                         | sparx catalog key                                              |
  | ---------------------------------------------------- | -------------------------------------------------------------- |
  | Header nav (Watch/Read/Topics/Events/About) + footer | `sparx_layout` (silica frame navbar/footer)                    |
  | Slim mission/event strip                             | `promo_band` _(dismissible variant — shared, TechCrunch)_      |
  | Newest / Popular sort toggle                         | control on the grids _(sort binding — see §7)_                 |
  | Featured talk hero                                   | **NEW: `featured_talk`** (video variant of `lead_story`)       |
  | Talk-card grid ("Watch")                             | **NEW: `talk_card_grid`** (poster + play + duration + speaker) |
  | Topics / themes browse tiles                         | **NEW: `topics_browse`** (taxonomy tile grid)                  |
  | Ideas blog rail ("Read")                             | `blog_post_grid` _(editorial-card variant — shared)_           |
  | Upcoming events                                      | `event_list` _(shared — TechCrunch)_                           |
  | Donate / membership CTA band                         | **NEW: `donate_band`** (mission CTA + amount presets)          |
  | Newsletter                                           | `newsletter_signup`                                            |

  **Watch page:** media hero → **NEW: `talk_hero`** (embedded player/poster + title + speaker byline + duration + event meta + topic tags); Details/Transcript/Notes → **NEW: `transcript_block`** (tabbed: description + timestamped transcript + reading list); speaker bio → **NEW: `speaker_bio`** (portrait + bio + "more talks by"); related → `talk_card_grid` (same-topic source). **Idea post:** rubric + headline + byline → `article_header` (shared); body → `article_body`; related → `blog_post_grid`. **Topic archive:** `collection_header` (content variant) + `talk_card_grid` + `blog_post_grid` filtered by theme + load-more. **Speaker page:** `speaker_bio` header + `talk_card_grid` + `blog_post_grid` filtered by author.

- **Example business:** **The Commons** — an **ideas & talks nonprofit** ("Ideas worth sharing, free for everyone"). Seeds ~18 `cms.blog_post` records split into **two content shapes** on one model (a `format` field or a `talk` tag distinguishes them):
  - **~11 talk records** (the video spine) — each with a topic, a speaker (author), a **duration**, a poster image (royalty-free stage/portrait placeholder), a video-embed/poster URL placeholder, a 1–2 paragraph description, and a **transcript** body, so the featured talk, talk-card grid, watch page, transcript tab, related talks, topic archives and speaker pages all render real. Sample talks: _"The quiet power of doing less"_ (Society), _"What a river taught me about time"_ (Nature), _"Designing for the next hundred years"_ (Design), _"The math of second chances"_ (Science), _"Why your city should be walkable"_ (Society), _"A small grid, a big idea: community solar"_ (Technology), _"The forgotten art of listening"_ (Society), _"How coral reefs come back"_ (Nature), _"Teaching machines to say 'I don't know'"_ (Technology), _"The economics of kindness"_ (Business), _"What we owe the people after us"_ (Global Issues).
  - **~7 idea posts** (the "Read" side) — text-forward pieces (a topic, author, date, lead image, 5–9 paragraph body): _"Notes from a week of listening tours,"_ _"Five ideas that changed how we build,"_ _"The case for slow science,"_ _"What our speakers are reading this month,"_ _"Behind the stage: how a talk gets made,"_ _"Announcing The Commons 2027,"_ _"How community solar took root in three towns."_

  **~8 speaker/author records** with portraits + bios (so bylines, speaker pages, and "more talks by" resolve — most speakers own a talk _and_ may author an idea post). **Taxonomy = 8 topics/themes:** Technology, Science, Society, Design, Nature, Health, Business, Global Issues (+ a few series tags like "Live from The Commons 2026"). **Events:** ~3 upcoming records (a flagship gathering, a salon, a workshop) so `event_list` renders. **Light commerce slice (content + commerce demo):** a **membership / donation** product (one recurring "Member" tier + one-time donation amounts) wired to the `donate_band` and the chrome Donate button — the nonprofit's real conversion, demoing content **and** commerce on one site while content stays the spine.

- **Design freedom used (tenant-only affordances):** **video embeds** (the watch-page player and poster hovers — a real `<iframe>`/media node the sparx app surfaces would never carry); a **bright saturated accent** used generously (play buttons, tags, Donate) where sparx's own surfaces earn color more sparingly; **soft shadow / elevation** to lift the video cards off the white ground (a shadow-as-device use that the no-shadow restraint forbids on sparx surfaces but is fine on a tenant site per [[feedback_design_restraints_are_sparx_only]]); a **play-affordance / duration-badge overlay** on thumbnails.
- **Deliberate departures:** vertical is a **general ideas nonprofit** (avoids any one industry — not "tech talks"); **no TED logo, name, red-block wordmark, the literal TED red, or the "Ideas worth spreading" tagline** — our coral, our wordmark, our "Ideas worth sharing." The talk player is a **poster + embed placeholder**, not a hosted video service; the paywall/registration walls are dropped — content stays free, the ask is **donate/membership**. "Newest/Popular" is a sort, not two separate feeds.

## 7. Build notes / catalog gaps

Catalog additions (propagate once, never per-bundle inlines). Several are **shared with the
TechCrunch + New Yorker teardowns** (`promo_band`, `event_list`, `blog_post_grid`,
`article_header`, `article_body`, `newsletter_signup`, `collection_header`) and land once
in [CATALOG-ADDITIONS](../CATALOG-ADDITIONS.md); the rest are **genuinely new to the
talks-hub archetype** and are this doc's contribution:

- **`talk_card_grid`** — the defining add: a video-card grid bound to a `blog_post`/talk source, each card = **16:9 poster + play affordance + duration badge + speaker name + title + coral topic tag**. Needs new bound slots the news/commerce cards lack: `duration`, `speaker` (→ author), `posterUrl`, and a `play`/`isVideo` treatment. Sortable Newest/Popular. This is the homepage center of gravity and the related/archive/speaker grid.
- **`featured_talk`** — a single ranked video hero: bound talk → large poster + play + topic tag + title + speaker byline + duration, a `size:'feature'` treatment distinct from a grid card (the video counterpart to `lead_story`; confirm one section can serve both with a `media:'video'` prop).
- **`talk_hero`** — the watch-page media hero: an **embedded player / poster** node (tenant video-embed affordance) + title + speaker byline + duration + event/date meta + topic tags. The talk-page counterpart to `article_header`; carries a real media embed the article header never does.
- **`transcript_block`** — a tabbed **Details / Transcript / Notes** module: description, a **timestamped transcript** (paragraphs with optional `[mm:ss]` cues), and a reading-list/footnotes list. Renders the talk body as accessible, scannable text — the thing that makes a talks hub searchable. New; the commerce + prior content sets never needed a transcript surface.
- **`speaker_bio`** — a speaker/author card: **portrait + name + one-line + bio + "more talks by this speaker"** (bound to that author's talk source). Doubles as the **speaker-page header**. Richer than a byline chip — it's the person-as-first-class-entity block a talks hub needs.
- **`topics_browse`** — a **taxonomy tile grid**: one tile per theme (name + optional count/thumbnail) linking to that topic's archive. The "browse by idea" block that makes the site a library, not a feed. (Generalises to any content site that wants a themes/departments browse landing.)
- **`donate_band`** — a **mission CTA band**: heading + supporting line + **amount presets / membership tiers** + a primary Donate button, wired to the light commerce slice (recurring member tier + one-time amounts). The nonprofit conversion counterpart to the commerce set's promo bands and the content set's subscribe band; distinct in that it binds to **donation/membership** commerce, not a cart.
- **`blog_post` model carries video/talk fields** — confirm the CMS post model (or a `format` discriminator + fields) can hold `format: 'talk' | 'post'`, `duration`, `speakerId` (→ author), `posterUrl`, `videoEmbedUrl`, and `transcript`, so **one model serves both talks and idea posts** (avoids a parallel "talk" type). This is the single most important schema check — the whole template rides on it. If the model can't, add the nullable fields (they no-op for prose posts).
- **Newest / Popular sort binding** — the talk/idea grids need a **sort control** (recency vs a `popular`/most-watched signal) — same `popular` source question TechCrunch's `most_popular` raised; reuse that resolution (falls back to `recent` if no popularity signal is seeded).
- **Video-embed node (tenant media)** — confirm the builder's node/tag allowlist permits a **sandboxed video embed** (iframe/poster) on a tenant site for the watch page; if not, add it as a tenant-only media node (never on sparx's own surfaces). This is the one capability the prior two content docs didn't need.
