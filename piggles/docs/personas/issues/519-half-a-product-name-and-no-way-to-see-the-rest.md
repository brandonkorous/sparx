# 519 — Half a product name, and no way to see the rest

**Status:** fixed and proven
**Severity:** major
**Found by:** Devi, reading a purchase order she had placed
**Surface:** both workbenches — 991 clipping spans, fixed once in `@wizeworks/app-kit`
**Filed:** 2026-09-15

## What she saw

PO-000002 to Fairfield Trims. The Items table:

```
Item              Qty   Cost each   Line total   Received
Brass belt h…      60      $3.60      $216.00     58 of 60
BRASS-BELT-1
```

**Brass belt h…** — and nothing anywhere reveals the rest. Not a hover, not a
click, not the row. The name of the thing she bought is cut in half, and the
half she is missing is the half that says which one it is.

Measured on the live pane: the name needs **203px** and has **101px**. Exactly
half of it is on screen.

## Why it matters more than one order

It is not one pane, and it is not rare:

- **991** spans clip text across the two consoles
- **352** of those are showing a name a person wrote — a product, a customer, a
  company, a description, a subject line
- **45.6%** of the product titles on this platform (292 of 641) are longer than
  eighteen characters, against a column that shows about fourteen

A clothing label is the worst case for this, because its names differ at the
END. "Linen shirtdress, indigo" and "Linen shirtdress, oat" are the same string
for the first sixteen characters. Clip them both and the table shows one row
twice.

And **none of the 991 carried a `title`**. Not one. So this was never a pane that
forgot; it was a capability the consoles did not have.

## Why it was not fixed at the call sites

352 edits across two trees is a sweep, and a sweep over JSX is the single most
expensive kind of change to get wrong here — a regex meant to delete empty slots
once removed the filter chips from seven lists and the create button from three,
with typecheck, lint and 44 tests green throughout, because deleted JSX has no
callers.

A blanket `title` on every clipping span would also be wrong in a quieter way.
Most of those 991 are showing values that FIT — a status word, a short code, a
date. Giving each one a tooltip that repeats the line already on screen is how a
tooltip stops meaning anything.

So it is fixed **once, as behavior**, in `@wizeworks/app-kit` — the package whose
own header says it is "the framework glue every sparx Next.js app needs" and that
"nothing here has an appearance, a variant, or a token". A native `title` has
none of those.

`ClippedTextReveal` installs one delegated `pointerover` + `focusin` listener on
the document. When the pointer stops over an element, it measures that element
and, only if it is genuinely clipped, puts the whole string in its `title`.
Nothing is measured until somebody hovers, so the cost is one read per hover and
zero otherwise.

Four rules, each a test:

- an author's own `title` is never touched — their sentence says something the
  visible text does not
- a `title` this put there is **taken back off** the moment the element stops
  being clipped, so widening a pane leaves no tooltip repeating a whole line
- one pixel of slack, because sub-pixel layout rounds `scrollWidth` past
  `clientWidth` on lines nobody clipped
- vertical clipping counts too: `line-clamp-2` hides the part below the fold
  exactly as thoroughly as the part past the right edge

## Proven

Seven guards in `clipped-text.test.ts`, all seven proven red across two passes
that broke every rule in turn:

```
expected null to be 'Brass belt hardware, antique'      (measurement inverted)
expected 'Brass belt hardware, antique' to be null      (slack removed)
expected 'Brass belt hardware, antique' to be null      (author's title ignored)
expected '' to be null                                  (empty-text check removed)
expected null to be 'Brass belt hardware'               (whitespace not normalized)
```

And on Devi's live screen, on the pane where she found it:

| step                               | `title`                        | ours |
| ---------------------------------- | ------------------------------ | ---- |
| clipped (203px of name in 101px)   | `Brass belt hardware, antique` | yes  |
| widened until it fits              | _(none)_                       | no   |
| narrowed back                      | `Brass belt hardware, antique` | yes  |
| 42 spans on the page that FIT      | _(none, all 42)_               | no   |
| a span with the author's own title | the author's, untouched        | no   |

## What nearly hid it

The pane is good. The Items table is clear, the quantities reconcile, the
received badge reads "58 of 60" and the banner above says "2 of 60 units still to
come". Everything on that pane is correct. The defect is a thing that is **not
there** — no tooltip — and an absent affordance renders exactly like a surface
that did not need one.
