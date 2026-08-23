# 096 — Her booking page went to search as the platform's sentence, not hers

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** the published site — `/book`
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · Nia · on the live site 2026-08-22

## What happened

The booking page is the one page Nia's whole website exists to deliver somebody
to. The console gives it, like every page, a **Search wording** panel — a title
and a description, in her own words, with the field labels written for someone who
has never heard the word "meta".

She filled them in. The live page ignored both.

| Where                       | What it actually said              |
| --------------------------- | ---------------------------------- |
| Browser tab / search result | `Book an appointment · Halo & Hem` |
| Description                 | `Considered hair, calmly done.`    |

The first is a constant. The second is her site tagline, borrowed because there
was nothing else — so every Piggles booking page in the world went to search under
the same headline, described by whatever the owner happened to put in a completely
different field.

Read back from the database, the page's own wording was sitting there unused:

```
seo_title       Book a chair at Halo & Hem — live times, real prices
seo_description All ten services at Halo & Hem with their real prices and lengths…
```

## Why it matters

A search result is often the first sentence anyone reads about a business, and
this is the page a booking comes from. "Book an appointment" says nothing about
who, what, where or why — and it is identical for every salon, clinic and garage
on the platform, which is the opposite of what a search engine is being asked to
tell apart.

It is also silent in the console: the fields accept text, save it, and report
success. Nothing anywhere says the page will not use them
([[feedback_absent_behaves_like_fine]]).

## Where it lives

[wizeworks/apps/site/app/book/page.tsx](../../../../wizeworks/apps/site/app/book/page.tsx):

```ts
export const metadata: Metadata = { title: 'Book an appointment' };
```

A module-scope constant. It cannot see the tenant, the site or the page, so there
was no path by which the owner's wording could have reached it. Every other page
on the site goes through `generateMetadata` in `[...slug]` and honours
`seoTitle` / `seoDescription` properly — `/book` is a dedicated route that
shadows the builder page at that slug, and the metadata was the half of it that
never caught up. The BODY of the page was already the tenant's own published
shell; only its wording in search was not.

## The fix

`generateMetadata`, reading the same published page the route already renders:

```ts
const published = await getPublishedSilicaPage(site.slug, 'book');
const title = clean(published?.seoTitle) ?? 'Book an appointment';
const description = clean(published?.seoDescription);
```

Three details worth keeping:

- **The old constant is the fallback**, so a site that has never opened the page
  reads exactly as it does today.
- **No ` · <site>` suffix on `title`.** The root layout's title template already
  appends it; carrying the brand here as well is how a page ends up named
  "… · Halo & Hem · Halo & Hem" in the tab. `openGraph.title` keeps the brand,
  because a social card is seen with none of the site around it.
- **Blank counts as unset.** A whitespace-only title falls through to the default
  rather than shipping an empty `<title>`.

## Confirmed by

Re-run on the live site 2026-08-22:

```
<title>Book a chair at Halo &amp; Hem — live times, real prices · Halo &amp; Hem</title>
<meta name="description" content="All ten services at Halo &amp; Hem with their real
prices and lengths, and the times Nia and Dara actually have free. Color needs a
free consultation first, and three appointments hold a $25 deposit."/>
```

The first read after the change still served the old title from a cached render;
it took a second request to see it. Worth knowing, because a single stale read is
exactly how a working fix gets reported as broken.

## Rating effect

The published `/book` is scored in [rating.md](../rating.md).
