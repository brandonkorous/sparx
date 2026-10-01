# 907 — "Nothing is outstanding" gave two reasons when it could know which

**Status:** fixed
**Severity:** **minor**
**Found by:** P03 · act 321
**Surface:** `inventory.consignment` (both consoles)
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** walked on screen

## What she read

"Nothing is outstanding. Either you hold no consigned stock, or every sale from
it has already been settled with its owner."

Juniper Row holds no consigned stock: 76 stock rows, all `owned`. The two
reasons need two different next steps, and the screen offered neither.
[[feedback_one_outcome_two_causes]]

## The fix

The screen asks whether any stock is held on consignment (the same list "Whose
stock" reads) and says the reason that is true:

- **None held:** "You hold no stock on consignment. When a supplier leaves
  stock with you and is paid only for what sells, open the item and press
  "Whose stock is this?". What sells from it then adds up here, ready to pay."
- **Held, all paid:** "Every sale from stock you hold on consignment has been
  settled with its owner."
- **Not known yet** (still loading, or the list failed): the old sentence.
