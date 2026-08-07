# NASA (with whitehouse.gov) — design study → `sparx-civic-portal`

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-06
**Reference:** NASA — https://www.nasa.gov (structure captured 2026-08-06 via fetch; visual pass to `./images/`) · secondary: whitehouse.gov (same government/public-service archetype, studied for the civic **service** spine)
**Archetype:** Government / public-service portal — accessibility-first, deep institutional blue, a mix of **news/updates** and **service pages** ("how do I…", departments, notices), a prominent search + an alerts banner, structured card sections, plain-language wayfinding. Trustworthy and dignified.
**sparx slug:** `civic-portal` · **Example vertical:** civic / public-agency site (a city government) · **Theme:** bespoke — `agency` (see §6; closest presets `press` / `quad`)

> Faithfulness bar: **closest clone allowed** — mimic structure AND aesthetic feel,
> sparx components + branding only, no trademarked assets. See [README](../README.md).

## 1. Why this reference

NASA is the defining **public-institution portal**: a single site that has to serve a
casual visitor, a journalist, a researcher, and a citizen looking for a specific service
— all at once, with the credibility a government body demands. It anchors our content set
as the **government / public-service** archetype. Its discipline is the opposite of a
media firehose and the opposite of a boutique reader: it is **structured wayfinding under
an accessibility mandate**. Everything is a clearly-labelled card grid, a plain-language
link, a prominent search, and an alerts channel — the design job is legibility, contrast,
and "can any person find the one thing they came for," not voice or velocity. NASA layers
mission/media richness (a strong image hero, mission cards, image-of-the-day galleries)
on top of that civic spine; whitehouse.gov shows the same spine stripped to its
government essentials (priority tiles, briefing feed, deep-blue authority). Since our
example is a **city government** (City of Rivermark), we lean the **service/civic** side —
alerts, "how do I…", departments, public notices, meetings — while keeping the
**media-rich hero and structured card sections** NASA proves. It is the template every
municipality, agency, university-facing service site, utility, library system, or
public institution needs: the one where **accessibility is the headline feature**.

## 2. Screenshots

Captured to `./images/`. NASA captures cleanly; whitehouse.gov studied for the service spine.

- `home-fold.png` — Top fold: institutional wordmark left + primary nav (Explore / News & Events / Services / Departments / About), a **prominent search** with suggested topics, an **emergency/alert banner** pinned above, then a **media-rich hero** (large image + featured headline + reading time).
- `home-full.png` — Full scroll: hero → **"How do I…" quick-services grid** (permits, pay a bill, report an issue, licenses) → **news/updates feed** (announcements, press releases) → **departments directory** (card grid) → **public-notices list** (agendas, hearings, RFPs) → **meetings & events calendar** → newsletter/notify-me signup → footer.
- `nav.png` — Header + megamenu: primary nav with a Services-first arrangement, search always visible, a language toggle, a high-contrast skip-link and mobile hamburger → full labelled section list.
- `article.png` — Single update/notice: a rubric (News / Notice / Press Release), big headline, published date + department byline, lead image + caption, single-column plain-language body, "related services" links, contact block.
- `service.png` — A **service / "how do I" page**: task title, plain-language summary, a numbered steps block, required-documents list, department + contact/hours, a primary action ("Start / Apply / Pay") and related notices.
- `department.png` — A **department page / directory**: department name, what it does (plain language), services it owns, staff/contact, its recent notices and meetings.
- `archive.png` — Category/archive (News, Notices, Departments): section masthead + a filtered card river, load-more.
- `footer.png` — Footer: link map (Services · Departments · News · About/Contact), a notify-me signup, social row, and a **civic legal/compliance row** (Accessibility, Privacy, Public Records/FOIA equivalent, Non-Discrimination), plus "last updated" metadata.

## 3. Design language

- **Palette:** **Deep institutional blue on white, one civic accent.** Page ground pure white for maximum contrast; ink a true near-black; a **deep federal-blue** primary `~#12224F` (authority, trust) carries chrome, links, headings, and primary buttons. A single warm civic accent (a flag-red `~#B22234`, used only for the **alert banner** and the most urgent action) breaks the blue for genuine urgency. Section grounds are a very light blue-grey. Mood: **dignified, clear, trustworthy, accessible** — never playful, never faded. Color is functional (blue = navigation/action, red = alert), never decorative.
- **Typography:** **All sans, high-legibility, weight-driven.** A clean humanist/neutral sans throughout (a Public-Sans / Source-Sans feel — the US-government type direction) chosen for screen legibility at every size, including small-caps rubrics. Hierarchy from **size + weight + the blue ink**, not from fading text. Headings sit in the deep blue; body in near-black at a **≥16px floor** (RULE #3 — readable ink is non-negotiable on a civic site). Generous line-height for plain-language reading.
- **Imagery:** **Documentary + civic photography** — real places, people, and services (a hero image for the "mission" feel NASA proves), plus **structured iconography** on the services grid (a recognisable glyph per task). Royalty-free / original imagery only. Crops are honest and uncropped-feeling; no heavy art direction — the image communicates, it doesn't decorate.
- **Shape & density:** **Small-to-medium radius** on cards, **clear borders and dividers** (edges do the separating, per the tenant's freedom), a **strong 12-column card grid**, generous section padding and comfortable touch targets. Everything is a labelled card or a labelled link — the whole page reads as a well-organised directory. High whitespace for scannability, but dense enough that a citizen sees their task without scrolling forever.
- **Motion:** **Minimal and calm** — sticky header, an alert banner that can be dismissed/expanded, load-more on archives, an accessible mega-menu. No autoplay, no parallax, no motion that could distract or violate reduced-motion. Restraint reads as trustworthy here.

## 4. Layout anatomy (top to bottom)

- **Announcement / utility bar:** An **emergency / alert banner** pinned above the header — the single most important civic pattern. High-contrast (red on white or white on red for a true emergency; blue for routine notices), a clear label ("Alert" / "Notice"), a headline, a link to detail, and a dismiss. Collapses to a slim strip when there's nothing urgent.
- **Header / nav:** Institutional **wordmark left**; **primary nav** arranged **services-first** (Services / How do I… · Departments · News & Events · Meetings · About/Contact); a **persistent, prominent search** with suggested topics; a **language toggle**; and an accessible **skip-to-content** link as the very first focusable element. Sticky, solid deep-blue or white-with-blue-ink. Mega-menu on desktop, full labelled list on mobile.
- **Hero:** A **media-rich featured band** (NASA's contribution): a strong civic image + a featured headline + a short dek + reading time or "posted" date, optionally rotating between 1–3 featured items. This carries the "mission" credibility while the service grid immediately below carries the utility.
- **Homepage section sequence** (this IS the blueprint's home composition):
  1. **Alert banner** — emergency/notice channel (above the header).
  2. **Featured hero** — one strong image + featured update (rotating 1–3).
  3. **"How do I…" quick-services grid** — the civic heart: a labelled icon-card grid of the top tasks (Pay a bill · Apply for a permit · Report an issue · Licenses & registrations · Find a meeting · Contact a department). Plain-language, task-verb labels, each linking to a service page.
  4. **News & updates feed** — announcements, press releases, service changes: card list with rubric (News / Notice / Press Release) + date + department.
  5. **Departments directory** — a card grid of departments (Public Works, Parks & Rec, Clerk, Planning & Zoning, Police, Water & Utilities…), each a link to its department page.
  6. **Public-notices list** — an imageless, hairline-divided list of legal/public notices (agendas, hearings, RFPs, bid postings) with a type tag + date + a "download PDF/agenda" affordance.
  7. **Meetings & events calendar** — upcoming council/board meetings and civic events: date + title + location + "agenda / register / add to calendar."
  8. **Notify-me / newsletter signup** — the civic conversion: subscribe to alerts, meeting agendas, or a department's updates.
  9. **Footer** (below).
- **Article anatomy** (a news post / public notice — the "PDP" of a civic site): **rubric** (News / Notice / Press Release) → **headline** → **published date + issuing department** → **lead image + caption** (for news; notices may be text-only) → **single-column plain-language body** at a comfortable measure with inline links → **related services** links → a **contact block** (department, phone, email, hours). No commerce buy-box; the conversion is "notify me" or a linked service action.
- **Service / "how do I" page** (the civic-specific surface the commerce set never had): **task title** → **plain-language summary** ("Use this service to…") → **numbered steps** → **what you'll need** (required documents/eligibility list) → a **primary action** ("Start", "Apply", "Pay online") → **department + contact + hours** → **related notices/pages**. This is the page a citizen actually came for.
- **Department page:** department name → **what it does** (plain language) → **services it owns** (link list) → **staff/contact/hours** → its **recent notices + upcoming meetings**.
- **Archive / category feed:** a **section masthead** (News / Notices / Departments / Meetings + description) over a filtered card river / list, with **load-more** and topic filters. Author pages generalise to **issuing-department** pages.
- **Footer:** **link map** (Services · Departments · News · Meetings · About/Contact), a **notify-me** capture, a social row, and a **civic legal/compliance row** — **Accessibility statement, Privacy, Public Records (FOIA-equivalent), Non-Discrimination, ADA/language assistance** — plus a "last updated" line. The compliance row is a defining civic element, not optional.

## 5. Signature interaction patterns

1. **The alert banner as a first-class channel.** A civic site's most-used feature in a crisis is the banner at the very top. It has real states (emergency = red/high-contrast, routine notice = blue, none = collapsed strip), a dismiss, and a link to detail. Reproduce this and the "government portal" identity is immediate — nothing else says "official site people rely on" faster.
2. **"How do I…" task grid over a section grid.** The homepage leads with **verbs, not departments** — "Pay a bill," "Report a pothole," "Apply for a permit" — because citizens think in tasks, not org charts. The labelled icon-card grid is the single most important wayfinding device; the departments directory is secondary.
3. **Accessibility as visible design, not an afterthought.** A **skip-to-content** link as the first focusable element; **AA/AAA contrast** on every text/background pair (deep blue on white clears AAA); **visible, high-contrast focus rings** on every interactive element; **plain-language** labels; **honest semantic structure** (real headings, landmarks, labelled search); reduced-motion-respecting. On this template, RULE #3 (never fade readable text) is the **headline requirement** — every label, date, and byline gets a real ink token, never `soft`/`muted`/`/opacity`. This is the defining discipline of the archetype.
4. **Notices + meetings as structured public record.** Government legally must publish notices, agendas, and meeting schedules in a findable, dated, downloadable form. The public-notices list (type tag + date + PDF) and the meetings calendar (date + agenda + add-to-calendar) are civic-specific structures that read as official-record, not blog content.

## 6. The sparx translation

- **Theme:** **bespoke — `agency`** (closest shipped: `press` / `quad`). A **white-ground, deep-federal-blue, one-civic-red**, accessibility-first theme. Every pair below is chosen to clear **AA at minimum, AAA where text sits on white** (deep blue #12224F on white ≈ 13:1 — comfortably AAA), which is the whole point of this template.
  - **Grounds (4 surfaces):** `base-100` page = `#FFFFFF` (pure white, max contrast); `base-200` muted section/card ground = `#F1F4FA` (very light blue-grey — reads as "civic" without tinting text); `base-300` borders/dividers = `#D5DCEA` (a visible-but-calm blue-grey edge, since edges do the separating); `base-content` ink = `#111318` (true near-black body).
  - **Primary / accent strategy:** **deep institutional blue** primary `oklch(~30% 0.09 265)` (≈ `#12224F`) carrying chrome, links, headings, and primary buttons — AAA as text on white and AA as a fill with white ink. **One civic accent** — a flag-derived **civic red** `oklch(~48% 0.19 27)` (≈ `#B22234`) reserved for the **alert banner** and the single most urgent action; it is a **state color, not decoration**, so it appears only where urgency is real. A **secondary/info blue** `oklch(~55% 0.12 240)` may carry routine-notice banners and info callouts. Semantics (success/warning/danger) resolve via `statusTone()` for notice types and service statuses. (Confirm all fills + link sizes clear the catalog-sweep AA/AAA.)
  - **Fonts:** display + body = a single **high-legibility humanist sans** (a Public-Sans / Source-Sans / Inter feel — the government type direction chosen for screen clarity at every size), **no serif**. Headings in the deep-blue primary at heavy weight; body near-black at a **≥16px floor, leaning 17–18px** for plain-language reading; rubrics/labels small-caps + tracked but still full-ink. Legibility is the entire type brief.
- **Section mapping:**

  | Civic homepage band (NASA/whitehouse spine) | sparx catalog key                                          |
  | ------------------------------------------- | ---------------------------------------------------------- |
  | Header nav + footer                         | `sparx_layout` (silica frame navbar/footer, blue chrome)   |
  | Emergency / alert banner                    | **NEW: `alert_banner`** (state-aware civic notice strip)   |
  | Featured media hero (rotating 1–3)          | `article_header` _(feature/hero variant)_ or `hero_media`  |
  | "How do I…" quick-services grid             | **NEW: `services_grid`** (task icon-card grid)             |
  | News & updates feed                         | `blog_post_grid` _(feed-card variant)_ + `section_rail`    |
  | Departments directory                       | **NEW: `directory_grid`** (department card grid)           |
  | Public-notices list                         | **NEW: `notices_list`** (type-tag + date + PDF, imageless) |
  | Meetings & events calendar                  | `event_list` _(civic agenda variant — add-to-calendar)_    |
  | Notify-me / newsletter signup               | `newsletter_signup` _(notify-me variant)_                  |
  | Sidebar: recent/most-read updates           | `most_popular` (ranked updates)                            |

  **Article (news/notice):** rubric + headline + date + issuing-department → `article_header` (news variant, **shared** with TechCrunch); body → `article_body`; related services → `services_grid` (compact) / link list; contact → **NEW: `contact_block`**. **Service page:** task title + summary + numbered steps + required-docs + primary action → **NEW: `service_steps`** (composed with `contact_block`). **Department page:** `article_header` (department variant) + `services_grid` (its services) + `notices_list` + `event_list`, both scoped to the department. **Archive:** `collection_header` (content variant) + `blog_post_grid` / `notices_list` filtered by taxonomy + load-more.

- **Example business:** **City of Rivermark** — a mid-size city government portal ("Your city, one place"). Content is the spine; there is **no store** (an optional note: permit/utility **payments** are a _linked service action_, not a commerce catalog — kept out of scope so content/services stay the spine). Seeds:
  - **~16 `cms.blog_post` / update records** across **News, Notices, Press Releases** — e.g. "Riverside Bridge lane closure begins Monday," "Notice of public hearing: 4th Street rezoning," "Leaf & yard-waste pickup schedule," "Boil-water advisory lifted for the Highlands," "City Council adopts FY27 budget," "Parks summer program registration opens," "Snow-route parking rules in effect," "New online permit portal now live," "Public comment open: Complete Streets plan," "Water main repair on Elm — service restored," "Rivermark named a Tree City USA," "Household hazardous-waste drop-off Saturday," "Police holiday-patrol advisory," "Library extends weekend hours," "Notice: bid postings for street resurfacing (RFP-27-014)," "Election: polling-place changes for the June primary" — each with rubric, issuing department, date, plain-language body, and (for news) a lead image, so the hero, feed, notices list, archives, and article/notice pages all render real.
  - **~8 `cms.page` service pages** ("how do I…") — **Pay a utility bill · Apply for a building permit · Report an issue (pothole/streetlight/graffiti) · Register a business license · Adopt a pet / animal services · Reserve a park shelter · Request public records · Register to vote / find your polling place** — each with a summary, numbered steps, required-documents list, primary action, and a contact block.
  - **~8 department records** (taxonomy + a `cms.page` each) — **Public Works · Parks & Recreation · City Clerk · Planning & Zoning · Police · Water & Utilities · Finance · Library** — populating the directory grid and scoping notices/services/meetings.
  - **Meetings/events** — ~6 `event_list` records (City Council, Planning Commission, Parks Board meetings + a couple of civic events) with date, location, and an agenda/notice link.
  - **Taxonomy** = update types (News / Notice / Press Release) + the 8 departments + a few tags (Roads, Water, Elections, Budget). No author personas — bylines are **issuing departments**, which is the civic-correct model.
- **Design freedom used (tenant-only affordances):** a **large media hero image** (NASA's mission-richness) and **structured icon cards** on the services grid — both within sparx's normal allowances. No shadow/glass/gradient is _needed_; the look is white + deep-blue + clear borders, which the tenant theme carries with edges and ground shifts. The one genuinely tenant-specific piece is the **alert-banner state machine** and the **accessibility-max token choices** (AAA blue-on-white, high-contrast focus rings) that a civic site demands beyond the default AA floor.
- **Deliberate departures:** **no NASA meatball, no NASA/White House names, seals, wordmarks, or federal trademarks, no "Freedom 250" or administration content** — "federal blue" is a **generic civic direction**, our example is a fictional city, imagery is royalty-free/original. We lean the **service/civic** side (alerts, how-do-I, departments, notices, meetings) rather than NASA's mission/media depth, since the example is a municipality. Commerce is deliberately **out of scope** (payments are a linked action, not a store) so the template stays a clean content/services exemplar. "Authors" generalise to **issuing departments**.

## 7. Build notes / catalog gaps

Catalog additions (propagate once, never per-bundle inlines) — the civic archetype
contributes the largest batch of genuinely-new **public-service** sections to the
[CATALOG-ADDITIONS](../CATALOG-ADDITIONS.md) pass; several sections are **shared** with
the other content teardowns and land once:

- **`alert_banner`** (new, civic-defining) — a **state-aware notice strip** pinned above the header: states `emergency` (civic-red, high-contrast, white ink) / `notice` (info-blue) / `none` (collapsed slim strip). Carries a label, headline, detail link, and a **dismiss** (needs the behaviors runtime for dismiss + expand; static high-visibility fallback when absent, matching the dismissible-`promo_band` precedent from TechCrunch). Must clear AAA at the emergency contrast and expose an ARIA live-region role.
- **`services_grid`** (new, civic-defining) — a **task icon-card grid**: per card an icon + a plain-language verb label ("Pay a bill") + a short line + a link to a service page. Bound to a `service`/`page` source or authored; the primary wayfinding device. Compact variant for the article/department "related services" rail.
- **`directory_grid`** (new) — a **department/office card grid**: per card a name + one-line description + link to the department page. A generic "directory of entities" section (departments, offices, facilities, locations) other verticals reuse.
- **`notices_list`** (new) — an **imageless public-record list**: per row a **type tag** (Notice / Hearing / RFP / Agenda) + title + **date** + an optional **download/PDF** affordance, hairline-divided. The civic counterpart to `headline_list` (confirm one section can serve both with a `variant`/`meta` prop; notices add the type-tag + file affordance).
- **`service_steps`** (new, civic-defining) — the **"how do I" page body**: task summary + a **numbered steps** block + a **"what you'll need"** required-list + a **primary action** button. The service-page counterpart to the commerce `buy_box`. Composes with `contact_block`.
- **`contact_block`** (new) — a **department/office contact card**: name, phone, email, hours, address/map link. Reused on service pages, department pages, and article footers; a generic "who to contact" section useful well beyond civic.
- **`event_list` civic/agenda variant** — confirm the shared `event_list` can render a **meeting/agenda** row (date + title + location + **agenda link + add-to-calendar**), not just a marketing event; add the agenda-link + calendar affordances if missing.
- **`article_header` feature/hero + news variants** (shared) — reuse the TechCrunch/New Yorker add; needs a **media-hero (feature) variant** for the rotating homepage hero and a **news variant** whose "byline" is an **issuing department**, not a person. Confirm the byline slot accepts an entity (department) source.
- **`newsletter_signup` notify-me variant** — a **"get alerts / subscribe to agendas / follow a department"** framing of the shared capture band (copy + optional topic/department selector), for the civic notify-me conversion.
- **Accessibility token guarantees** — the one cross-cutting build note: confirm the **catalog-sweep enforces AA/AAA** for the `agency` theme's blue-on-white and red-alert pairs, that the frame emits a **skip-to-content** link + **landmark roles** + **visible high-contrast focus rings**, and that the alert banner carries a **live-region** role. This template is the reason those guarantees should exist platform-wide, not just here — accessibility is the archetype's headline feature, so it belongs in the shared frame, not inlined per bundle.
