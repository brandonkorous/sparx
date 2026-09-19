# 603 — The list of product kinds ran off the side of my phone

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 205
**Surface:** mypiggles › Sell › Kinds of product
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 205 (measured on screen, 320px up)

## What happened

I make coats, so **Apparel** is my kind of product. I went to look at what it
records.

On a wide screen it is a good list. Narrow the pane, or open it on a phone, and
the table stops fitting and starts sliding sideways. Measured on the pane the
console actually gives it:

| pane width | columns shown | runs over by |
| ---------: | ------------: | -----------: |
|      320px |             1 |        112px |
|      360px |             1 |         72px |
|      390px |             1 |         42px |

One column. Just the name. And it still would not fit.

## Why it matters

This is the third time the same shape has been filed on this walk
([595](595-nine-people-owe-me-and-the-screen-will-not-say-how-much.md),
[597](597-my-spending-total-was-on-screen-and-none-of-the-amounts-were.md)), and it is
the same cause every time, so it is worth writing the cause down once more
rather than the symptom.

`truncate` is `white-space: nowrap`. In a table that makes the column's minimum
width **the whole sentence**, and a maximum width does not rescue it — it caps
what is drawn, not what is demanded. Here the description carried
`max-w-96 truncate`, so the column demanded 384px plus its padding forever:

```
floor with `truncate`        416px    ← for ONE column
floor with `line-clamp-2`    169px
```

A sentence that wraps asks for the width of its longest word. A sentence that
truncates asks for all of it and then hides most of it. **Truncating to save
space costs space.**

## Where it lives

`workbench/surfaces/commerce/product-types-list.tsx`, in both consoles.

**Fixed:** the description wraps and clamps to two lines. Nothing is lost by it;
more of each sentence is readable than before, because the old single line was
cut off at the same 384px it was demanding.

### The column order was wrong too

With the floor down to 169px there was room to spend, so the ladder was measured
rather than guessed:

| columns shown     | what they cost |
| ----------------- | -------------: |
| Name              |          169px |
| Name + Attributes |          236px |
| Name + Key        |          269px |
| all three         |          377px |

The old ladder let **Key** in first, at `@xl`, and **Attributes** second, at
`@2xl` — so the first thing a widening pane was given was `apparel`, the machine
name for the type, and the last was "5 attributes", which is the thing a person
is actually scanning for. Attributes now comes first (`@sm`) and Key last
(`@lg`).

A technical id is the last thing a narrow pane should spend its width on.

### After

```
320:1  360:1  390:1  440:2  512:2  560:3  620:3  672:3  768:3  1000:3
```

No sideways scroll at any width from 320px up.

## The thing I got wrong, and what caught it

The first version of the fix read `line-clamp-2 block`. Both set `display`, and
`block` wins — so `-webkit-line-clamp: 2` was sitting on the element doing
**nothing**, and the longer descriptions ran to three and four lines with the
class visibly present in the markup.

Nothing would have failed. It typechecks, it lints, the class is right there in
the DOM, and a screenshot of the short rows looks correct. Only counting the
rendered lines caught it:

```js
Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
// 4, with line-clamp-2 on the element
```

The comment above the span now says why no display utility may sit beside it.

## Guard

Measured, not asserted: the table's floor and its column ladder were read off
the live pane at ten widths before and after. A unit test cannot see a
`white-space` cascade.

## Still open

Nothing from this issue. The wider class of it — tables with an unshrinkable
column — is [591](591-the-item-name-got-narrower-as-the-pane-got-wider.md).
