# 191 — Six paragraphs came out as one block of text

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 4
**Surface:** Juniper Row's own website — every product page
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

Devi wrote the Ash Overshirt up properly: six paragraphs, blank lines between
them, the piece she is proudest of. On the page it came out as one unbroken
twenty-five line slab of text between the price and the buy button.

The words were all there. The shape she gave them was not.

## Why it matters

Her whole premium is that a person made this and can tell you about it. A wall of
text is the one thing a shopper will not read, and the paragraph breaks are how
she wrote it — the run about the mill, the run about the three colorways, the run
about who sews it. Flattened together they read as boilerplate.

It also quietly punishes the owners who put the most in. Somebody who types one
line is unaffected; somebody who writes carefully gets the worst result.

## Where it lives

[commerce.ts](../../../../wizeworks/packages/silica-catalog/src/commerce.ts) —
`buyBox()` bound the description into a single `<div>`.

A bind writes ONE TEXT NODE, and `white-space: normal` collapses newlines to
spaces. The newlines were in the DOM the whole time:

```
hasNewline: true      // the text node
white-space: normal   // computed
```

So the data was never lost and no amount of looking at the database would have
found this. It is only visible on the page.

## The fix

The record carries `descriptionParagraphs` — the same words, split at blank
lines, single newlines joined (a wrapped line is not a new paragraph) — and the
buy box repeats them as real `<p>` elements.

`description` stays exactly as it was: the cards bind it, and so does every tree
a tenant has already published.

`omitWhenEmpty`, so a product with no description renders nothing rather than the
template's placeholder paragraph — the scaffolding-as-fact mistake of [092].

## Confirmed on screen

The Ash Overshirt's page, reloaded: six paragraphs, spaced, in the order she
typed them, ending "Made by me and by Inés in a rented studio in Denver."

Two tests pin it: one paragraph per block, and nothing at all (not even an empty
`<p>`) for a product with no description.

## Rating effect

None recorded — the tenant's own website has no row in [rating.md](../rating.md).
