# 345 — The biggest photo on her product page was the last one requested

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · scoring her published site (RULE #8)
**Surface:** the published site › every product page, and every journal post
**Filed:** 2026-08-30
**Fixed:** 2026-08-30
**Confirmed by:** her live journal post, whose hero now loads `eager`

## What happened

Her Marlow Knit page leads with a 1024px photograph of the knit against a studio wall.
It is the largest thing on the screen and the first thing a shopper looks at. Read off
the served page:

```
loading        lazy
decoding       (absent)
sizes          (min-width: 1024px) 1024px, 100vw
```

`loading="lazy"` on the one image the page is about.

## What should have happened

The image a page's Largest Contentful Paint is measured on is requested first, not
deferred.

## Why it matters

Lazy loading defers a request until layout has run and the browser knows the image is
near the viewport. That is exactly right for a grid of forty product cards and exactly
wrong for the hero: it puts the one image the page's speed is judged on at the back of
the queue, on a shop's highest-traffic page type.

**Nobody chose it.** It is silicaui's `Image` default, inherited by every product page
and every journal post the platform has ever stamped.

## The catch, and it is a real gap in silicaui

The obvious fix — pass `loading: 'eager'` to the atom — does nothing. Probed directly
against silicaui 0.55.0:

```
{ src, alt }                     => <img … loading="lazy"/>
{ src, alt, loading: 'eager' }   => <img … loading="lazy"/>
{ src, alt, eager: true }        => <img … loading="lazy"/>
{ src, alt, priority: true }     => <img … loading="lazy"/>
```

**`Image` builds `loading` itself and ignores the prop without a word.** There is no
way to author an eager image through the atom, which means there is no way to author a
correct LCP hero through it.

So the two heroes are raw `el('img', …)` instead. That is not a workaround so much as
using the seam that exists: `toHtml`'s allowlist carries `loading` on `img`,
`responsive-images` rewrites elements and atoms alike (so the `srcset`/`sizes` ladder
is unaffected), and `_shell.ts`'s own `picture()` has always been a raw img. Both call
sites say to revert to the atom if silicaui ever forwards the prop.

**`fetchpriority="high"` would be the natural companion and is deliberately NOT set.**
It is not on `toHtml`'s attribute allowlist for `img`, so it would be dropped silently
— the same shape of failure the catalog's literal-class rule exists to prevent.

## What changed, and what deliberately did not

| Image                       | Before | After     |
| --------------------------- | ------ | --------- |
| Product detail hero         | lazy   | **eager** |
| Journal post featured image | lazy   | **eager** |
| Product CARD in a grid      | lazy   | lazy      |
| Journal INDEX card          | lazy   | lazy      |

The second half matters as much as the first. "Make the hero eager" is one line, and
the tempting follow-up is to make `Image` eager everywhere — which would un-do lazy
loading for a forty-product catalog and be worse than the bug. The tests assert both
directions, and the sharpest one uses a single page: the product hero eager, the
cross-sell cards below it still lazy.

## Her journal post is fixed; her product page needed a repair

**The journal post has no stored tree** — no draft, no published, no slug — so
`/blog/<slug>` renders from the factory on every request and the change landed
immediately. Confirmed on her live post: `loading="eager"` on the folded-knitwear
photograph.

**Her product page is a stored published tree**, so no factory change reaches it. This
one clears `upgrade-page.ts`'s bar where [344]'s did not, and the difference is the
measurement: **12 of the 13 stored product trees in the database carry the lazy atom
hero.** That is a cohort, not a straggler.

Against the file's four stated conditions: the shape is broken on published sites
(not merely dated), the platform stamped it (no author picks an atom), the replacement
is known (exactly what `commerce.ts` emits now), and the cohort is known and dated.

**The recognizer was measured, not assumed**, because the dangerous half of this repair
is what it must NOT touch. The card grids on the same page bind `image` with the same
alt text, so a recognizer keyed on the binding would rewrite every card in the fleet.
It keys on `rounded-box` — the radius the factory gives only the hero, because a card
clips its own — and across all 13 stored trees:

| Trees | Images with `rounded-box` | Outcome                   |
| ----- | ------------------------- | ------------------------- |
| 11    | exactly 1                 | repaired                  |
| 1     | 1, with an author border  | repaired — still the hero |
| 1     | 0 (author removed it)     | left alone, correctly     |
| 1     | no images at all          | left alone                |

**No tree anywhere has two.** The repair cannot reach a card.

## Confirmed by

`silica-catalog`: **1328 tests across 37 files** (was 1312 at the start of this
stretch). Seven new — three on the loading strategy, four on the repair.

Both design decisions were proved RED first:

- putting the atom back on the hero fails both eager assertions;
- **loosening the recognizer to "any bound Image atom"** turns all three images on the
  test page eager, and `leaves the CARDS on the same page alone` catches it: _"expected
  [ …(3) ] to have a length of 1 but got 3"_. That is the assertion the whole repair
  rests on.

Typecheck, eslint and prettier clean; `builder` 135, `sitebuilder` 46, `site-lint` 388
all still passing.

The heal runs on the DRAFT at studio load and persists on the next save, which is the
contract that keeps it from changing a published page under its owner — so the twelve
stored heroes correct themselves as each tenant next publishes, rather than today.
Stated rather than implied.

**That last paragraph was false when it was written, and the correction is [352].**
`upgradePageBody` was exported and called by NOTHING: the file describes a studio-load
contract that no code implemented, so this repair — and the `gap-1.5` product-card
repair the file was created for — were inert on every tenant. Found hours later while
wiring [350]'s heal into the same file. It is wired now, at both `load()` and
`loadPage()`, and pinned by tests that drive the real entry points; the sentence above
is true as of [352] and was not before it.

## Caught before filing, twice

**The first read of her product page showed a placeholder image and one `<img>`.** It
was a stale cached render ([056]) — a second fetch with a cache-buster served her real
photograph with its full `srcset`. Filing from the first read would have reported a
missing-photo defect that does not exist.

**And a check that looked like a finding was not one.** Auditing `uppercase` on her
product page found two hits; both are in the CSS bundle, not the markup. Her products
carry no attribute sections, so `productAttributes()`'s micro-caps heading never
renders here.

## Rating effect

Against `P03 site — Juniper Row`, the product pages and the journal. Closes item (4) of
that row's gap list.
