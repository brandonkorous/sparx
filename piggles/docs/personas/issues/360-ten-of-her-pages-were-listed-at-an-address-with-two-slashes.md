# 360 — Ten of her pages were listed at an address with two slashes

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · opening Get Found › Things worth fixing
**Surface:** mypiggles › Get Found › Things worth fixing
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** ten doubled addresses, gone, without her pressing anything

## What happened

"Things worth fixing" lists every page on her site with its score and its address.
Ten of the fifty-one printed the address wrong:

```
62  Book        //book
62  Register    //account/register
62  Login       //account/login
62  Products    //products
…
```

Ten out of fifty-one, and the pattern is exactly the wrong one: every single doubled
address is a page **the platform made for her** — her basket, her sign-in, her
product index. Her own pages (`/about`, `/contact`, `/shop`) were fine.

## What should have happened

`/book`. `//book` is not a typo in a label; it is a different address.

## How to reproduce

Every time.

1. Sign in as Devi, open **Get Found › Things worth fixing**.
2. Read the addresses under the page names. Every page whose stored slug begins with
   a slash prints two.

## Why it matters

Cosmetic in effect, and worth saying so, but it looks like broken software on a
screen whose entire job is to tell you what on your site is broken. It undermines
the one thing the screen is for.

It also concentrates on the pages Piggles created. An owner reading it learns that
the parts she did not make are the parts that look wrong.

## Where it lives

- [seo-audit.ts](../../../../wizeworks/services/api-rest/src/lib/seo-audit.ts) `pathFor`, and the new `storedPath`
- [audit.ts](../../../../wizeworks/services/api-rest/src/routes/v1/seo/audit.ts) + [reports.ts](../../../../wizeworks/services/api-rest/src/routes/v1/seo/reports.ts) — the two readers
- [audit.ts](../../../../wizeworks/packages/seo-audit/src/audit.ts) — the check names, found on the same screen

## The fix

`pathFor` built the address as `` `/${slug}` ``. That assumes the bare form, and this
codebase stores slugs both ways — `about` and `/cart` sit in the same table. Slugs
are now taken bare and composed through `normalizePath`, which is the same helper the
page report uses to match a slug to its traffic, so both vintages land on one path.

**`normalizePath` is deliberately not the place to fix this.** It adds a leading
slash when one is missing and never removes one, because `//example.com/x` is a
protocol-relative URL and site-lint checks real links with it. Collapsing there would
turn a valid external link into `/example.com/x`. Only where a string is known to be
a site-relative path is it right, and that is what the new `storedPath` is.

Which matters because `seo_audits.path` is a **stored** column, written when the
audit last ran. Fixing the writer alone would have left every existing row doubled
until somebody thought to press **Rescan the site**, and nobody should have to know
that. `storedPath` normalizes on the way out, so all ten healed on the next load; the
next audit rewrites them properly of its own accord. Both readers go through it, and
it exists as a named helper precisely so a third cannot quietly skip it.

### What was also on that screen

Reading it properly, the check names are not written for the person reading them:

| Was                        | Now                                      |
| -------------------------- | ---------------------------------------- |
| Meta title is set          | The page has a title                     |
| Meta description is set    | The page has a short summary             |
| Page is indexable          | Search engines are allowed to list it    |
| Listed in sitemap.xml      | It is on the list we give search engines |
| Canonical & readable slug  | The web address is tidy                  |
| Image alt text             | Every picture is described               |
| Heading structure          | One main heading                         |
| Structured data (JSON-LD)  | Extra detail search engines can read     |
| Discoverable by AI engines | AI assistants can find it                |

Forty-one strings in all — labels, the values beside them (`noindex — by design?`,
`self · clean`, `3× H1`, `5 / 8 ok`), the tips, and the action buttons (`Edit slug`,
`Enable schema`) — plus the four category headings (`Indexability`, `Social & AIO`).
The page-results surface already states the house answer in its own header comment:
_"'Bounce rate' and 'LCP' are jargon; 'Nobody came back' and 'How long it takes to
appear' are the same facts in the language of someone who runs a business."_ This
screen was the counter-example.

Rewritten in `@wizeworks/seo-audit` rather than overridden per product: the check
`id`s are the stable keys, nothing reads a label, and both products are for
non-technical owners. Two tests asserted the old strings; one now asserts the new
value, and the other — which was really testing WHICH check wins — asserts against
that check's own tip instead of a literal fragment, so a future rewording cannot make
it claim the wrong check won.

## Confirmed by

> Reloaded **Things worth fixing** as Devi. **Ten doubled addresses became zero**,
> without pressing Rescan: `/book`, `/cart`, `/account/login` and the rest all read
> correctly.

`@wizeworks/seo-audit` 26/26. Typecheck clean on the package and on api-rest.

## Rating effect

`seo.audits` — previously unrated. Recorded in [rating.md](../rating.md).
