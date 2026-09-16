# 518 — A dark site asked to be deleted from search instead of asking search to wait

**Status:** fixed and proven
**Severity:** critical
**Found by:** Devi, opening her own public site for the first time since it went dark
**Surface:** `wizeworks/apps/site` — `lib/suspended.ts`, `app/layout.tsx`, and the three crawler routes
**Filed:** 2026-09-15
**Follows:** [503](503-a-dark-site-still-invited-the-crawlers.md)

## What she did

Opened `juniper-row` on the storefront to see what a customer sees while the
console's red band says her site is offline. The overlay is right, neutral and
kind: "Back soon. This site is taking a short break."

Then she looked at what the same page says to a search engine, because a shop
that comes back to no listings has not really come back.

## What she got

```
GET /robots.txt     200  User-agent: *  Disallow: /     cache-control: max-age=300
GET /sitemap.xml    404
GET /llms.txt       404
GET /               200  <title>Temporarily unavailable</title>
                         <meta name="robots" content="noindex, nofollow">
```

Issue 503 put those there on purpose, four weeks ago, and they are the wrong
instruments. Every one of them means **remove me**. None of them means **wait**,
which is the only true thing about a shop whose card expired on Sunday.

## Why it is worse than it looks

**The two guards cancel each other out.** A crawler reads `robots.txt` before it
reads anything else. `Disallow: /` is a rule it stores and obeys until it
re-reads the file, so from that moment it does not fetch the pages — which means
it never sees the `noindex` those pages carry. The page-level guard only ever
reached crawlers that had ignored the disallow. And the moment it did reach one,
what it asked for was deletion.

So the shop got both halves of the damage and neither half of the protection:

- crawlers that obeyed `robots.txt` stopped verifying the URLs they already had
- crawlers that did not obey it were told to drop the listings outright

**`noindex` is the instruction to remove a URL from search.** That is its job.
It is the correct answer for a page that should not be listed and the wrong
answer for a page that will be listed again on Thursday. The listing does not
come back when the invoice is paid; it has to be re-earned.

**404 does not mean "ask again later" either.** The old `lib/suspended.ts` said
in its own comment that a missing sitemap "reads as 'ask again later', which is
the truth". It does not. 404 reads as "there is nothing at this address", and a
sitemap that 404s repeatedly gets dropped. The comment had the right intent and
the code picked the wrong status to express it.

**The five-minute cache was reasoning toward the right answer and stopping short
of it.** Its comment already said a crawler holding a stale "stay out" costs the
business re-crawling it has already paid for. That is an argument for `no-store`,
not for three hundred seconds of it.

There is exactly one status that means what a suspended shop needs to say, and
none of the four answers above was it.

## What changed

Every dark answer is now **503 with `Retry-After: 600` and `cache-control:
no-store`**. That is the signal a search engine is built to receive from a site
that is temporarily down: it pauses, it keeps what it already has, and it comes
back. Nothing is cached, because suspension lifts the moment a payment goes
through and a held copy would keep the shop dark to a crawler after the business
has paid to be visible.

| surface       | was                   | now                   |
| ------------- | --------------------- | --------------------- |
| `robots.txt`  | `200` `Disallow: /`   | `503` + `Retry-After` |
| `sitemap.xml` | `404`                 | `503` + `Retry-After` |
| `llms.txt`    | `404`                 | `503` + `Retry-After` |
| every page    | `noindex, nofollow`   | no robots directive   |
| cache         | `public, max-age=300` | `no-store`            |

The neutral `<title>Temporarily unavailable</title>` stays on every page. The
overlay must never sit in a search result under the shop's real name and
description, and that part of 503's fix was right.

The page HTML still answers `200`. A root layout in the App Router cannot set a
response status, and the only way to move it is a tenant lookup in the proxy on
every request — which would put a cache in front of the suspension state and
delay the lift after payment. The console promises "it comes back as soon as a
payment goes through", and that sentence is worth more than the status code:
with `robots.txt` answering 503 the crawl is already paused before any page is
fetched, so the page status is reached only by a crawler that ignored it.

## The neighbour it left behind

Fixing `lib/suspended.ts` alone changed nothing on screen. Every page still
answered `noindex, nofollow`, because `app/layout.tsx` held a **second copy** of
the same decision, written inline eight lines long. Issue 503's finding was that
route metadata overrides a layout's; the two copies agreeing was the only thing
that had been hiding it. The moment the shared one changed, the layout went on
sending the opposite answer.

The layout now returns `SUSPENDED_METADATA`. There is one definition.

Only the measurement found this. The diff of `lib/suspended.ts` looked complete
and correct, the tests passed, and the pages were unchanged.

## Proven

Six guards in `lib/suspended.test.ts`, each proven red by restoring the old
behavior — 6 failed, 6 passed, with the defects stated as values:

```
expected 'user-agent: *\ndisallow: /\n' not to contain 'disallow'
expected { index: false, follow: false } to be undefined
expected 404 to be 503
expected 'public, max-age=300' to be 'no-store'
```

Dark (Juniper Row, suspended), measured live:

```
/robots.txt     503   retry-after: 600   cache-control: no-store
/sitemap.xml    503   retry-after: 600   cache-control: no-store
/llms.txt       503   retry-after: 600   cache-control: no-store
/                     Temporarily unavailable   no robots meta
/products/…           Temporarily unavailable   no robots meta
/collections/…        Temporarily unavailable   no robots meta
/category/…           Temporarily unavailable   no robots meta
/book                 Temporarily unavailable   no robots meta
```

Healthy (Ridgeline Outfitters, active) — unchanged:

```
/robots.txt   200      /sitemap.xml  200      /llms.txt  200
/             200      <title>Ridgeline Outfitters</title>   robots: index, follow
```
