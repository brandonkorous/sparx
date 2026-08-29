# 305 — She put the colorway back, and the shop sold it under a new code with nothing on the shelf

**Status:** fixed
**Severity:** major (removing a colorway destroys its versions' place in the grid,
so putting it back cannot return them — the shop sells new codes with no stock
while the real garments sit on rows nothing can reach, and every screen reports
success)
**Found by:** P03 · Juniper Row · standing check "Wrong moves" — delete the Clay
colorway with an open order against it
**Surface:** the console — **Sell › Each product › Options** and **Variants**
**Filed:** 2026-08-28
**Fixed:** 2026-08-28
**Confirmed by:** The Linen Shirtdress, the same round trip, on both screens

## What happened

**The wrong move itself is handled well, and that deserves saying first.**
Removing Clay from The Everyday Tee raises a named preview — _"5 versions lose
their place and stop being sold — THE-EVERYDAY-XS-CLAY, THE-EVERYDAY-S-CLAY … and
1 more"_ — then a confirm, then a soft delete. Both open orders against Clay
(O-000009 and O-000011) still render, still fulfil, and the pick list it generated
listed `THE-EVERYDAY-M-CLAY` as **To pick**. Nothing was lost.

**Putting it back is where it goes wrong.** Re-adding Clay, the summary quietly
changes what it promises:

> 5 combinations will have no price, so they cannot be bought until you set them
> on the Variants tab.

Not "5 versions come back". On the Variants tab the five read **XS · Clay — No
price — [Set a price]**, under a banner saying _"5 combinations have no price, so
nobody can buy them"_ and a button, **Give them all the same price**.

"Set a price" pre-fills the product code `THE-EVERYDAY-XS-CLAY` — the retired
version's own code — and refuses it:

> Could not add that version — SKU "THE-EVERYDAY-XS-CLAY" already exists

The bulk button succeeds, and says so: **"5 combinations now have a price."** What
it wrote:

    THE-EVERYDAY-XS-CLAY    retired   5 on hand
    THE-EVERYDAY-S-CLAY     retired   6 on hand
    THE-EVERYDAY-M-CLAY     retired   5 on hand
    THE-EVERYDAY-L-CLAY     retired   6 on hand
    THE-EVERYDAY-XL-CLAY    retired   6 on hand
    THE-EVERYDAY-XS-CLAY-2  on sale   0 on hand
    THE-EVERYDAY-S-CLAY-2   on sale   0 on hand
    THE-EVERYDAY-M-CLAY-2   on sale   0 on hand
    THE-EVERYDAY-L-CLAY-2   on sale   0 on hand
    THE-EVERYDAY-XL-CLAY-2  on sale   0 on hand

Her Clay tees are on sale under codes she has never seen, with **nothing on the
shelf**, while the twenty-eight garments she has are attached to five rows she was
steered away from.

## The promise that could not be kept

The delete's confirm says: _"Past orders keep their record, and **you can bring
them back**."_ The Variants tab even has the door — a **No longer sold** section
listing each retired version at its price with a **Sell it again** button, below
the fold, while the alarm and the bulk action sit above it on the broken path.

**But that door did not work either, and finding out why is the actual defect.**
Pressing **Sell it again** on `THE-ASH-OVER-XS-BONE` put it back on sale — into a
section headed **"Versions with no place in the grid"**:

> These do not match any combination of the current choices, so shoppers cannot
> reach them.

So the version came back and still could not be sold, while the empty XS · Bone
slot above it went on offering to create a duplicate.

## Where it lives

Not in the grid. In `setOptions`.

[variant-service.ts](../../../../wizeworks/packages/commerce/src/services/variant-service.ts)
replaces the whole lattice on every save:

    await tx.productOption.deleteMany({ where: { productId } });

Every option and value is deleted and recreated with **new ids**, and the
`ProductVariantOptionValue` rows recording each variant's position cascade away
with them. Live variants survive because the console re-places them immediately
afterwards, by id — `useSaveProductLattice`'s three steps are replace, re-place,
retire. **A variant being RETIRED is never re-placed**, and there is no new id to
re-place it onto.

Measured on Devi's data, after removing Bone:

    THE-ASH-OVER-XS-BONE   retired   option links: 0   title: (none)   metadata: {}
    THE-ASH-OVER-L-CLAY    live      option links: 2

Nothing survives — no coordinate, no title, no metadata. The only trace of what
`THE-ASH-OVER-XS-BONE` **was** is the SKU string, which is a code the merchant can
change at will and is not identity.

The `-2` suffix follows from that. `suggestSlotSku` appends one when a code is
taken, and `fillTheRest` builds its taken-set from **all** versions including
retired ones — deliberate, and right on its own terms, because a retired code
stays reserved. But the only thing making that code taken was **the same
garment**, one square away in the same grid, invisible because its coordinate no
longer existed.

## The fix

**The coordinate is written down before the cascade takes it, and read back when
the lattice can hold it again.** New
[lattice-memory.ts](../../../../wizeworks/packages/commerce/src/services/lattice-memory.ts)
in `@wizeworks/commerce`, called from inside `setOptions`'s transaction:
`rememberCoordinates` stores each variant's position as **text** on `metadata`
(the platform's own scratch space — `customFields` is the tenant's) before the
delete; `restoreRememberedCoordinates` puts back every variant, retired ones
included, whose remembered coordinate the new lattice can hold.

Text rather than ids, because ids are exactly what does not survive. A **renamed**
value deliberately does not match — the caller re-places live variants by identity
straight afterwards and identity is what survives a rename, which the existing
comment in `consequenceOf` is right to insist on. This is only for what identity
cannot reach: a value that went away and came back.

Three consequences on the console, all of which were saying something false:

- **A combination holding a retired version is not empty.** `Slot` gains
  `retired`; the row becomes **Sell it again** at the price it had, in the grid
  where she is looking. `empty` counts only coordinates that have never held a
  version, so the alarm stops firing and `fillTheRest` is never handed one.
- **The summary counts what is coming back.** `Consequence` gains `returning`,
  and the Options tab now loads retired versions — it was reading live ones only,
  which is why it called their combinations blank.
- **The retired list at the bottom shows only versions with no square to sit
  in**, so one version cannot appear twice with two different buttons on it.

## Confirmed by

The Linen Shirtdress (Chalk · Indigo), removed and put straight back.

**Removing** now says how to undo it: _"5 versions lose their place and stop being
sold … Orders already placed keep their record, and you can bring them back **by
adding that choice again**."_

**Re-adding Chalk**, the summary reads:

> 10 combinations can be sold in all.
> 5 versions keep their price and code.
> **5 versions you stopped selling come back with their price, code and stock —
> LINEN-SHIRTDRESS, LINEN-SHIRTD-S-CHALK, LINEN-SHIRTD-M-CHALK,
> LINEN-SHIRTD-L-CHALK and 1 more. Put them on sale again from the Variants tab.**

No "will have no price" line at all. And the grid, after committing:

    XS · Chalk   $145.00   Not sold   [Sell it again]
    S · Chalk    $145.00   Not sold   [Sell it again]
    M · Chalk    $145.00   Not sold   [Sell it again]
    L · Chalk    $145.00   Not sold   [Sell it again]

Each at the price it had, in its own square, with no "No price" badge, no alarm
banner and no bulk button. The server had written the coordinates back:

    LINEN-SHIRTD-M-CHALK  {"latticeCoordinate": [{"value":"M","option":"Size"},{"value":"Chalk","option":"Color"}]}

**Not proved on screen: pressing Sell it again on one of them.** The dev stack
went down mid-step — the restore returned 503, and its OPTIONS preflight did too,
so api-rest was already gone. That is the one remaining beat and it is recorded as
open rather than assumed (CLAUDE.md RULE #4).

## Left behind on Devi's shop

Damage done before the fix existed, which the fix cannot undo — there is nothing
recorded to recover from:

- **The Everyday Tee** carries five `THE-EVERYDAY-*-CLAY-2` versions on sale with
  no stock, and five real Clay versions retired holding 28 garments.
- **The Ash Overshirt** has five Bone versions with no coordinate — four retired,
  one live and stranded — and five empty Bone slots.

Neither was repairable from the console, and **that was a second gap** — the
"Versions with no place in the grid" section stated the problem and offered no
cure, while `rebindToast` told her _"Open the Variants tab to put them right."_
Filed and fixed as [306]; both products now have a route back through the UI,
which still has to be driven.

## Not checked

- **Removing a whole CHOICE** (Remove Size) rather than one of its values. Same
  code path by inspection, not driven.
- **A rename round trip** — "Bone" to "Ivory" and back. The memory matches on
  text, so a rename is meant to fall to the identity path instead; not driven.
- **Two retired versions on one coordinate**, which The Everyday Tee now has.
  `slotsOf` takes the first match, so which one the grid offers is array order.
  It cannot arise from a clean history — it arises from this bug.
