# 50 — SEO, AIO & Discoverability

Version: 1.4
Author: Brandon Korous
Last Updated: 2026-06-24

> Discoverability is a **platform capability**, not a per-app chore. It spans two audiences —
> traditional search crawlers and the new wave of answer/generative engines (AIO) — and two
> surfaces — the sparx **marketing site** (`apps/web`) and every **tenant site**
> (`apps/site`). For tenants, SEO/AIO is a _product feature they control_ through the Builder and
> CMS, the same way [auth](16-auth-security.md), [billing](17-billing-subscriptions.md), and
> [consent](42-legal-and-consent.md) each became first-class. This doc records the model and the
> decisions; it is the home for the `docs/50` references threaded through the code.

---

## 1. Why this exists

A 2026-06-03 audit graded discoverability across three pillars (traditional SEO, AIO, modern web
best practices) for both app classes. Traditional SEO was already strong on tenant sites
(per-page metadata, Product + BreadcrumbList JSON-LD, per-tenant `robots.txt`, `next/image`); the
sharp gaps were **sitemap completeness**, **redirect enforcement**, **Builder-page SEO**, and a
total **absence of an AIO layer** — conspicuous for a platform whose positioning is _"AI builds it,
sparx keeps it"_ and whose MCP server is first-class ([07](07-mcp-server-spec.md)).

The throughline: a tenant's findability is _their_ outcome, surfaced through sparx's authoring
tools. So the controls live in the product (the Builder SEO panel), and the platform emits correct,
complete machinery by default.

## 2. What shipped (Phase 1)

### 2.1 Sitemap completeness — `services/api-rest/src/routes/v1/sitemap.ts`

The per-tenant `sitemap.xml` previously listed only CMS `content_entries`. It now covers everything
the site serves, all read in one RLS-scoped round-trip:

- the home page (`/`);
- published CMS entries — via the content type's `urlPattern`, which doubles as the CMS's
  "is this type routable" flag (the dashboard gates the slug field on `Boolean(urlPattern)`), so a
  type without one is correctly absent. **Exception (2026-07-18):** `apps/site` ships a hardcoded
  `/blog/[slug]` route that resolves any published `blog_post` by slug regardless of `urlPattern`,
  so those posts were reachable and indexable while being silently missing from the sitemap.
  `IMPLICIT_URL_PATTERNS` in the route supplies `/blog/{slug}` as a fallback; a type's own
  `urlPattern` still wins when set. Any future hardcoded content route needs an entry there;
- **active products** (`/products/{handle}`, mirroring the public PDP filter `status='active' AND deleted_at IS NULL`);
- **collections** (`/collections/{handle}`, `deleted_at IS NULL`);
- **published Builder singleton pages** that own a slug (`/{slug}`), excluding any flagged `noindex`.

**Decision — gate commerce on content.** The `/products` and `/collections` _index_ URLs are only
emitted when the tenant actually has products/collections, so a content-only (CMS/CRM) tenant never
advertises an empty commerce surface. Final URL set is de-duplicated by path (a Builder page and a
CMS entry can't double-list the same path) and capped at `COMMERCE_URL_LIMIT` (20k) as a memory
guard — a catalog past that needs a paginated sitemap index, which is future work.

### 2.2 Redirect enforcement — site 404 boundary

Tenants could create 301/302 redirects in the dashboard, but **nothing applied them** — a renamed
slug just 404'd, burning the link equity the redirect existed to preserve.

- **`GET /v1/public/redirects/resolve?tenant=&path=`** (`services/api-rest/.../public/redirects.ts`)
  flattens the chain (follows up to 8 hops to the final destination) and bumps the matched
  redirect's hit counter.
- **`apps/site/lib/redirects.ts` → `applyRedirect()`** is called immediately **before every
  `notFound()`** in the catch-all, PDP, and collection routes. Because a live page always renders
  first, the lookup only runs for a path that would otherwise be dead — redirects never shadow a
  real page.

**Decision — 308/307, not 301/302.** Next's App Router issues `permanentRedirect()` (308) /
`redirect()` (307). We map stored `301|308 → permanent`, `302|307 → temporary`. Google treats 308 ≡
301 and 307 ≡ 302, and for GET site navigations the method-preservation difference is moot —
so the idiomatic framework call is correct. The lookup is cached and tagged `redirect:<tenant>`;
new redirects take effect within the cache TTL (revalidation worker wiring is future work).

### 2.3 Builder-page SEO — schema → inspector → render

Builder singleton pages (the primary authoring surface, [44](archive/44-builder-site-render.md)) emitted
only `name · tenant`. They now carry real SEO, end to end:

- **Schema** (`51-builder.prisma`, migration `20260624000000_builder_page_seo`): five additive,
  nullable columns on `builder_pages` — `seo_title`, `seo_description`, `canonical`, `og_image`,
  `noindex`. Additive only; RLS already ENABLE+FORCE, so no policy change.
- **Contract** (`@sparx/builder-schemas`): a shared `PageSeoShape` extends Create/Update inputs;
  `BuilderPageDto` and the public `PublishedPageDto` expose the fields.
- **Service** (`@sparx/builder` `pageService`): reads/writes the columns; empty strings normalize to
  `null` so a blank field falls back to the page name rather than an empty `<title>`.
- **UI** (`apps/dashboard/.../builder/_builder/inspector.tsx`): a `PageSeoPanel` in the singleton's
  page settings — title, description, canonical, social image, and an "allow indexing" switch.
  Text fields commit on blur (like the slug field); the switch commits immediately; edits are
  optimistic via `updatePageSeo`.
- **Render** (`apps/site/app/[...slug]/page.tsx`): `generateMetadata` consumes the fields — author
  SEO wins, blanks fall back to the page name; `noindex` flips the robots directive; `canonical`
  and `og_image` flow into `alternates`/`openGraph`.

**Decision — OG as a URL, not an asset id.** Products/collections store `og_image_id` (a media
UUID). Builder pages store `og_image` as a **full URL**, matching the Builder's URL-first image
convention (cf. `box.backgroundImage`) and avoiding a media-picker dependency in the inspector. The
site passes it straight to `openGraph.images`. Collection _templates_ keep SEO null — they
render per-record and inherit SEO from the bound product/entry.

### 2.4 AIO layer — `llms.txt`, AI-crawler policy, FAQ schema

The platform now opts **into** answer/generative-engine discovery (consistent with its AI-native
positioning) rather than the common default of blocking AI crawlers.

- **`llms.txt`** ([llmstxt.org](https://llmstxt.org)): the marketing site serves a curated,
  link-first Markdown index built from the canonical `MODULES` source (`apps/web/app/llms.txt`); each
  tenant site serves a store-identity index pointing at its full sitemap
  (`apps/site/app/llms.txt`).
- **AI-crawler policy**: both `robots` surfaces name the major AI agents (GPTBot, OAI-SearchBot,
  ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended, CCBot, Amazonbot,
  Meta-ExternalAgent, …) as explicitly welcome, and the site `robots.txt` points to `llms.txt`.
  The named groups are also the lever to _tighten_ later if ever needed.
- **FAQPage JSON-LD**: the marketing FAQ (`apps/web/components/marketing/faq.tsx`) emits FAQPage
  structured data built from the same items it renders, so markup and visible prose never diverge.

## 3. Per-tenant control surface

| Capability                                 | Where the tenant controls it             | Site effect                                  |
| ------------------------------------------ | ---------------------------------------- | -------------------------------------------- |
| Page SEO (title/desc/canonical/OG/noindex) | Builder → page settings → SEO panel      | `generateMetadata` on `/{slug}`              |
| Product/collection SEO                     | Commerce admin (existing `seo_*` fields) | PDP/PLP `generateMetadata` + Product JSON-LD |
| CMS page SEO                               | CMS editor SEO panel (existing)          | catch-all `generateMetadata`                 |
| Redirects                                  | Dashboard → Redirects                    | 308/307 at the 404 boundary                  |
| Sitemap / robots / llms.txt                | Automatic from the above                 | `/sitemap.xml`, `/robots.txt`, `/llms.txt`   |
| Social card (OG image)                     | Upload an image; else auto-generated     | `og:image` — real asset, or `/api/og` card   |

## 4. Phase 2 (shipped) — hardening

A second pass landed the lower-risk web-best-practice gaps:

- **Structured-data breadth** — site layout now emits **Organization** (logo + social `sameAs`)
  and **WebSite + SearchAction** (`/search?q=`); the marketing layout emits **WebSite**; CMS blog
  posts emit **BlogPosting / Article** (`apps/site/components/article-json-ld.tsx`, wired around both
  the builder-collection and bare-`PageView` render paths). (FAQPage landed in §2.4; **BreadcrumbList**
  auto-emits from the shared `<Breadcrumbs>`.)
- **Security headers** — a Caddy `(security_headers)` snippet adds **HSTS, X-Content-Type-Options,
  X-Frame-Options (SAMEORIGIN), Referrer-Policy** to the browser-facing + API hostnames. Deliberately
  **no CSP / Permissions-Policy** yet (they need per-app tuning around Stripe/checkout, PostHog,
  Satori) — those land as a **Report-Only** pass. Deploys via `bootstrap.yml` — note Caddy runs with
  `admin off` and reads its Caddyfile only at startup, so the bootstrap caddy step **force-rolls the
  Deployment** (a ConfigMap apply alone won't reload the running pod).
- **Error boundaries** — `error.tsx` + `global-error.tsx` in all three apps (web, site, dashboard),
  theme-agnostic, with a `console.error` hook where a tracker attaches later. **Sentry intentionally
  skipped** for now (no DSN/dependency).
- **Core Web Vitals** — `useReportWebVitals` → PostHog (`web_vitals` event) on marketing + dashboard.
  Site CWV waits on its consent-gated analytics path ([42](42-legal-and-consent.md)).
- **Marketing sitemap completeness** — `apps/web/app/sitemap.ts` lists the substantial static
  routes (`/platform`, `/features`, `/pricing`, `/partners{,/directory}`, `/bootcamp`, `/customers`,
  `/security`, `/brand`, `/legal/{privacy,terms,dpa,aup}`) alongside the home + module pages, plus
  the registry-driven `/tools`, `/careers`, and published bootcamp slugs; legal `lastModified`
  tracks the document revision from `@sparx/legal`. `ComingSoon` stubs stay excluded on purpose
  (thin placeholders → soft-404 risk).
- **Extension-catalog coverage (2026-07-18)** — the `/market` tree (the blueprints/themes/
  integrations/components catalog) was shipped in Phase 5 but never added to the sitemap, so the
  whole catalog was uncrawlable while `robots.ts` carried a comment asserting the opposite.
  `sitemap.ts` now enumerates `/market`, each `LIVE_CATEGORIES` entry, and every listing slug from
  the public catalog API (`lib/marketplace.ts → fetchListingSlugs`, which walks `next_cursor` so a
  category past one page is never silently dropped, and logs when it hits its bound). Only the
  UNFILTERED category URL is listed — faceted views are `noindex` and robots-disallowed.
  **Do not confuse `sparx.works/market` with `sparx.market`**: the former is the extension catalog,
  the latter a separately deployed app (`apps/market`) where shoppers buy tenant products. An early
  plan had `sparx.market` 301 into `sparx.works/market`; that was abandoned and the redirect no
  longer exists.
- **Tenant social cards (dynamic OG fallback)** — a tenant-branded Satori card so every shareable
  site URL has a real social image even with no asset of its own. `apps/site/app/api/og`
  is a pure renderer (title/eyebrow/brand/accent as query params — no tenant lookup, no data
  fetch); `lib/og.ts → ogImageUrl()` builds the URL. **Real images always win**: the precedence is
  product photo → collection hero → author-set `og_image` → generated card. Wired into the PDP,
  collection, catch-all (Builder + CMS), and the site-level default (home). The site layout
  now sets `metadataBase` from the forwarded host so the relative card URL resolves to an absolute
  one on the correct tenant origin.

## 5. Deferred / roadmap

Parked deliberately — captured here as future-work items so the gaps are explicit, not silently
dropped. Each item notes what it needs and the trigger for picking it up. (The SEO-scorecard's own
remaining follow-ups live with the feature in §7.6.)

- **Markdown content endpoints for LLM ingest** (`/<path>.md`) — serve a clean Markdown twin of every
  public page so AI crawlers ingest structure without HTML noise.
  _Needs:_ a doc→Markdown serializer in `@sparx/cms-editor` (today only `renderDocToHtml` exists) + a
  `.md` route on the site. _Trigger:_ the largest remaining AIO lever — do next when AIO is
  prioritized.
- **CSP + Permissions-Policy (Report-Only first)** — the deferred half of the security headers (§4).
  _Needs:_ a report sink (`report-to`/`report-uri` endpoint) + per-app allow-list tuning around
  Stripe/checkout, PostHog, and Satori; ship Report-Only, watch violations, then enforce. _Trigger:_
  before any compliance/pentest milestone.
- **CI perf budgets (Lighthouse / bundlesize)** — CWV is measured in prod (§4) but nothing gates a
  regression. _Needs:_ a Lighthouse-CI (or bundlesize) workflow + agreed score/byte floors; decide
  advisory vs blocking. _Trigger:_ once the apps' routes stabilize enough that budgets aren't noise.
- **Sentry (or equivalent) error tracking** behind a DSN env var, attaching at the existing
  `console.error` hooks in `error.tsx` / `global-error.tsx`. _Needs:_ a DSN + dependency decision.
- **Cross-page SEO checks** (duplicate titles/descriptions, orphan pages, broken internal links) — the
  single-entity scorecard (§7) can't see these. _Needs:_ the Typesense index, not one row. _Trigger:_
  fold into the search-index read path.
- **hreflang / i18n** — deferred platform-wide ([12](12-cms-prd.md) Phase 2). Multi-locale content +
  `hreflang` alternates + locale-aware sitemap. _Trigger:_ first multi-locale tenant.
- **Marketing `title.template`** — deferred. Every marketing page already carries the brand in its
  `<title>` (module pages "sparx X — …", static pages "X — sparx"), so a root template is pure DRY
  with no SEO gain and would double-brand unless all ~17 pages + `makeMetadata` were converted to
  bare/`absolute` titles in lockstep. Revisit only if the page count grows enough to make the
  boilerplate a real maintenance cost.
- **Redirect cache purge** on `redirect.added`/`removed` (today: TTL-bounded), and the broader
  Pub/Sub → site revalidation worker.

## 6. Conventions for future code

- Anything that bounds coverage (sitemap caps, `noindex` exclusions) must be explicit in code, not
  silent.
- New publicly-routable record types must be added to the sitemap query **and** get a redirect-aware
  `notFound()` boundary.
- AI crawlers are welcome by default; if a surface needs to exclude them, do it in the named
  `robots` groups, not by removing the `llms.txt`/sitemap signals.
- SEO controls belong in the authoring tool for the surface that owns the content; the render path
  only _consumes_ the stored fields.
- **SEO title/description inherit, and the editor must SHOW it.** The render path falls back
  `seoTitle ?? name` and `seoDescription ?? description` (e.g. `apps/site/app/collections/[handle]/page.tsx`
  `generateMetadata`), and the audit gatherer (`services/api-rest/src/lib/seo-audit.ts`) mirrors that same
  fallback — so a blank SEO field is **not** "missing", it inherits, and the score legitimately reads
  "present". That is correct on the live site but _confusing in the editor_ (blank field + green score reads
  like a bug). Every editable surface therefore renders its SEO pair through the reusable **`<SeoMetaFields>`**
  (`apps/dashboard/components/seo/seo-meta-fields.tsx`), which makes the inheritance legible: the inherited
  value is the field's **placeholder**, and a per-field **"Use name" / "Use description"** button materializes
  it for editing (fill-empty only — it never clobbers a custom value; the description fill is trimmed to the
  ~160-char meta budget the score grades). Never render a bare SEO title/description input pair, and never a
  blunt "copy" button that overwrites.

## 7. SEO Audit Scorecard

A per-entity SEO health score the tenant sees **while authoring** — graded 0–100, and, more to the
point, _told what to fix_. Decided 2026-06-03; this section is the build record for the `docs/50 §7`
references threaded through the code.

### 7.1 Shape

- **Engine** — `@sparx/seo-audit`, a dependency-free pure function `auditEntity(input) → Scorecard`.
  No I/O, no clock, no React; deterministic and unit-tested. It scores a normalized
  `AuditableEntity` (never raw rows), so every surface scores identically.
- **Live API** — `GET /v1/seo/audit?type=&id=` gathers the signals under RLS — inspecting the
  **published** tree/HTML, not just the draft fields — builds the `AuditableEntity`, and returns the
  `Scorecard`. Powers the in-editor score.
- **Stored snapshot** — on `*.published` / `*.updated`, a consumer recomputes and persists
  `{ score, grade, computedAt }` per entity (`seo_audits`, FORCE RLS) so the **site-wide overview**
  can rank every page without N live audits. Live in the editor, stored for the list.

### 7.2 One data source, three views (no duplication)

The scorecard appears in many places but is **three shared components over one fetch**
(`useSeoAudit(type, id)`) — never re-implemented per surface. This is the deliberate answer to "don't
clone the report into four editors and create a maintenance nightmare":

- **`<SeoScoreChip>`** — the ring + grade with a hover/focus popover. The universal atom in every
  entity's SEO panel; renders the stored score, or fetches live in-editor. (On the `/seo` overview the
  row itself opens the report, so there the score renders as a non-interactive `<SeoScoreBadge>` — the
  same ring without the popover, since a hover report would duplicate the row's own detail.)
- **`<SeoScorePopover>`** — **on hover/focus of the chip**, lazily loads the audit and shows a
  compact summary (category bars + "fix first" + the top issues). This is the lightweight surface
  that rides along on _most_ pages without its own layout.
- **`<SeoReport>`** — the full expanded card (all 12 checks, tips, action links). Rendered only where
  it earns the room: a **dedicated SEO section** of the page editor and the **overview detail**.

So: the chip is everywhere, the popover is the hover-expand, the heavy report lives in the one or two
places that warrant it — same components, same endpoint throughout. Broaden the cheap surface; don't
duplicate the expensive one.

### 7.3 Check catalog (v1 — 12 checks, 100 points)

| #   | Category (max)    | Check                 | wt  | pass / warn / fail                                        |
| --- | ----------------- | --------------------- | --- | --------------------------------------------------------- |
| 1   | Title & Meta (30) | Title present         | 12  | present / — / empty                                       |
| 2   |                   | Title length          | 8   | 30–60 / 10–29 or 61–70 / <10 or >70 chars                 |
| 3   |                   | Description present   | 6   | present / empty / —                                       |
| 4   |                   | Description length    | 4   | 70–160 / outside / —                                      |
| 5   | Indexability (25) | Indexable             | 9   | `noindex` off / — / — (→ `info` when `noindex` on)        |
| 6   |                   | In sitemap            | 8   | listed / not listed / — (→ `info` when `noindex` on)      |
| 7   |                   | Canonical + slug      | 8   | clean slug / messy or missing / —                         |
| 8   | Content (25)      | Image alt text        | 10  | 0 missing / <⅓ missing / ≥⅓ missing (pass if no images)   |
| 9   |                   | Heading structure     | 7   | exactly 1 H1 / >1 H1 / 0 H1                               |
| 10  |                   | Content depth + links | 8   | ≥ threshold words & ≥1 internal link / below / —          |
| 11  | Social & AIO (20) | Social image          | 10  | custom / auto-generated / none                            |
| 12  |                   | Structured data       | 10  | expected JSON-LD present / partial or none / —            |
| —   |                   | AI-discoverable       | 0   | `info` — in `llms.txt` (platform-wide; shown, not scored) |

**Scoring.** `earned` = weight (pass) · weight/2 (warn) · 0 (fail). `info` checks score nothing **and
are excluded from the denominator**, so an intentional `noindex` — which flips checks 5–6 to `info` —
normalizes the score over the _remaining_ max instead of tanking it. `score = round(Σ earned ÷ Σ
scored-weight × 100)`. Grade: ≥90 excellent · ≥70 good · ≥50 needs-work · <50 poor. `fixFirst` = the
check with the largest single point shortfall (fails before warns). Word-count threshold is
entity-aware (prose pages expect more than a product blurb).

### 7.4 Phased build

- **A — engine** (`@sparx/seo-audit`) + unit tests. Pure, no infra. ✅ _(Foundation.)_
- **B — live API** `GET /v1/seo/audit` + per-entity-type signal extractors. ✅
- **C — chip + hover popover.** ✅ Builder inspector, overview rows, and the CMS / product /
  collection editor SEO panels.
- **D — `seo_audits` table + publish/update recompute + site-wide overview** ✅ (plus the `/seo` rail
  tile, ⌘K entry, and the row → full-report detail in the user's `defaultDetailView` surface).

### 7.5 Decisions

- **12 checks, all from data we already hold** — no external crawl in v1. Cross-page checks
  (duplicate titles/descriptions, orphan pages, broken internal links) are deferred; they need the
  search index, not a single-entity audit.
- **Live in-editor _and_ stored on publish** — the editor never shows a stale number; the overview
  never fires N audits.
- **Hover-popover everywhere cheap; full report only on dedicated surfaces** — one component set, one
  endpoint, no per-surface forks.
- **Auto-generated OG = warn, not fail** — 3.10 means a card always exists; the nudge is "upload a
  custom image", not a penalty.
- **`noindex` informs, doesn't penalize** — an intentionally hidden page isn't a failing page.

### 7.6 Remaining follow-ups

Engine, live API, storage, publish/update recompute, the `/seo` overview, the rail-nav tile, and the
⌘K entry shipped first; the 2026-06-04 pass closed the rest of the surface gaps:

- ✅ **Chip in every authoring editor** — `<SeoScoreChip>` renders in each SEO panel: the Builder
  inspector, the CMS page editor (`cms/[id]/seo-panel.tsx`), the **typed content-type entry editor**
  (`cms/_components/entry-seo-section.tsx` — the per-entry SEO panel where `blog_post` + every custom
  type is authored), product (`product-edit-form.tsx`), and collection (`collection-meta-form.tsx`),
  plus the overview rows. The "everywhere cheap" promise (§7.2) is met. (Both CMS surfaces author the
  entry's `seo` JSONB, so the `cms_page` audit reflects them regardless of which editor was used.)
- ✅ **Overview row → full report, conformant to the list + detail-view system (docs/34 §7).** `/seo`
  is a standard Collection/List surface: full width, a `ListToolbar` with a **type filter** and the
  **Table/Cards toggle** (per-page `?view`, falling back to the user's `defaultListView`), worst-first
  rows. Clicking a row opens the full `<SeoReport>` in whatever surface the user's `defaultDetailView`
  selects — `drawer`/`modal` overlay it in place (`seo/_components/seo-row-link.tsx`), `fullPage`/`newTab`
  route to the dedicated `/seo/[type]/[id]` report page (`seo/_components/seo-report-panel.tsx`). Same
  power-shortcuts as `EntityRowLink` (alt = drawer, shift = full page, ⌘/middle-click = new tab). The
  report links onward to the entity's editor (`components/seo/links.ts`) so you can jump to the fixes.
  On the overview the score is a plain `<SeoScoreBadge>` — **no hover popover** (redundant when the row
  already opens the report); the in-editor chips keep the interactive `<SeoScoreChip>`.
- ✅ **Re-scan gating** — the `/seo` page resolves the session role and renders Re-scan only for
  owner/admin/editor (reindex is an `editor` write), so viewers no longer see an action that 403s.
- ✅ **Popover flicker fixed** — the chip's hover popover oscillated open/closed because Radix's default
  auto-focus moved focus into the content on open (→ trigger `onBlur` → close) and back on close (→
  `onFocus` → reopen). `onOpenAutoFocus` / `onCloseAutoFocus` are now `preventDefault()`-ed, keeping
  focus on the trigger.
- ✅ **Builder per-page deep link** — the report's "Open in builder" link now targets the exact page:
  `entityEditorHref('builder_page')` → `/builder/page?page=<id>`, and `builder/page/page.tsx` reads the
  param and passes `initialPageId` so `BuilderApp` opens that page active on mount (falling back to the
  first page when absent/unknown).

Still open:

- **Reindex as a background job** — `POST /v1/seo/audits/reindex` loops every entity in one request/tx
  (`REINDEX_LIMIT=500`/type). Fine at Phase-1 scale; move to a job before catalogs grow.

_Impl note:_ the design's three components (§7.2) collapsed to two in code — the chip's hover popover
renders the full `<SeoReport>` directly (no separate compact `<SeoScorePopover>`), and both the overview
overlays (drawer/modal) and the `/seo/[type]/[id]` page reuse that same `<SeoReport>`. Fine for now;
revisit only if the popover gets too heavy on rows.
