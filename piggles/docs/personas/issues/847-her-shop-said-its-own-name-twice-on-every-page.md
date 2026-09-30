# 847 — Her shop said its own name twice on every page

**Status:** fixed
**Severity:** every tab, every search result and every share card, on the sites whose owners wrote the most careful titles
**Found by:** P03 · act 293, reading P01's site as a stranger
**Surface:** Page titles across every tenant site
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** the rendered `<title>`, `og:title` and `twitter:title` on 3 sites, before and after

## What a browser tab said

```
What we bake — Thistle & Rye · Thistle & Rye
Order for collection — Thistle & Rye · Thistle & Rye
About Thistle & Rye — the bakery on Mercer Lane · Thistle & Rye
Find us — Thistle & Rye, 114 Mercer Lane · Thistle & Rye
```

Four of her five pages. The same in `og:title` and `twitter:title`, so a share of
any of them carried it too.

## Why

The root layout does the right thing:

```ts
title: { default: site.name, template: `%s · ${site.name}` },
```

A page called "What we bake" becomes "What we bake · Thistle & Rye" for free.
That is correct and it is what most pages want.

But a business owner filling in the **Search wording** box does not type "What we
bake". She types what every page of every website she has ever read looks like:

> What we bake — Thistle & Rye

And the template appended her name to her name.

**This had already been fixed one layer down.** `[...slug]/page.tsx` carries the
comment:

> NOT `… · ${site.name}` — the root layout's title template already appends it,
> so carrying the brand here too shipped every page with no SEO title as
> "Collection orders · Thistle & Rye · Thistle & Rye" in the browser tab.

That fix stopped the CODE adding a second name, on the same bakery, with the same
words. Nothing stopped the AUTHOR's own name being added to.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## How many

Asked of the database rather than guessed:

| site          | pages with a title of their own | saying the name twice |
| ------------- | ------------------------------- | --------------------- |
| Thistle & Rye | 7                               | **7**                 |
| Halo & Hem    | 7                               | **7**                 |
| Juniper Row   | 52                              | **6**                 |

**20 pages on 3 sites**, and they are the three whose owners filled the box in
most carefully. Every site that left the field blank was fine, because the
template had nothing of its own to double.

That is the shape worth remembering: the defect only reached the people who did
the extra work.

## The fix

One rule, in one file, used by every page that builds a title.

```ts
export function metadataTitle(title: string, siteName: string): string | { absolute: string } {
  return namesTheSite(title, siteName) ? { absolute: title } : title;
}
```

`{ absolute }` is Next's own way of saying "do not apply the template". A title
that does not mention the shop still gets the suffix, exactly as before.

`socialTitle` is the same rule for the card, where there is no template and the
brand is appended by hand. A card is seen with none of the site around it, so a
headline with no shop on it is a headline nobody can place — but it still only
gets one.

**Anywhere in the title, not only the end.** "Thistle & Rye opening hours" names
the shop as surely as "Opening hours — Thistle & Rye" does. And a name under
three characters is not looked for at all: matching "Co" inside "Cookies" would
strip the brand from titles that never carried one, which is the worse of the two
failures.

Applied at every `generateMetadata` that feeds the template: the silica page, the
builder page, the legacy CMS page, the blog entry, the booking page, a category,
a collection, a product, and the home page's social card.

**Proved red:** making `namesTheSite` always answer no fails 5 of the 10 tests
and leaves the 5 that hold the ordinary case.
[[feedback_a_test_that_cannot_go_red]]

## Measured after

```
/           Thistle & Rye — bakery on Mercer Lane
/bake       What we bake — Thistle & Rye
/order      Order for collection — Thistle & Rye
/about      About Thistle & Rye — the bakery on Mercer Lane
/find-us    Find us — Thistle & Rye, 114 Mercer Lane
```

`og:title` matches, line for line. And on a site that does NOT name itself, the
suffix still arrives:

```
/products/the-everyday-tee    The Everyday Tee · Juniper Row
```

## The other one on the same page

The bakery's booking page put this in the tab:

```
Book an appointment · Thistle & Rye
```

A bakery does not take appointments. It takes table reservations, and the page
itself knows: the booking block's own heading defaults to **"Book with us"**.

One page, two defaults, and only one of them assumed an industry
([[feedback_industry_agnostic_no_diesel]]). The tab now says the same words the
page draws, which is right for a salon, a bakery, a garage and a surveyor alike:

```
Book with us · Thistle & Rye
```

## Files

- `wizeworks/apps/site/lib/page-title.ts` (new)
- `wizeworks/apps/site/lib/page-title.test.ts` (new)
- `wizeworks/apps/site/app/page.tsx`
- `wizeworks/apps/site/app/[...slug]/page.tsx`
- `wizeworks/apps/site/app/blog/[slug]/page.tsx`
- `wizeworks/apps/site/app/book/page.tsx`
- `wizeworks/apps/site/app/book/[serviceId]/page.tsx`
- `wizeworks/apps/site/app/category/[handle]/page.tsx`
- `wizeworks/apps/site/app/collections/[handle]/page.tsx`
- `wizeworks/apps/site/app/products/[handle]/page.tsx`

## The thing to remember

**A template is a promise about what the author did not write.** This one was
written for a title field people leave blank, and the people who filled it in
were the ones it broke. Nothing in the console showed them the result, because a
`<title>` is the one piece of a page an author never sees while writing it.
