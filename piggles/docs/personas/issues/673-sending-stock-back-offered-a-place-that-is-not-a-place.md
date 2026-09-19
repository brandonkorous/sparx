# 673 — Sending stock back offered a place that is not a place

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 240
**Surface:** mypiggles › Stock › Sent back › Send something back
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

One roll of Ashcombe's linen had a water stain along the selvedge, so Devi opened
**Send something back**. The second field, **Leaving from**, already had an
answer in it:

> Leaving from: **Fulfillment Center**

Her stock is at Main Warehouse. Every purchase order she has placed lands there.
Nothing had chosen Fulfillment Center except the alphabet — the form takes the
first active location in the list.

Opening the list made it worse. Three choices:

> Fulfillment Center · **In transit** · Main Warehouse

**"In transit" is not a place.** It is `type = 'virtual'`, the bucket the
platform keeps so stock on a van between two warehouses is not lost. A pallet
cannot leave from it and a courier cannot collect from it.

MEASURED 2026-09-18: **one screen in either console filtered virtual locations
out of a picker** — `transfer-detail.tsx`, which worked it out for itself and
told nobody. Every other picker offered it.

## The comment already said what the code should do

```text
  // The location the console filled in, when there was only one to fill in.
  // Choosing a different one is her work; accepting the only answer there is is
  // not, and a form she never touched must close without a question.
  const defaultWarehouseRef = useRef('');

  useEffect(() => {
    if (warehouseId === '' && activeLocations.length > 0) {   // ← not "> 0"
```

"When there was only one to fill in" is the rule. `> 0` is three. `bin-detail.tsx`
next door has had `=== 1` all along. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What should have happened

A picker that moves, counts or labels stock offers the places stock can be. A
form that cannot know which of three warehouses she means asks her.

## How to reproduce

Before the fix, every time:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. **Stock › Sent back › Send something back**.
3. "Leaving from" is pre-filled with whichever location sorts first, and the list
   contains "In transit".

## Why it matters

**Sending a return out of the wrong warehouse takes the stock off the wrong
shelf.** It is a silent error: the return is created, the movement is booked, the
numbers at both locations are now wrong, and nothing says so until somebody
counts.

The pre-filled wrong answer is what makes it likely. A blank field gets read; a
filled one gets skipped, which is the whole reason the comment says only to fill
in the one-answer case.

## Where it lives

| What                                | Where                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Offered a virtual location          | `piggles\|sparx/apps/workbench/surfaces/inventory/supplier-return-detail.tsx` |
| Pre-filled the alphabetically first | same file, the seeding effect                                                 |
| The only screen that had the rule   | `…/transfer-detail.tsx`                                                       |

## The fix

**One home for the rule.** `physicalLocations(items)` in `inventory/data.ts` —
active, and not virtual — with the reasoning on it, including the half that is
NOT obvious: a picker that merely FILTERS a list should not use it, because "show
me what is on its way" is a fair question. `transfer-detail` now calls it rather
than keeping its own copy, so there is one of it.

Applied to the seven pickers where somebody is standing in the place:

| Surface             | Why                                      |
| ------------------- | ---------------------------------------- |
| Send something back | a pallet leaves from a loading bay       |
| Start a count       | a person walks the aisles with a scanner |
| Counting schedule   | the same aisles, on a timer              |
| A shelf             | is screwed to a wall                     |
| Shelf labels        | get stuck on real shelves                |
| A making run        | consumes components off a shelf there    |
| Moving stock        | the screen that already knew             |

Deliberately NOT applied to the filters — Every change, Batches, Counts, How it
is performing, At risk, How fast you pack, Cost vs plan, Picking walks — where
"In transit" is a real thing to look at.

**The default only fills in the one-answer case**, which is what the comment
always said, and the select gained a blank first option so an unchosen field
reads as unchosen. Without one, a select holding `''` still DRAWS the first
location: the screen said "Fulfillment Center" while the form held nothing and
the button stayed greyed out with nothing to say why.

**And the diesel went.** The item box's placeholder was `PUMP-4471` and the
return-number box's was `RMA-4471`, in a console for shop owners whose own
product placeholder everywhere else is `SATCHEL-1`. The first is now `SATCHEL-1`.
Piggles' hint under the return number also said "Most distributors will not
accept a pallet back without one" — distributors and pallets are wholesale words;
it says suppliers and "anything back" now. (sparx keeps the wholesale wording:
it has wholesale customers.)

## Confirmed by

Drove the whole return end to end:

> **Leaving from** opened on "Choose a location…", and the list held Fulfillment
> Center and Main Warehouse only. Chose Main Warehouse, Ashcombe Mills, reason
> "Arrived damaged", their ref AM-RMA-118, one roll of `LINEN-NAT-200`.
>
> **RTV-000001** — "You are owed $18.00 at what you paid for these units",
> "They have credited Nothing yet", "Waiting: Not sent".
>
> **It has gone back** asked first: _"1 item will come off the shelf at Main
> Warehouse, and $18.00 goes on the list of what this supplier owes you. This
> cannot be undone from here: a mistake is corrected with a count."_ Confirmed.
>
> In the database: `return_to_supplier`, delta **-1**, balance **45**, against
> `SupplierReturn`. Off the right shelf.
>
> Recorded the credit at $18.00. The return closed as **Credited**, settled in
> full.

## Rating effect

Recorded in [rating.md](../rating.md):

- `Stock › Sent back — Design 8 · Ease 8`, first scored this act
- `inventory.supplier-returns.detail — Design 9 · Ease 7`, first scored this act
