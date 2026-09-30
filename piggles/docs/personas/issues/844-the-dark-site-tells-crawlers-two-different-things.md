# 844 — A dark site tells a crawler two different things at once

**Status:** fixed
**Severity:** a lapsed shop's listings can be replaced by its own "Back soon" page
**Found by:** P03 · Juniper Row · act 290
**Surface:** P01 site — Thistle & Rye (and six more)
**Filed:** 2026-09-25
**Fixed:** 2026-09-26
**Confirmed by:** measured against the running site renderer, seven tenants, cache busted

## What a stranger sees

Opening Thistle & Rye's address in a browser that has never been there:

> ### Back soon
>
> This site is taking a short break. Thanks for your patience, and please check
> again a little later.

The bakery's trial ended on 2026-09-02 and the seven-day grace ran out on the
9th, so the site went dark. **That part is correct** and the overlay is well
judged: it never says "this business did not pay", it carries no platform
wordplay, and it is self-contained so it renders without the tenant's theme.

## The two answers

`wizeworks/apps/site/lib/suspended.ts` is forty lines of reasoning about exactly
one question, and it reaches the right answer:

> There is exactly one status that means ask again later, and it is the one
> below. … every dark answer is now **503 with `Retry-After`**, which is the
> signal a search engine is built to receive for a site that is temporarily
> down: it pauses, it holds what it already has, and it comes back.

It then applies that to `robots.txt`, `sitemap.xml` and `llms.txt` — the three
files only a machine reads — and not to the pages.

Measured on all seven dark tenants, each with a cache-busting query:

|                 |    page | robots.txt | sitemap.xml | llms.txt |
| --------------- | ------: | ---------: | ----------: | -------: |
| every dark site | **200** |        503 |         503 |      503 |

So one outage gives a crawler two answers. `robots.txt` says _pause, I am down,
ask again in ten minutes._ The home page says _200 OK, here is Thistle & Rye,
and it says "Back soon"._

And because the metadata deliberately carries **no `noindex`** — which is right,
and the file explains at length why, since `noindex` asks for the listing to be
deleted — a 200 with no noindex is the one combination that lets the dark page be
indexed in place of the shop. The file's own words: `noindex` "is the one outcome
this whole file exists to prevent." A 200 reaches the same outcome by the other
road, and quietly.

## How many

Every piggles business except one:

| business          | what a visitor gets       |
| ----------------- | ------------------------- |
| Juniper Row       | live (paid to 2026-10-19) |
| Thistle & Rye     | dark                      |
| Halo & Hem        | dark                      |
| Wildroot Flowers  | dark                      |
| The Marrow Review | dark                      |
| Thistle Bakery    | dark                      |
| E2E's workspace   | dark                      |
| Marta's workspace | dark                      |

Seven of eight. Each was signed up in mid-August, each got fourteen days and
seven more, and none of them added a card. (**Re-measured the next day, on
2026-09-26, it is three of eight**: Thistle & Rye, Halo & Hem, Wildroot Flowers
and The Marrow Review all read `active` again. The fix was verified against the
three that are still dark. A phase that moves between one day and the next is
exactly why the edge cache is ten minutes and not an hour.) **The rule is working exactly as
written** — which is the point worth noticing: a demo or persona account goes
dark about three weeks after it is made, on its own, and the only tenant still
serving is the one somebody gave an active subscription.

## The trade-off, and how it was priced down

A Next 16 layout cannot set a status code. The supported places are the edge
proxy (`wizeworks/apps/site/proxy.ts`) or a route handler, and the proxy did not
know the tenant's billing phase.

Teaching it means **a tenant lookup at the edge**, on the busiest path in the
platform, for a state that is rare by design. That was filed as a real
trade-off rather than an oversight. It is fixed now, and three things took the
cost down to nothing that matters:

**Documents only.** An image, a script, a font and a `_next` chunk are not search
results and nobody reads their status. `robots.txt`, `sitemap.xml` and `llms.txt`
are excluded too, because they already answer their own 503 — asking again would
buy a lookup to reach an answer already in hand.

**Cached per host**, for the same ten minutes `Retry-After` already promises a
crawler. A busy live shop costs one lookup per host per ten minutes, not one per
request. Not longer than ten minutes either: holding the answer past the window
we ask a crawler to wait would keep a shop dark after it has paid.

**Fails open, always.** A lookup that errors, times out (1.5s) or answers a
payload without a phase leaves the site serving. The resolver downstream already
follows this rule — "a site is NEVER suspended on missing data" — and a guard
that can dark a paid-up shop because an API blinked is worse than the bug it
fixes. Four tests hold this, one per way it can go wrong.

A zone host names its own tenant, so the decode is free. **A custom domain is
left alone**: it would need a second round trip at the edge, and one is the
budget. Those sites still get the overlay from the layout, exactly as before,
and still at 200. That is the honest limit of this fix and it is stated rather
than papered over.

## What the page answers now

```
/                    503   retry-after: 600
/products/anything   503   retry-after: 600
/robots.txt          503   retry-after: 600
/sitemap.xml         503   retry-after: 600
```

Measured on all three tenants that are dark today, home page and a deep page
each, cache busted. **The body is unchanged**: a visitor still reads "Back soon",
because a browser renders a 503 body like any other.

And the part that mattered more than the fix — **every live site is untouched**:

```
juniper-row  halo-and-hem  quiet-haven-3783  wildroot-flowers  marrow-review
   200            200             200              200              200
```

Juniper Row still answers with its own title, `Juniper Row, small-batch clothing
made in Denver`, not an overlay. Assets on a dark site are still 200, so nothing
that has to load in order to draw the page was darkened with it.

## Two duplicates closed on the way

**`isLocalDevHost` was written twice** — once in the proxy and once in the
resolver — each with a comment saying it mirrored the other. It is one security
gate deciding whether a `?tenant=` override may steer site selection, and two
copies of one gate is the shape where a fix reaches one of them. It now lives in
`lib/site-host`, along with the zone decode the proxy needed anyway.

**The overlay's words were written twice too**, once the proxy had to draw it
without the app's CSS. They are constants in `lib/suspended` now, read by both,
with a test that fails if either renderer starts carrying its own copy.

The proxy's document is genuinely self-contained — inline styles, no Tailwind
bundle, no font package, no tenant theme — which is the constraint
`components/site-suspended` already stated for itself and did not meet.

## One thing to check before believing any of this again

Two tenants first measured as **live pages with a 503 robots.txt**, which read
as the same contradiction pointing the other way. It was the page cache: the
same URL had been fetched moments earlier without a buster. With a fresh query
string both are dark, like the rest.

That is the second measurement this session that pointed at a defect and was an
artifact of how it was taken. [[feedback_no_arguing_without_proof]]

## What this blocks

Eight of the eleven remaining rows in `rating.md` are for businesses that have
never been created — Herrera & Co., Wildwater Climbing, Ostrander Auto, Circuit
& Coil, Kanto and Brandt & Sons are not in the database under either brand. Of
the sites that do exist, every one except Devi's is dark.

So the site rows cannot be scored as sites today, for two separate reasons, and
both are worth saying out loud rather than working around.

## Files

- `wizeworks/apps/site/proxy.ts`
- `wizeworks/apps/site/lib/dark-at-the-edge.ts` (new)
- `wizeworks/apps/site/lib/dark-at-the-edge.test.ts` (new)
- `wizeworks/apps/site/lib/site-host.ts` (new, the pure host decode both readers share)
- `wizeworks/apps/site/lib/site-context.ts`
- `wizeworks/apps/site/lib/suspended.ts`
- `wizeworks/apps/site/lib/suspended.test.ts`
- `wizeworks/apps/site/components/site-suspended.tsx`

## The thing to remember

**A fix aimed at crawlers reached the three files only crawlers read.** The
pages were not on the list, because the list was written from the crawler's
file names rather than from the crawler's route through the site — and the page
is the only one of the four that ever becomes a search result.
