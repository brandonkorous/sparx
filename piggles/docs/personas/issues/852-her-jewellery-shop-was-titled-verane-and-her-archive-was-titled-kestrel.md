# 852 — Her archive was titled Kestrel, and her journal was titled Vérane

**Status:** fixed
**Severity:** **major** — 81 published pages across 33 sites carried another
company's name in the one place nothing on the page shows
**Found by:** P03 · act 297, reading the page titles of her own published sites
**Surface:** Every page a design installs, and the browser tab, search result and
link preview it produces
**Filed:** 2026-09-28
**Fixed:** 2026-09-28
**Confirmed by:** the repair run against the real database, re-measured to zero,
and re-run to prove it is a no-op

## What was in the tab

Devi's **Archive** and **Journal** sites are properly hers: nine published pages
each, walked and working. Every one of the eighteen was titled after a business
that does not exist.

```
archive · (home)   Kestrel — well-made essentials, built to be kept
archive · about    About Kestrel — clothes that stay
archive · search   Search — Kestrel
journal · (home)   Vérane — fine jewellery & fragrance
journal · contact  Contact — Vérane
```

And the sentence a search engine prints under it, to match:

```
Search Kestrel for a product, a collection or a page.
Get in touch with Vérane — questions, orders and anything else you need.
```

Kestrel is the demo company `sparx-retail-apparel-minimal` is built around.
Vérane is `sparx-couture-serif`'s. She installed a **look**, and it brought a
name.

**Nothing on the page shows a title.** It is the browser tab, the search result,
the link preview and the name a bookmark takes — so it is the one piece of
installed content an owner cannot find by looking at her own site. 849's panel
does not reach it either: that reports page bodies, products and articles.

## It was settled a month ago, one table over

[210](210-her-clothing-shop-was-branded-as-a-catering-company.md) found installs
stamping the sample company's `businessName` and tagline onto the real business,
and fixed it. Its conclusion is one sentence:

> **A template gives you a LOOK. Your name and your words are yours.**

`seoTitle` and `seoDescription` are that same value in a different column, written
by a different line, and nobody went back for them. It is the shape this keeps
taking. [[feedback_a_fix_leaves_its_neighbour_behind]]

## How many

```
191 of 191 shipped designs carry seoTitle and seoDescription — 1,173 of each
158 of them name a business that does not exist
235 live pages still carried the design's exact title, 76 of them PUBLISHED
```

Counted by comparing the live row to the **baseline** the install recorded (docs/55
§4), so it is character-for-character, not a guess at which words are a company
name. The ten worst:

| business             | site     | published pages | titled      |
| -------------------- | -------- | --------------- | ----------- |
| WizeWorks LLC        | personal | 9               | Threshold   |
| WizeWorks LLC        | primary  | 9               | Voltage     |
| **Juniper Row**      | archive  | 9               | **Kestrel** |
| **Juniper Row**      | journal  | 9               | **Vérane**  |
| Warm Delta 7239      | primary  | 8               | Threshold   |
| Lucky Falcon 4198    | primary  | 7               | Forge       |
| Forge Fitness Studio | primary  | 6               | **Tempo**   |
| Halden Consulting    | primary  | 5               | **Mosaic**  |

A fitness studio called Forge, whose website says Tempo. A consultancy called
Halden, whose website says Mosaic.

## Both seams, because one of them would have put it back

**The install.** `installSite` and `addPage` each wrote the bundle's SEO columns
through their own copy of the same block. They now share
`installedPageColumns`, one allow-list, so they cannot drift on what a design is
allowed to write.

**The update.** `blueprint-updater`'s page handler merge-wrote `seoTitle` and
`seoDescription` too, so the next version of a design would have put its demo
title straight back onto pages this fix had just cleaned. That was the neighbour,
and it is closed in the same change.

`extractCurrent` still **reads** both, deliberately. Once the rows and the
baselines are cleared together, base and live agree on absent — and a title she
writes herself still shows up as the edit it is.

`canonical`, `ogImage` and `noindex` stay installable. No bundle ships one (0 of
191), so nothing changes today, and none of them can name a business.

## What she gets instead, which was already argued for

Nothing has to be invented. The root layout already resolves a title from her own
data, and keeps up with it if she renames the site:

```ts
title: { default: site.name, template: `%s · ${site.name}` }
```

```
before   About Kestrel — clothes that stay
after    About · Juniper Row Archive
```

The description is **omitted**, which the same file had already decided, in the
same words, for the site-level one:

> Where they have not written one, this is OMITTED rather than invented: a crawler
> with no description writes a snippet from the page, **which is always truer than
> a template guess about what kind of business this is.**

A demo company's name is worse than a guess.

## The rows already written

```
APPLIED: 240 of 252 installed page(s) still carried the design's own title or
description — 81 of them published, across 33 site(s).
12 page(s) had been written by their owner and were left alone.
```

`wizeworks/packages/db/scripts/backfill-design-page-titles.ts` clears a value only
where it is **identical to the baseline the install recorded**. No pattern
matching, no list of demo names to keep in step, and a title she edited by one
word is left exactly as it is — which the twelve it skipped are the proof of.

It strips the two keys from the **baseline** as well, and that is not tidying: the
untouched panel from
[849](849-a-magazine-published-the-platforms-marketing-under-its-own-name.md)
reports a page by comparing base to live, so clearing the row alone would make
every repaired page look edited and the panel would go quiet about content that
really is still the design's.

Re-measured after: **0** pages still carry a design's title. Re-run: **0 of 41**,
and the 41 it now scans all report as written by their owners.

## Proved

**7 tests**, and **proved red**: putting the two lines back into
`installedPageColumns` reddens exactly 3 of the 7 and leaves the 4 that hold the
rest of the allow-list. [[feedback_a_test_that_cannot_go_red]]

The one that matters is the property: whatever shape a bundle hands over — a
title, a null, an empty string, a record template, a page with no SEO at all —
the columns an install writes contain neither of the two an owner cannot see.

**Checks:** typecheck 0 on `builder`, `api-rest` and `db`. Tests: builder 14 files
/ 154, api-rest 33 / 269. Guards: `em-dashes`, `american-spelling`,
`piggles-plain-words`, `console-parity`, `boundaries`, `routes`, `events`. ESLint
and prettier clean.

## Files

- `wizeworks/packages/builder/src/services/site-service.ts` (`installedPageColumns`, both install seams)
- `wizeworks/packages/builder/src/services/installed-page-columns.test.ts` (new)
- `wizeworks/services/api-rest/src/lib/blueprint-updater.ts` (the update seam and its create path)
- `wizeworks/packages/db/scripts/backfill-design-page-titles.ts` (new, **run**)
- `wizeworks/packages/db/package.json`

## The thing to remember

**The fix was written down a month earlier and applied to one column.** 210 states
the rule in a sentence and proves it across nine tenants; the demo name went on
being written into two more columns by two more lines, because nobody asked where
else a business's name is stored. A rule worth writing down is worth grepping for.

And what made it survive so long: **a page title has no reader inside the
product.** Every other piece of a design's example content is on the page, where
an owner sees it the first time she looks. This one is only ever read by a browser
tab, a search engine and a person pasting a link.
