# 06 — Phase 6: The Builder overview home

> ⚠️ **SUPERSEDED 2026-07-22.** This plan predates the silicaui `<Builder>` adoption — sparx now HOSTS silica's engine (Insert palette, canvas, layers, inspector, undo/redo) instead of building its own. See **docs/118-builder-silicaui-html-migration.md** for the current architecture. Kept for historical context.

Version: 1.1
Author: Brandon Korous
Last Updated: 2026-07-22

> Today `/builder` is a thin surface-picker (Brand · Site · Page · Email ·
> Components + a blueprint teaser). This phase replaces it with a real **module
> home**: the site's live status, key metrics, what needs attention, health, and
> recent activity — the management surface a site owner lands on, with the editor
> one click away. Design reference: [builder-overview.html](../mockups/builder-overview.html).
>
> Fully independent of the editor phases — it can be built any time. It is
> **API-first** ([06](../06-api-specification.md)): every card is backed by an
> endpoint, the dashboard is one consumer.

## 1. The shape (from the mockup)

A single page for the active site:

- **Status hero** — a live thumbnail of the site, "Your site is live" + domain/SSL,
  last-published, pages-live count, and an **unpublished-changes** nudge → Review &
  publish.
- **KPI strip** — Visitors · Pageviews · Avg. load · Email signups (30d, with
  deltas).
- **Traffic** — visitors/pageviews trend (14d) + **where visitors come from**
  (search/direct/social/referral) + top referrer.
- **Top pages** — views / avg. time / signup-conversion per page.
- **Needs attention** — missing meta descriptions, broken links, missing alt text,
  no analytics pixel — each with a one-click fix entry.
- **Site health** — performance score, mobile-friendly, SSL, sitemap, SEO metadata
  coverage.
- **Pages & content** — published/drafts counts + Theme + Components shortcuts.
- **Recent activity** — who changed what, when (publish, edits, brand changes, new
  pages).

## 2. Decisions

**2.1 Replace the surface-picker landing.** `/builder` becomes the overview home.
The "build it yourself" entry points (Brand/Site/Page/Email/Components) move into a
compact section or the **Pages & content** / **Theme** cards — they now open the
unified editor ([03](03-unified-builder-shell.md)), not three separate routes. The
blueprint CTA stays.

**2.2 Compose from real signals; be honest about what exists.** Each card binds to
an existing source where one exists, and is explicitly flagged where it needs new
plumbing:

| Card                                                         | Source today                                                             | New plumbing needed?                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------------------------- |
| Status hero (publish state, pages live, unpublished changes) | `sitebuilder_configs` / `sitebuilder_versions` + draft-vs-published diff | diff endpoint (modest)                |
| Domain / SSL                                                 | domains module ([04](../04-domain-ssl-automation.md))                    | none                                  |
| SEO health / metadata coverage / missing meta                | the SEO panel already computes a per-page health score                   | aggregate endpoint                    |
| Pages & drafts counts, Theme, Components                     | builder page/layout/component lists                                      | none                                  |
| Recent activity                                              | the audit log already records builder actions                            | activity feed endpoint                |
| **Visitor / pageview / referrer analytics**                  | **not present per-site today**                                           | **real analytics plumbing** — see 2.3 |
| Broken links / missing alt text                              | derivable by scanning the published tree                                 | a scan job (modest)                   |
| Performance / load time                                      | none today                                                               | needs measurement (Lighthouse-style)  |

**2.3 Analytics is the one genuinely-new dependency — scope it deliberately.** The
KPI strip + Traffic + Top pages need per-site web analytics, which the platform
doesn't have yet (attribution L-PLAT, [80](../80-marketing-attribution-analytics.md), is
acquisition-funnel, not per-site pageview analytics). Options, in order of
preference: (a) a lightweight first-party pageview collector on `wizeworks/apps/site` →
aggregate endpoint; (b) defer the analytics cards behind a clear "Connect
analytics" empty state and ship the rest of the home now. **Do not fake metrics.**
Ship the home with the available cards live and the analytics cards in an honest
"not connected yet" state, then land analytics as its own slice.

**2.4 Module-colored, dashboard-standard.** Builder indigo; `Card variant="module"`;
the working-area standard ([34](../34-dashboard-working-area-standard.md)); no
re-skinned controls ([23 §15](../23-frontend-component-architecture.md)). The
mockup's flat, two-weight, 3px-stripe styling is the target.

**2.5 Per active site.** The home reflects the **active property** (breadcrumb site
switcher) — its publish state, its pages, its activity — consistent with the
per-site model ([per-site brand]).

## 3. Work breakdown

| Step | Area               | Change                                                                                                                                     |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `/builder` route   | Replace the surface-picker with the overview layout (cards per §1).                                                                        |
| 2    | api-rest           | Endpoints: draft-vs-published diff (unpublished-changes), SEO-health aggregate, pages/drafts counts, activity feed; reuse domains for SSL. |
| 3    | attention scan     | Job/endpoint to surface broken links + missing alt text from the published tree.                                                           |
| 4    | analytics (sliced) | Either a first-party pageview collector + aggregate endpoint, or honest "not connected" states for KPI/Traffic/Top-pages.                  |
| 5    | entry points       | "Build it yourself" + Theme/Components shortcuts open the unified editor.                                                                  |

## 4. Acceptance criteria

- `/builder` shows the active site's real publish status, pages/drafts, SEO health,
  needs-attention items, and recent activity — all from live sources.
- The unpublished-changes nudge reflects a real draft-vs-published diff and links to
  publish.
- Analytics cards are either live (if 2.3a is built) or in an honest
  "connect analytics" empty state — never fabricated.
- Every card is backed by an API endpoint; the page is one consumer.
- Editor entry points open the unified builder; the blueprint CTA works.
- Reflects the active property; switching sites updates the home.

## 5. Risks & notes

- **The temptation is to fake the dashboard.** The mockup is illustrative; the
  product must show real data or an honest empty state. Flag any card that can't be
  backed yet rather than shipping placeholder numbers
  ([feedback_build_production_not_mvp]).
- **Analytics is a real project.** Don't let it block the rest of the home — slice
  it. But decide the collector approach deliberately (first-party vs deferred).
- **Attention scan cost.** Scanning the published tree for broken links / alt text
  should be a background job, not an on-render computation.
