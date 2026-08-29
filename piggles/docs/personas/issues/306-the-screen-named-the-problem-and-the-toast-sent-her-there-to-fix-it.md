# 306 — The screen named the problem, and the toast sent her there to fix it

**Status:** fixed
**Severity:** major (a version that has lost its place can be seen and never
repaired; the only two products on her shop that needed repairing had no route to
it from any screen)
**Found by:** P03 · Juniper Row · while proving [305]
**Surface:** the console — **Sell › Each product › Variants**
**Filed:** 2026-08-28
**Fixed:** 2026-08-28
**Confirmed by:** The Ash Overshirt, both kinds of placeless version, on screen

## What happened

Changing the choices on a product can leave a version sitting on no combination
at all. The console handles that honestly right up to the last step, and then
stops:

**It tells her it happened.** When re-placing fails, `rebindToast` fires:

> **The choices were changed, but some versions lost their place**
> 5 versions now have no place in the grid. **Open the Variants tab to put them
> right.**

**It shows her which ones.** The Variants tab has a section for them:

> **Versions with no place in the grid**
> These do not match any combination of the current choices, so shoppers cannot
> reach them. This normally means a choice was changed while a version was still
> sitting on it.

**And there it ends.** The section listed each version with the ordinary price
editor on it. There was no control anywhere on that tab, or on any other, that
gives a version a combination. The toast named a place and an action; the place
existed and the action did not.

A second, quieter half of the same gap: a version that was **stopped** and lost
its place landed in a different section at the bottom, **No longer sold**, whose
only offer is **Sell it again**. Pressing it puts an unreachable version on sale —
it moves from the bottom section to the middle one and is no closer to being
sold. Two sections, two offers, one problem, and neither offer solved it.

## Why it matters

This is not hypothetical damage. [305] left two of Devi's products in exactly
this state:

- **The Ash Overshirt** — five Bone versions with no combination. Four stopped,
  one on sale and unreachable, and five empty Bone squares sitting right above
  them in the grid.
- **The Everyday Tee** — five real Clay versions holding 28 garments, stopped and
  placeless, while five brand-new codes with no stock occupied their squares.

Every screen showed her the problem. No screen could fix it. The only remaining
route was somebody with database access.

## Where it lives

**The server refused, and the refusal is the root of it.**
[variant-service.ts](../../../../wizeworks/packages/commerce/src/services/variant-service.ts):

    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId, deletedAt: null },
      …
    });
    if (!variant) throw new CommerceNotFoundError('Variant', input.variantId);

`assignOptionValues` is the one call that puts a variant at a point in the
lattice, and it treated a stopped variant as not existing. So the versions most
likely to have lost their place were the only ones nothing could give one back.

It is also inconsistent with the same file: `restoreRememberedCoordinates` writes
exactly these rows for stopped variants a few hundred lines above, inside
`setOptions`. **Where a version sits and whether it is being sold are two
different facts**, and only one of the two places that touch them agreed.

**The console never offered it either.** `useAssignVariantOptions` existed in
[products-data.ts](../../../../piggles/apps/workbench/surfaces/commerce/products-data.ts)
and had exactly one caller — `useSaveProductLattice`, doing the automatic
re-placing. Nothing exposed it to a person.

## The fix

**The server places stopped versions too.** The `deletedAt: null` filter is gone,
with the reason written where the next person will read it. Nothing else changes:
`validateOptionValueSet` still demands the coordinate span every choice exactly
once, so a corrupt half-coordinate is still impossible.

Checked before relaxing it: the only other caller is the import worker, whose
`resolve.ts` looks variants up with `deletedAt: null` of its own, so it can never
hand this a stopped one.

**The two sections become one, with the cure on the row.** New
[find-a-place.tsx](../../../../piggles/apps/workbench/surfaces/commerce/product-variants/find-a-place.tsx)
replaces both the cure-less "Versions with no place in the grid" and the
bottom "No longer sold" list. Every placeless version, on sale or stopped, gets
one row carrying a combination picker and **Put it here**. The badge says which
of the two it is — _On sale, but hidden_ against _Not sold_ — because the fault
and the resting state are not the same thing and should not read the same.

**What counts as somewhere to put it.** The picker offers every combination with
nothing **on sale** in it, which is deliberately wider than "empty". The Everyday
Tee is the case that forced it: every Clay square is occupied by the wrong
version, and a picker that only offered untouched squares would have offered
nothing at all on the one product that most needed repairing. A square already
holding a stopped version says so in the list.

**When there is nowhere at all**, the section says what to do instead rather than
going silent:

> Every combination already has something on sale in it. Add the choice these
> belong to on the Options tab, or stop selling whatever is sitting in the
> combination you want, and they can go back.

`rebindToast` is unchanged, because it is now telling the truth.

## One more thing the driving found

The picker was defaulting to the WRONG combination as soon as one had been used.
After `THE-ASH-OVER-S-BONE` went into S · Bone, the remaining rows all defaulted
to **S · Bone (has a stopped version)** while L · Bone and XL · Bone sat empty
below it. Labelling an occupied combination honestly is right; **defaulting to it
is not** — one press would have stacked a second stopped version on a square
nobody asked to share, which is a smaller version of the same fault this issue is
about. The fallback now prefers an empty combination and only then the first
free one. Re-driven: with S and M occupied, the remaining two rows default to
**L · Bone**.

## And a second one, which only the repair could have found

Repairing The Everyday Tee is the case the wider rule exists for, and driving it
worked: stopping `THE-EVERYDAY-XL-CLAY-2` freed the XL · Clay square, the
section flipped from the nowhere wording back to offering the cure, and the real
`THE-EVERYDAY-XL-CLAY` went in carrying its £42.00, its code and its 6 garments.

**And that left two stopped versions on one square**, which the grid could not
say. `slotsOf` took the FIRST match, so:

- **Which of two prices, codes and stock counts she was offered was array
  order.** Pressing **Sell it again** could equally have put the 0-stock `-2`
  version back on sale — which is the original defect, reintroduced by its own
  repair.
- **The loser was told something false.** It fell into "Versions with no place in
  the grid", whose sentence reads _"These do not belong to any combination of
  choices"_. It did belong. It had simply lost a tiebreak nobody was told about,
  and following the instruction would only have moved it somewhere else.

`Slot.retired` is now a **list**, and a square holding more than one shows **a
row each**, with the code appended so they can be told apart. There is no
tiebreak left to get wrong, nothing is hidden, and a version sharing a square is
never described as belonging to no combination. This was on the previous "not
checked" list as something that "cannot arise from a clean history" — true, and
irrelevant, because the repair path arrives there in three clicks.

## Confirmed by

The Ash Overshirt, which [305] had left with five placeless Bone versions — one
on sale and unreachable, four stopped — and five empty Bone squares.

**The section now carries the cure**, and reads:

> **Versions with no place in the grid**
> These do not belong to any combination of choices, so nobody can reach them on
> your website. Say where each one belongs and it goes back in the grid keeping
> its price, code and stock.
>
> THE-ASH-OVER-XS-BONE · $128.00 · **On sale, but hidden** · [XS · Bone] · **Put it here**
> THE-ASH-OVER-S-BONE · $128.00 · **Not sold** · [XS · Bone] · **Put it here**

**The on-sale one.** `THE-ASH-OVER-XS-BONE` into XS · Bone:

> **THE-ASH-OVER-XS-BONE is now XS · Bone**
> Shoppers can reach it again.

**The stopped one**, which is the half that could not be done at all before.
`THE-ASH-OVER-M-BONE` into M · Bone, chosen from the dropdown rather than the
default:

> **THE-ASH-OVER-M-BONE is now M · Bone**
> It is back in the grid, ready to sell again whenever you want it.

and the grid row for M · Bone became **`$128.00 · Not sold · [Sell it again]`** —
placed, and still not on sale. That distinction is the whole point: where a
version sits and whether it is being sold stayed two separate facts through the
repair.

**The dropdown offers only what it should.** Opened on the Ash Overshirt it
listed S · Bone, M · Bone, L · Bone, XL · Bone and nothing else — no combination
with something already on sale in it.

In the database afterwards, the three that ran:

    THE-ASH-OVER-XS-BONE  live      option links: 2
    THE-ASH-OVER-S-BONE   stopped   option links: 2   6 on hand
    THE-ASH-OVER-M-BONE   stopped   option links: 2   6 on hand

## A third shape of the same false sentence, which predates all of this

Repairing The Everyday Tee finished the job — the five real Clay versions are on
sale again with their 28 garments — and then the five `-CLAY-2` versions it
displaced appeared under **"Versions with no place in the grid"**. They have
places. `Clay+XS`, `Clay+S`, `Clay+M`, `Clay+L`, `Clay+XL`, in the database.

`placed` had never counted a stopped version that shares a coordinate with a live
one, so **any version anybody has ever replaced** reads as belonging to no
combination. That is not damage from [305]; it is the ordinary result of
retiring one version and selling a new one on the same square, and it was there
before either fix.

Three states, and they are not the same thing:

| The version                             | Is it a problem? | Where it belongs now                   |
| --------------------------------------- | ---------------- | -------------------------------------- |
| No coordinate at all                    | yes              | Versions with no place                 |
| On a coordinate, nothing else on sale   | no               | its own square, with **Sell it again** |
| On a coordinate, something else on sale | no               | **Kept, but not sold**                 |

New [resting-section.tsx](../../../../piggles/apps/workbench/surfaces/commerce/product-variants/resting-section.tsx)
carries the third: _"Each of these sits on a combination you are already selling
something else in, so nothing needs doing. They are kept because past orders refer
to them and their codes stay reserved. To go back to one, stop selling the version
in its combination and it appears there ready to sell again."_ It is listed
rather than hidden **because the codes stay reserved**, and a code held by a row
nobody can see is what makes "that code already exists" unanswerable. It carries
no button: two versions on sale in one combination is the state this tab exists
to prevent, so the sentence names the real route instead.

## At 360px (persona RULE #6)

Both new sections, in dark, at 360px, driven in an iframe. Two things were wrong
and both are fixed:

- **Codes were truncated past the point of identity.** In "Kept, but not sold"
  the five rows read `THE-EVERYDAY-X…`, `THE-EVERYDAY-S…`, `THE-EVERYDAY-…`,
  `THE-EVERYDAY-L…`, `THE-EVERYDAY-X…` — two identical, and one that had lost
  its size. A list whose entire purpose is the reserved code cannot elide the
  code. The row now stacks at narrow widths and never truncates; all five read in
  full. `FindAPlace` had the same `truncate`, where it would have hidden the
  difference between `…-CLAY` and `…-CLAY-2`, and lost it too.
- **The picker's caveat was cut, keeping only the words that introduce it** —
  `XS · Indigo (has a stopped ver…`. A select truncates its own trigger, so the
  label is short now: **`XS · Indigo (1 not sold)`**, which fits.

## Not checked

- **A rename round trip** — "Bone" to "Ivory" and back. The memory matches on
  text, so a rename is meant to fall to the identity path instead; not driven.
- **A three-axis product**, where the combination name is long enough to push the
  picker's "(1 not sold)" out of a 360px trigger by itself.
- **Keyboard only.** The P03 standing check "One job without a mouse" has not
  reached this pane yet, and the picker plus **Put it here** is exactly the shape
  that check exists for.
