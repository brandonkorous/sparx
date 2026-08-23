# 172 — Fourteen of her fifteen codes were not the one she typed

**Status:** open
**Severity:** minor
**Found by:** P03 · Juniper Row · act 3
**Surface:** mypiggles › Sell › Products › one product › Variants — "Give them all the same price"
**Filed:** 2026-08-23
**Fixed:** —
**Confirmed by:** —
**Blocked on:** decision — which stem a generated code should take, and whether existing codes may be renamed

## What happened

Devi typed her own product code when she created The Ash Overshirt:
**`ASH-OVERSHIRT`**. Short, hers, the one that goes on a label.

Then she added Size and Colour, and pressed **Give them all the same price**,
which is a good control and did exactly what it promised. The fifteen codes that
came out were:

```
ASH-OVERSHIRT            ← the one she typed (XS · Clay)
THE-ASH-OVER-XS-SLATE
THE-ASH-OVER-XS-BONE
THE-ASH-OVER-S-CLAY
… eleven more, all THE-ASH-OVER-…
```

Fourteen of the fifteen are built from the product's NAME — including the "The"
she would never put on a label — and truncated to a stem she did not choose. The
fifteenth is the one she typed. One shirt, two naming schemes, and the odd one
out is the only one she wrote.

To say the obvious thing out loud, because "not hers" is easy to misread: all
fifteen belong to Juniper Row and to this product. Nothing crosses a tenant, a
shop or a product boundary. What is wrong is the STEM the software chose, not
whose records these are.

```
 sku                   | tenant_id                            | tenant
 ASH-OVERSHIRT         | 2e78fb6c-a823-4698-bcb9-58a4f17710a0 | Juniper Row
 THE-ASH-OVER-XS-SLATE | 2e78fb6c-a823-4698-bcb9-58a4f17710a0 | Juniper Row
 … thirteen more, same tenant, same product
```

## What should have happened

The generated codes extend the code that is already there: `ASH-OVERSHIRT-XS-CLAY`,
`ASH-OVERSHIRT-S-SLATE`. The product HAS a code, she chose it, and it is the
obvious stem.

## How to reproduce

Every time.

1. **Sell → Products → Add a product**. Name it `The Ash Overshirt`, and set the
   Product code by hand to `ASH-OVERSHIRT` rather than accepting the suggestion.
2. Options tab: add `Size` (XS · S · M · L · XL) and `Colour` (Clay · Slate ·
   Bone). Change how it is sold.
3. Variants tab → **Give them all the same price** → **Create them**.
4. Read the codes on the fourteen new rows.

## Why it matters

Devi prints these. They go on a swing tag, on a packing slip, into the note she
writes when a customer asks for an exchange. Fourteen codes with a stem she did
not choose and one that is different from the other fourteen is the sort of
inconsistency that makes an owner distrust her own records, and she is the most
careful owner in this roster.

It is minor rather than major because every code is unique, correct, and
editable, the dialog DID say "with a code made from its choices", and the job
finished. What it costs is fifteen edits to make her own scheme consistent —
which is the same grind the bulk control had just saved her.

There is a second, quieter half. `THE-ASH-OVER` is a truncation, so two products
whose names share the first characters — "The Linen Shirtdress" and "The Linen
Shirt", say — would generate stems that collide, and the code has to be unique.
Not seen on this run; worth knowing before somebody meets it.

## Where it lives

Not established from the screen. The generation happens server-side when the
variants are created, and the truncation length and the `THE-` prefix both come
from whatever derives a code from a title — the same function that suggests a
code on the Add a product form, which produced `THE-ASH-OVERSHIRT-1` there.

Deliberately not chased into the source: what it does is clear from the output,
and the decision below has to be made before the code matters.

One structural fact that shapes the answer, read from the database rather than
guessed: **a product has no code of its own.** `commerce_products` has a title
and no sku column; the code the Add a product form calls "Product code" is
written onto the FIRST variant, which is why `ASH-OVERSHIRT` is sitting on a row
flagged `is_default`. So "extend the product's code" really means "extend the
default variant's code", and the software has to go and read it rather than
having it to hand — which is a fair part of why it reached for the title instead.

## The fix

Not made. `Blocked on: decision`, and there are two real questions in it.

**Which stem?** Extending the parent's code is the obvious answer for a product
whose code was typed by hand. It is less obvious when the parent's code was
itself auto-suggested — then both schemes come from the same place and it
changes nothing.

**What about the odd one out?** The variant that already exists keeps its code,
by design and correctly ("keeping its price and code" is what the confirm
promises). So even with the stem fixed, XS · Clay stays `ASH-OVERSHIRT` while
its fourteen siblings become `ASH-OVERSHIRT-…`. Making it consistent means
RENAMING a code that may already be printed on something, which is not a thing
to do quietly.

An honest third option: leave the codes alone and let her rename them in bulk —
which the platform does not currently offer, and which is the same missing
selection model as [166].

## Confirmed by

—

## Rating effect

`Sell › Product › Variants` — recorded in [rating.md](../rating.md).
