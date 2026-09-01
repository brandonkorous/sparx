# 339 — The post she wrote started 128px right of its own headline

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · scoring her published site (RULE #8)
**Surface:** the published site › a journal post
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** two tests against the emitted HTML, red before green

## What happened

Devi's journal post _Caring for knitwear_ has a headline, a photograph under it, the
piece she wrote, and a link back to the index. Measured on the live page, the first
two and the last one start at the same left edge. The writing does not:

```
back-link / date / headline   left edge  784
featured photograph           left edge  784
the post itself               left edge  912
link back to the index        left edge  784
```

A reader meets one left edge, then the article steps 128px to the right, then the
footer steps back. Nothing else on the page moves.

## What should have happened

One left edge down the page.

## Where it lives

[cms.ts](../../../../wizeworks/packages/silica-catalog/src/cms.ts) — four bands, three
of which agree:

```ts
masthead()      → 'mx-auto w-full max-w-5xl px-6 …'   // 1024
featuredImage() → 'mx-auto w-full max-w-5xl px-6 …'   // 1024
articleBody()   → 'mx-auto w-full max-w-3xl px-6 …'   //  768   ← the odd one
backToIndex()   → 'mx-auto w-full max-w-5xl px-6 …'   // 1024
```

Every band centres its own box with `mx-auto`, so the box's measure IS the left edge:
`(1024 - 768) / 2 = 128`. Exactly the offset measured.

**The reason it was written that way is a good one**, and its comment says so: a line
much past ~75 characters is measurably harder to read, so the prose does want a
narrower measure. The mistake is where the measure was applied. Narrowing the BAND
buys the reading width by moving the page.

**The rest of the file already does it the other way.** In the same masthead, the
headline is `max-w-4xl` and the excerpt `max-w-2xl` — both caps on the ELEMENT, inside
a constant `max-w-5xl` band. `articleBody` was the only function that shrank the band
instead.

## The fix

The band matches its three neighbours; the reading measure moves onto the core:

```ts
el('div', 'mx-auto w-full max-w-5xl px-6 pb-20 @2xl:pb-24', {
  children: [hostCore(HOST_KEYS.cmsArticleBody, 'w-full max-w-3xl')],
});
```

Both properties kept, and now they are independent: the band is the page's left edge,
the cap is the reading width.

## Why this one reaches her live site

Her **Each blog post** page has no stored tree at all — no draft, no published, no
slug — so `/blog/<slug>` falls through to `starterCollectionDto` and renders from this
factory on every request. A catalog change lands on her posts immediately.

That is worth stating because it is the OPPOSITE of the neighbouring case, and the
distinction was got wrong once already this run: the PDP hero's `loading="lazy"` was
recorded as a catalog note precisely because her product page IS a stored published
tree, which no factory change can reach. Same package, same kind of fix, two different
answers — the tree decides, not the file.

For the nine tenants whose blog-post page IS stored, this does not reach them, and it
deliberately does not force its way in. `upgradePageBody` heals stored trees but is
keyed on a stale class TOKEN, and `max-w-3xl` is a perfectly good class used correctly
elsewhere (`sectionNarrow`) — a token-keyed repair would rewrite bands that are right.
The heal table's own stated bar rules it out too: the shape is not broken, it is
misplaced.

## Confirmed by

`cms.test.ts`, two tests, both proved red against the old code first:

- **every band on the post has one left edge** — reads the `max-w-*` off each
  `<section>`'s inner box and expects `['5xl','5xl','5xl','5xl']`.
- **the prose is still capped at a reading measure** — asserts `max-w-3xl` on the
  article-body core, so a later "fix" that just widened the band cannot pass.

**The first version of that helper passed against the broken code.** It walked the node
tree for a `class` property, found none on any band, and returned four identical
`'none'`s — a set of size one, which is what it was asserting. It was rewritten to read
the emitted HTML and the expected value spelled out in full, so an empty result can no
longer read as agreement. [[feedback_structural_checks_go_blind]], caught only because
red was proved before green.

`silica-catalog`: **1306 tests across 36 files**, all passing.

Then on her live post, measured in the page:

|                     | before        | after          |
| ------------------- | ------------- | -------------- |
| masthead band       | 760 / 1024    | 760 / 1024     |
| photograph band     | 760 / 1024    | 760 / 1024     |
| **body band**       | **760 / 768** | **760 / 1024** |
| back-link band      | 760 / 1024    | 760 / 1024     |
| headline left edge  | 784           | 784            |
| **prose left edge** | **912**       | **784**        |
| prose width         | 768           | 768            |

One left edge down the page, and the reading measure unchanged at 768 — which is the
whole point of the fix, and the reason the second test exists.

**The first load showed the wrong photograph**, which turned out to be nothing to do
with this: the page was a stale cached render serving the image she replaced the day
before, while the database, the media file and the API all held the new one. That is
[056], already open. Worth recording here only because it means a storefront check
without a cache-buster can read a pre-fix page and call a fix confirmed.

## Rating effect

Against `P03 site — Juniper Row`, the journal. Recorded in that row's gap column as
platform-level; this closes it.
