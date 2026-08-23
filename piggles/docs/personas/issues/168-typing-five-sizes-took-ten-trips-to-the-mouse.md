# 168 — Typing five sizes took ten trips to the mouse

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 2
**Surface:** mypiggles › Sell › Products › one product › Options
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** XS S M L XL and Clay Slate Bone typed straight through — below

## What happened

Devi's whole catalogue is size × color, so the first thing she does on a product
is type five sizes. She typed **XS**, and then did what anybody typing a list
does: pressed **Enter**.

Nothing happened. The field read **XSS** — the `S` she meant for the next row had
gone into the one she was in.

So she used the button. **Add a size** made a row and left the cursor on the
button, so her `S` went nowhere at all and the new row sat empty. The working
sequence turned out to be:

> click Add a size · move to the new field · click it · type · move back to the
> button · click Add a size · move to the new field · click it · type · …

Five sizes is ten deliberate mouse moves. Three colorways after them is six
more. Her catalogue is five products of this shape.

There was a third bite. Pressing **Add a choice** answered immediately with a red
**"Give this choice a name, like Size or Color."** before she had typed a
character.

## What should have happened

Enter adds the next one and puts the cursor in it, which is what Enter does in
every list anybody has ever typed. The button focuses what it just made. And a
card nobody has touched yet is not wrong, so it is not marked red.

## How to reproduce

Every time.

1. Console → **Sell** → **Products** → any product → **Options** → **Add a
   choice**. Note the red message under a field nobody has typed in.
2. Name it `Size`. Type `XS` in the first row. Press **Enter** — the row becomes
   `XSS`.
3. Press **Add a size** and type without clicking — nothing lands.

## Why it matters

This is the exact complaint Devi arrived with. She is leaving a marketplace over
per-item grind, and the persona file says outright she "will notice if a variant
grid makes her enter 22 prices by hand". Sixteen mouse moves to declare how one
overshirt is sold is that same feeling, on the first product she ever enters.

Recorded as minor rather than major because the job CAN be finished and nothing
is lost or wrong — but it is the friction most likely to lose this owner, and it
was three lines of code.

## Where it lives

[product-options.tsx](../../../apps/workbench/surfaces/commerce/product-options.tsx),
which was 997 lines and is now six files, none over 250 (piggles RULE #0.5).

The option editor never bound Enter, and the add button appended a row without
saying where the cursor should go. The premature error came from `problemWith`,
which reported a blank card as a problem even though `cleanDraft` — two functions
away, with a comment saying "a half-typed option is not a decision yet" —
discards exactly that card.

## The fix

Three changes, in the split-out files:

- **`product-options-value-row.tsx`** — Enter adds the next value. Nothing here
  is inside a `<form>`, so Enter had no other meaning to take away.
- **`product-options-card.tsx`** — the card remembers which row it just created
  and moves the cursor there, whether the row came from Enter or the button. A
  row added by Enter lands directly after the one you were in rather than at the
  bottom, so inserting a forgotten size works too. The button also now says what
  it can do: _"Or press Enter in any of them to add the next one."_
- **`product-options-draft.ts`** — `problemWith` skips a card with nothing typed
  in it at all, matching what `cleanDraft` already did.

Focus is moved with a ref in an effect rather than `autoFocus`, which fires on
mount whatever caused it — this only ever follows a deliberate act.

The split: `product-options.tsx` (the tab), `-draft.ts` (what is typed and what
is wrong with it), `-plan.ts` (what committing would do, in sentences),
`-card.tsx` (one axis), `-value-row.tsx` (one value), `-consequence.tsx` (the
summary and its commit button). Six `color="neutral"` icon buttons went colorless
on the way past (root RULE #4).

## Confirmed by

**Re-ran act 2 as Devi, on The Ash Overshirt's Options tab.**

Pressed **Add a choice** — no red message this time; the card opened quiet.
Typed `Size`, clicked the first row, and then typed
`XS ⏎ S ⏎ M ⏎ L ⏎ XL` without touching the mouse again. All five rows, in
order, first try. **Add another choice**, `Colour`, switched it to **Color dots**,
and `Clay ⏎ Slate ⏎ Bone` the same way. The button label followed the name
throughout — "Add a size", then "Add a colour".

The summary read **15 combinations can be sold in all**, and after committing,
the database agrees:

```
 name   | display_type | value | swatch_hex | position
 Size   | dropdown     | XS/S/M/L/XL |      | 0–4
 Colour | swatch       | Clay  | #b08268    | 0
 Colour | swatch       | Slate | #5a6470    | 1
 Colour | swatch       | Bone  | #e8e1d5    | 2
```

**One thing to note honestly:** the pane crashed once during this session, to the
root "Something went wrong" boundary, while a colour was being picked. It was not
reproducible — the same sequence ran clean twice afterwards — and the crash
coincided with a Fast Refresh recompile of the very file being edited, which is a
dev-server artifact rather than a product defect. Recorded rather than filed,
because saying nothing about a crash you saw is worse than saying you could not
make it happen again. The recovery itself was good: **Try again** restored the
whole workspace, its panes and the open product, and the message said plainly
that unsaved typing would not come back.

## Rating effect

`Sell › Product › Options` — recorded in [rating.md](../rating.md).
