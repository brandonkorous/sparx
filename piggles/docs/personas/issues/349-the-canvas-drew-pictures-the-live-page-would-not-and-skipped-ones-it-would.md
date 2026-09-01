# 349 — The canvas drew pictures the live page would not, and skipped ones it would

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · dropping section blocks onto her About page
**Surface:** mypiggles › My Site › Page (the canvas), and every builder that uses it
**Fixed:** 2026-08-30
**Confirmed by:** nine tests on the rule, extracted so it is tested rather than mirrored

## What happened

Dropping three section blocks onto her About page raised the dev overlay:

> An empty string ("") was passed to the src attribute. This may cause the browser to
> download the whole page again over the network.

## Two rules, both of which the canvas had wrong

### 1. It rendered empty URL attributes

Every section on the shelf ships its placeholder picture as `src: ''` — deliberately,
so a block reads as a real design the moment it is dropped rather than as an empty
frame the author has to imagine past.

The publish path scrubs those before `toHtml` (`dropEmptyUrlAttrs`, pinned by its own
test since the day it was written) precisely because an empty URL is worse than a
missing one. The catalog says why, about the `href` case:

> `href=""` … is an anchor that silently reloads the current page — worse than no link,
> because it looks clickable.

**The canvas never scrubbed.** So it drew `<img src="">`, which makes a browser
re-request the current document — in the studio, the console route — once per
placeholder picture. Three placeholders on her page meant three full fetches of a Next
dev page, and a React console error for each. A "Photo grid" block ships six.

That is very likely a large part of why the editor kept going unresponsive for twenty
to forty seconds while this page was being built.

### 2. It skipped bound attributes on `img`, which is the only tag they matter on

```ts
const tag = node.tag.toLowerCase();
if (VOID_TAGS.has(tag)) return createElement(tag, props);   // img is a void tag
…
const attr = boundAttr(ctx, node);                          // never reached for an img
```

`src` is essentially the only attribute an image binding can fill. Applied after the
void-tag return, it never was — so **a bound product photo drew its placeholder on the
canvas and its real picture on the live page**, on every product card and every product
hero on the shelf, with nothing on screen to say why.

A canvas that renders an attribute the live page will not, and refuses one the live
page will, is lying about the page in both directions.

## The fix

Both rules moved into one pure `attributeProps(attrs, bound)`, called before the
void-tag return:

- the binding OVERWRITES the authored value first, then the empty rule is applied to
  the result — **the same order the publish path runs in** (`resolveTree`, then
  `dropEmptyUrlAttrs`). So a card whose URL resolves to nothing is un-clickable on the
  canvas exactly as it is on the live page, rather than falling back to an authored
  href the visitor will never get;
- only the URL-bearing set (`href src srcset poster cite action formaction`), because
  an empty `alt` means decorative and an empty `value` is a legitimately empty field.

That ordering detail was got wrong first and caught by a test that expected the
authored fallback to survive. It should not: the live page drops it.

## Tested rather than mirrored, which is the other half of this

`bound-attr.test.ts` next door tests **copies** of `boundText` and `boundAttr`, marked
"Mirrors … in render-node.tsx". A copy passing proves nothing about the original, and
the ordering bug above sat directly underneath that file without it noticing.

So the rule was extracted and exported, and the new tests import the real function.

## Confirmed by

`@wizeworks/studio`: **184 tests across 23 files**, nine of them new — five on the
empty-URL rule (including the two things that must NOT be dropped), four on bindings
reaching a void tag. Typecheck clean.

## Rating effect

Against `P03 console — Juniper Row`, the page editor. The second half reaches every
product card in the fleet, not only this tenant.
