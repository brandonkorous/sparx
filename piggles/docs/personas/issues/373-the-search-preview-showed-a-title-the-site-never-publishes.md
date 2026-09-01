# 373 — The search preview showed a title the site never publishes

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · reading her own page titles as a search engine would
**Surface:** mypiggles › Sell › a product › SEO
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** the preview on The Ash Overshirt, now matching the page's real `<title>`

## What happened

Five of Devi's page titles say her business name twice:

| Page                 | What ships                                                |
| -------------------- | --------------------------------------------------------- |
| Contact              | Contact **Juniper Row** · **Juniper Row**                 |
| Shop                 | Shop the **Juniper Row** collection · **Juniper Row**     |
| Shipping and returns | Shipping and returns at **Juniper Row** · **Juniper Row** |
| Made in the studio   | How every **Juniper Row** piece is made · **Juniper Row** |
| About                | Made by me, in Denver · Juniper Row                       |

She wrote the first half of each one herself, and she wrote the business name
into it because nothing told her the site adds it.

## Why it happened

The site's root layout sets `title: { template: '%s · <site name>' }`, so every
page title gets the business name appended. That is a good default and it is not
the bug.

The bug is the SEO tab, whose whole design is that an owner should not have to
imagine the result. Its own header says so:

> Three fields, and the whole design problem is that none of them mean anything
> on their own. "SEO title, 47/60 characters" tells an owner nothing about what
> they are about to publish. So this tab is built around two PREVIEWS.

And the search preview rendered:

```ts
const usedTitle = draft.seoTitle.trim() || product.title;
```

The bare title, with no suffix. So the preview showed **The Ash Overshirt** while
the page publishes **The Ash Overshirt · Juniper Row**. An owner looking at that
preview and thinking "it should say who I am" adds it by hand, and gets it twice.

Two more consequences of the same line:

- **The length caution measured the wrong string.** It compared
  `draft.seoTitle.trim().length` against 60, so a 58-character title passed the
  check and shipped at 71 — past the point the badge exists to warn about.
- **The empty-field hint never mentioned the suffix**, so the only place an owner
  could have learned about it was by publishing and looking.

## The fix

The preview and the caution both read the **published** title now:

```ts
const siteName = sites.find((site) => site.id === propertyId)?.name ?? '';
const searchTitle = siteName ? `${usedTitle} · ${siteName}` : usedTitle;
```

- the search result shows `searchTitle`
- the length badge measures `searchTitle.length`
- the empty-field hint says "Juniper Row is added on the end either way, so you do
  not need to type it", and the filled-field hint says the character count
  includes it

**The share card below is a different string and was already right.** `og:title`
is set directly by the route (`title: product.seoTitle ?? product.title`) and
takes no template, so a pasted link really does show the bare name. Suffixing both
previews would have fixed one and broken the other — measured on the live page
before touching either.

The site name falls back to empty rather than to a guess, so a preview never
invents a suffix it cannot confirm.

## Confirming it

On The Ash Overshirt's SEO tab, against the live page's real `<title>`:

| Where                | Before                          | After                                    |
| -------------------- | ------------------------------- | ---------------------------------------- |
| The search preview   | The Ash Overshirt               | **The Ash Overshirt · Juniper Row**      |
| The page's own title | The Ash Overshirt · Juniper Row | unchanged                                |
| The share card       | The Ash Overshirt               | unchanged, and correct                   |
| The empty-field hint | said nothing                    | names the suffix and says not to type it |

## Still open

- **Her five doubled titles are still doubled.** The tool no longer misleads, but
  what she already wrote is what she already wrote, and rewriting an owner's copy
  is not mine to do. The pages this affects are Contact, Shop, Shipping and
  returns, and Made in the studio.
- **Page titles are edited in the studio, not here**, and that editor has no
  preview at all. This fix covers the product SEO tab; the same suffix applies to
  every page, so the same misreading is available there. Whether the studio's page
  settings should carry a search preview is a design question for that panel.
- **Journal has no search title or summary**, so it inherits the site's tagline,
  "Made here, in small runs." True, and not what a blog index should say to
  somebody searching. Hers to write; the tool is not stopping her.
