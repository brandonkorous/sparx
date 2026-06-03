# 50 — SEO, AIO & Discoverability

Version: 1.0
Author: Brandon Korous
Last Updated: 2026-06-03

> Discoverability is a **platform capability**, not a per-app chore. It spans two audiences —
> traditional search crawlers and the new wave of answer/generative engines (AIO) — and two
> surfaces — the Sparx **marketing site** (`apps/web`) and every **tenant storefront**
> (`apps/site`). For tenants, SEO/AIO is a _product feature they control_ through the Builder and
> CMS, the same way [auth](16-auth-security.md), [billing](17-billing-subscriptions.md), and
> [consent](42-legal-and-consent.md) each became first-class. This doc records the model and the
> decisions; it is the home for the `docs/50` references threaded through the code.

---

## 1. Why this exists

A 2026-06-03 audit graded discoverability across three pillars (traditional SEO, AIO, modern web
best practices) for both app classes. Traditional SEO was already strong on tenant storefronts
(per-page metadata, Product + BreadcrumbList JSON-LD, per-tenant `robots.txt`, `next/image`); the
sharp gaps were **sitemap completeness**, **redirect enforcement**, **Builder-page SEO**, and a
total **absence of an AIO layer** — conspicuous for a platform whose positioning is _"AI builds it,
Sparx keeps it"_ and whose MCP server is first-class ([07](07-mcp-server-spec.md)).

The throughline: a tenant's findability is _their_ outcome, surfaced through Sparx's authoring
tools. So the controls live in the product (the Builder SEO panel), and the platform emits correct,
complete machinery by default.

## 2. What shipped (Phase 1)

### 2.1 Sitemap completeness — `services/api-rest/src/routes/v1/sitemap.ts`

The per-tenant `sitemap.xml` previously listed only CMS `content_entries`. It now covers everything
the storefront serves, all read in one RLS-scoped round-trip:

- the home page (`/`);
- published CMS entries (unchanged — via the content type's `urlPattern`);
- **active products** (`/products/{handle}`, mirroring the public PDP filter `status='active' AND deleted_at IS NULL`);
- **collections** (`/collections/{handle}`, `deleted_at IS NULL`);
- **published Builder singleton pages** that own a slug (`/{slug}`), excluding any flagged `noindex`.

**Decision — gate commerce on content.** The `/products` and `/collections` _index_ URLs are only
emitted when the tenant actually has products/collections, so a content-only (CMS/CRM) tenant never
advertises an empty commerce surface. Final URL set is de-duplicated by path (a Builder page and a
CMS entry can't double-list the same path) and capped at `COMMERCE_URL_LIMIT` (20k) as a memory
guard — a catalog past that needs a paginated sitemap index, which is future work.

### 2.2 Redirect enforcement — storefront 404 boundary

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
301 and 307 ≡ 302, and for GET storefront navigations the method-preservation difference is moot —
so the idiomatic framework call is correct. The lookup is cached and tagged `redirect:<tenant>`;
new redirects take effect within the cache TTL (revalidation worker wiring is future work).

### 2.3 Builder-page SEO — schema → inspector → render

Builder singleton pages (the primary authoring surface, [44](44-builder-storefront-render.md)) emitted
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
storefront passes it straight to `openGraph.images`. Collection _templates_ keep SEO null — they
render per-record and inherit SEO from the bound product/entry.

### 2.4 AIO layer — `llms.txt`, AI-crawler policy, FAQ schema

The platform now opts **into** answer/generative-engine discovery (consistent with its AI-native
positioning) rather than the common default of blocking AI crawlers.

- **`llms.txt`** ([llmstxt.org](https://llmstxt.org)): the marketing site serves a curated,
  link-first Markdown index built from the canonical `MODULES` source (`apps/web/app/llms.txt`); each
  tenant storefront serves a store-identity index pointing at its full sitemap
  (`apps/site/app/llms.txt`).
- **AI-crawler policy**: both `robots` surfaces name the major AI agents (GPTBot, OAI-SearchBot,
  ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended, CCBot, Amazonbot,
  Meta-ExternalAgent, …) as explicitly welcome, and the storefront `robots.txt` points to `llms.txt`.
  The named groups are also the lever to _tighten_ later if ever needed.
- **FAQPage JSON-LD**: the marketing FAQ (`apps/web/components/marketing/faq.tsx`) emits FAQPage
  structured data built from the same items it renders, so markup and visible prose never diverge.

## 3. Per-tenant control surface

| Capability                                 | Where the tenant controls it             | Storefront effect                            |
| ------------------------------------------ | ---------------------------------------- | -------------------------------------------- |
| Page SEO (title/desc/canonical/OG/noindex) | Builder → page settings → SEO panel      | `generateMetadata` on `/{slug}`              |
| Product/collection SEO                     | Commerce admin (existing `seo_*` fields) | PDP/PLP `generateMetadata` + Product JSON-LD |
| CMS page SEO                               | CMS editor SEO panel (existing)          | catch-all `generateMetadata`                 |
| Redirects                                  | Dashboard → Redirects                    | 308/307 at the 404 boundary                  |
| Sitemap / robots / llms.txt                | Automatic from the above                 | `/sitemap.xml`, `/robots.txt`, `/llms.txt`   |
| Social card (OG image)                     | Upload an image; else auto-generated     | `og:image` — real asset, or `/api/og` card   |

## 4. Phase 2 (shipped) — hardening

A second pass landed the lower-risk web-best-practice gaps:

- **Structured-data breadth** — storefront layout now emits **Organization** (logo + social `sameAs`)
  and **WebSite + SearchAction** (`/search?q=`); the marketing layout emits **WebSite**. (FAQPage
  landed in §2.4.) Still open: Article/BlogPosting for CMS posts.
- **Security headers** — a Caddy `(security_headers)` snippet adds **HSTS, X-Content-Type-Options,
  X-Frame-Options (SAMEORIGIN), Referrer-Policy** to the browser-facing + API hostnames. Deliberately
  **no CSP / Permissions-Policy** yet (they need per-app tuning around Stripe/checkout, PostHog,
  Satori) — those land as a **Report-Only** pass. Deploys via `bootstrap.yml`.
- **Error boundaries** — `error.tsx` + `global-error.tsx` in all three apps (web, site, dashboard),
  theme-agnostic, with a `console.error` hook where a tracker attaches later. **Sentry intentionally
  skipped** for now (no DSN/dependency).
- **Core Web Vitals** — `useReportWebVitals` → PostHog (`web_vitals` event) on marketing + dashboard.
  Storefront CWV waits on its consent-gated analytics path ([42](42-legal-and-consent.md)).
- **Marketing sitemap completeness** — `apps/web/app/sitemap.ts` now lists the substantial static
  routes (`/security`, `/legal/{privacy,terms,dpa,aup}`) alongside the home + module pages; legal
  `lastModified` tracks the document revision from `@sparx/legal`. `ComingSoon` stubs stay excluded
  on purpose (thin placeholders → soft-404 risk).
- **Tenant social cards (dynamic OG fallback)** — a tenant-branded Satori card so every shareable
  storefront URL has a real social image even with no asset of its own. `apps/site/app/api/og`
  is a pure renderer (title/eyebrow/brand/accent as query params — no tenant lookup, no data
  fetch); `lib/og.ts → ogImageUrl()` builds the URL. **Real images always win**: the precedence is
  product photo → collection hero → author-set `og_image` → generated card. Wired into the PDP,
  collection, catch-all (Builder + CMS), and the site-level default (home). The storefront layout
  now sets `metadataBase` from the forwarded host so the relative card URL resolves to an absolute
  one on the correct tenant origin.

## 5. Deferred / roadmap

Tracked here so the gaps are explicit, not silently dropped:

- **Markdown content endpoints** for LLM ingest (`/<path>.md`) — needs a doc→Markdown serializer in
  `@sparx/cms-editor` (today only `renderDocToHtml` exists). The single largest remaining AIO piece.
- **Article/BlogPosting** structured data for CMS blog posts.
- **CSP + Permissions-Policy** as a Report-Only-first pass (the deferred half of security headers).
- **Sentry** (or equivalent) wired behind a DSN env var, attaching at the `console.error` hooks.
- **CI perf budgets** (Lighthouse / bundlesize) — CWV is now measured; budgets aren't enforced.
- **SEO audit scorecard** in the CMS/Builder (per-page title/desc/h1/alt checks with a score).
- **hreflang / i18n** — deferred platform-wide ([12](12-cms-prd.md) Phase 2).
- **Marketing `title.template`** — deferred. Every marketing page already carries the brand in its
  `<title>` (module pages "Sparx X — …", static pages "X — Sparx"), so a root template is pure DRY
  with no SEO gain and would double-brand unless all ~17 pages + `makeMetadata` were converted to
  bare/`absolute` titles in lockstep. Revisit only if the page count grows enough to make the
  boilerplate a real maintenance cost.
- **Redirect cache purge** on `redirect.added`/`removed` (today: TTL-bounded), and the broader
  Pub/Sub → storefront revalidation worker.

## 6. Conventions for future code

- Anything that bounds coverage (sitemap caps, `noindex` exclusions) must be explicit in code, not
  silent.
- New publicly-routable record types must be added to the sitemap query **and** get a redirect-aware
  `notFound()` boundary.
- AI crawlers are welcome by default; if a surface needs to exclude them, do it in the named
  `robots` groups, not by removing the `llms.txt`/sitemap signals.
- SEO controls belong in the authoring tool for the surface that owns the content; the render path
  only _consumes_ the stored fields.
