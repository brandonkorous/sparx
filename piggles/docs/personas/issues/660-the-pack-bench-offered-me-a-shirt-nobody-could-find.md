# 660 — The pack bench offered me a shirt nobody could find

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 233
**Surface:** Stock — Waiting for stock, Picking walks, the walk, Pack bench
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 233 (a walk assigned, picked, short-picked, and packed)

## What she did

Devi walked her first order end to end: assigned PICK-000001 to Tomas, picked one
line, recorded the other as not on the shelf, and followed the hand-off to the
pack bench.

The floor screens are good. The guided walk names the item, the quantity, the
order it is for and the barcode that should be on it; the short-pick form asks
what happened, how many were actually found, and states the consequence before
anything is recorded:

> The units you could not find go back into stock and are held for this order, so
> nobody else can buy them. The shelf goes on a count so somebody settles what is
> really there.

Every word of that is true — checked against `shortPick`, which confirms what was
found first, restores the missing units with a matching allocation so AVAILABLE
does not move, writes a visible reservation, and raises the count. The walk then
ends with:

> **Walk PICK-000001 is done** — 1 line came up short. Those shelves are on a
> count now. Everything else is on the trolley.

## Then the next screen forgot

The pack bench, one click later, under **Still to pack**:

| item                                   | qty |           |
| :------------------------------------- | --: | :-------- |
| Sunday Trouser · SUNDAY-TROUS-M-INK    |   1 | `Add all` |
| The Everyday Tee · THE-EVERYDAY-M-CLAY |   1 | `Add all` |

The second one is the line nobody could find. `outstanding` is computed purely
from `order_items` minus what is already boxed, so the bench knew what the order
wanted and nothing about what the walk had just discovered. A packer, handed a
trolley with one garment on it, is offered a button that says the other one is in
the box.

The row must STAY — those units are still owed and still held for this order, and
hiding it would hide an obligation. So the bench is told instead:

> The Everyday Tee · THE-EVERYDAY-M-CLAY
> **Nobody could find it while picking. It is still held for this order.**

and its `Add all` turns amber, because a packer who does have it in hand is still
allowed to say so.

`shortWhilePicking` is summed across every walk that has touched the line, since
an order can be picked more than once.

## Three smaller ones on the same walk

### "Another box" when there were none

The pack bench toolbar read **+ Another box** on a bench with **0 boxes**, four
inches from an empty state whose own button said **Start a box**. Two controls
doing one thing, one of them naming a box that does not exist. The label now
follows the count.

### Two buttons that could fail in silence

The empty state's **Start a box** and every **Add all** awaited the mutation
bare. A refusal became an unhandled promise rejection and a button that appeared
not to have registered the click — on the one screen where somebody is standing
up, holding a garment, in a hurry. Both now fail the way everything else on the
bench does: through the box's own message line.

### A person field that did not know the people

**Who is walking it** is a free text box, deliberately: a floor login is often
not a sparx account, and the existing comment explains that refusing an unlinked
name would leave the throughput report with no rows for half a shift. That
reasoning is right and stays.

What it did not do is SUGGEST anybody. The name is what the walk list and the
walk itself show, and it is also what `pick_lifecycle` falls back to when nothing
is signed in — `pickedBy: ctx.userId ?? list.assignedTo` — so on an API-key
path "Priya", "priya" and "Priya R" are three pickers in the throughput report,
each credited with a third of the work. It now offers the active team as a
datalist, one click and spelled the same way every time, and still accepts
anything typed. Empty and harmless on a warehouse-only account with no Team
screens, which is what the module check is for.

(What the report does with the ORDINARY case — a walk worked by somebody signed
in, where `picked_by` is a login id — turned out to be its own defect, in
[661](661-the-report-on-who-is-picking-named-a-uuid.md).)

## And one on the screen before

**Waiting for stock** has never held a row for Juniper Row, and its **Re-check
dates** button was live anyway. Pressed, it said:

> **Nothing changed** — Every commitment already carries the best date available.

True of nothing, and it reads to somebody who has never taken such an order as
though they had some. The pane already knows `everCount === 0` — its empty state
uses it — so the button is now off, with **"Nothing is waiting on stock, so there
are no dates to check"** on it.
[[feedback_never_present_absence_as_measurement]]

## What is good here, and was already good

- The walk's scan box says the keyboard path out loud: **"Point the scanner and
  pull the trigger, or type a code and press Enter."**
- **Come back to it** is not "done": a skipped line is still owed and the walk
  will not finish while any remain.
- A short pick with a partial find is two real picks and a short of the rest,
  never a short of everything.
- The returned units are deliberately left unseated, because the whole point is
  that they were not where the system said.
- Sealing an incomplete box is a decision, and the refusal names what is missing.

## Files

- `piggles|sparx/apps/workbench/surfaces/inventory/{pack-bench,pick-list-detail,backorders}.tsx`
- `piggles|sparx/apps/workbench/surfaces/inventory/picking-data.ts`
- `wizeworks/packages/inventory/src/services/packing.ts`
- `wizeworks/packages/inventory/test/integration/picking.test.ts`
