# 549 — Nine of the eleven kinds of content have nowhere to live

**Status:** the console now says so; the routes do not exist
**Severity:** high
**Found by:** Devi, writing up her autumn sample sale
**Surface:** `piggles|sparx/apps/workbench/surfaces/cms/content-detail.tsx` + `wizeworks/apps/site`
**Filed:** 2026-09-16
**Family:** [[feedback_a_promise_in_copy_is_a_contract]] · [[feedback_screen_over_a_function_nobody_calls]]

## What she saw

Content → New. Eleven kinds on offer:

> Testimonial · Announcement · Blog post · Case study · Event · Help article ·
> Job posting · Landing page · News article · Page · Team member

She picked **Event**, got a complete editor — Title, Description, Starts, Ends,
Location, Virtual event, Registration URL, Featured image — and under the
address box:

> **Web address**
> _The end of the address where people will find this on your site._
>
> **This will live at /events/…. Leave it and we'll make one from the title.**

Nothing lives at `/events/` anything.

## Measured

The customer-facing site resolves a slug at exactly two entry points, each
asking for ONE hard-coded type (`wizeworks/apps/site/lib/content.ts`):

| route             | resolver            | type asked for |
| ----------------- | ------------------- | -------------- |
| `app/blog/[slug]` | `getBlogPostBySlug` | `'blog_post'`  |
| `app/[...slug]`   | `getPageBySlug`     | `'page'`       |

`app/[...slug]` tries, in order: a silica page owning that exact slug, a builder
page owning that exact slug, a `page` entry with that slug, a tenant redirect,
then 404. Nothing anywhere resolves a slug against a content type's own
`url_pattern`, so these nine have no route:

| kind         | promised address       | served  |
| ------------ | ---------------------- | ------- |
| Announcement | `/press/{slug}`        | no      |
| Case study   | `/case-studies/{slug}` | no      |
| Event        | `/events/{slug}`       | no      |
| Help article | `/help/{slug}`         | no      |
| Job posting  | `/careers/{slug}`      | no      |
| Landing page | `/{slug}`              | no      |
| News article | `/news/{slug}`         | no      |
| Team member  | `/team/{slug}`         | no      |
| Testimonial  | (hers, no pattern)     | n/a     |
| Blog post    | `/blog/{slug}`         | **yes** |
| Page         | `/{slug}`              | **yes** |

Landing page is the sharpest of them: it shares `/{slug}` with Page, and
`getPageBySlug` asks for `type: 'page'` by name, so a landing page at the very
same address still 404s.

Nobody has hit it. Across the platform:

```sql
select type_key, count(*), count(*) filter (where status='published')
from content_entries where deleted_at is null group by 1;
```

| type                 | entries | published |
| -------------------- | ------- | --------- |
| `page`               | 545     | 25        |
| `blog_post`          | 156     | 139       |
| `product_spec_sheet` | 1       | 0         |

The trap is armed rather than sprung, and the console is what arms it: it offers
the kind, builds the editor, prints the address, and would say "Published · Live
since…" over a dead link.

The intent was clearly there — `event.ts` carries the comment "**Routable so it
can have a registration page**", and the builder can bind a page template to any
content type (`mapCmsContentType`). What is missing is the route that reaches
such a template.

## What was fixed

Her site could not be reached to verify a change to it (every tenant on
`localhost:3004` answers "Site not found", so a rendering change could be
shipped but not proven, and an unproven change to a live rendering path is worth
less than none). So the fix is the half that can be proven, in the console where
she is standing: **stop promising an address nothing serves.**

For a kind with no route the address card now reads:

> ⚠ Your site has no page for this kind yet, so nothing is published at
> /events/… and a visitor following that address will not find it. What you
> write is kept here and is yours to use elsewhere. Leave the box and we'll make
> an address from the title, ready for when there is a page.

Blog post and Page keep the ordinary sentence, unchanged.

## What holds it

`SITE_SERVED_TYPES` in `surfaces/cms/routable.ts` is a COPY of a fact the site
app owns, and the workbench may not import the site app. So
`scripts/check-cms-routes.mjs` reads the real types out of
`wizeworks/apps/site/lib/content.ts` and fails if the two disagree — in either
direction. Add the route and the check goes red; adding the key turns the
ordinary promise back on for that kind.

Wired as `pnpm check:cms-routes` and into `.githooks/pre-push`. Proven red three
ways: the site growing a route, the console over-promising, and the scanned file
moving away. Its first run found a real fault in itself — a bare `type: '…'`
pattern matched `{type:'doc'}` written inside a comment and reported `doc` as a
served route, so it is anchored on `tenant: tenantSlug` and reads the call.

## Still open

The route. A generic resolver in `app/[...slug]`, tried after the `page` lookup
and before the 404, would reach all nine: split the slug, match a content type
whose `url_pattern` fits, fetch by type and slug, render through the record
template if the tenant has built one. It is not shipped here because it cannot
be run.
