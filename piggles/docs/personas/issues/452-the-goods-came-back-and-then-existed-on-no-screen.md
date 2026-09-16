# 452 — The goods came back, and then existed on no screen

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 110
**Surface:** Selling › Returns › a return
**Filed:** 2026-09-08
**Fixed:** 2026-09-08

## What happened

I settled a swap the way a busy shop would: the part arrived, I marked it
received, I sent the replacement. I never opened "Record what came back",
because nothing asked me to and the customer was waiting.

Then I checked the stock and only ONE thing had moved:

```
sku            delta  reason  balance_after  note
INJ-67C-REMAN     -1   sale             17   Replacement sent for return f5cc…
```

The replacement went out. **The faulty injector that came back never went
anywhere.** It is on a shelf, it is worth $329, and it is on no screen in the
product.

## Why it disappeared

Three true things that are fine alone:

1. A return can be settled from **Back with you**, without ever being checked.
   That is deliberate — a shop refunding a trusted customer should not be forced
   through an inspection form first.
2. Restocking is driven by inspection rows. No inspection, nothing to restock.
3. The returns bench — "What happens to the goods" — is built by joining
   `commerce_return_inspections`. Its own comment says the screen exists for
   _"what have I not decided about yet"_.

Together they make the one case the bench cannot show: goods nobody recorded.
No inspection, so no bench row, so it never appears on the list of things to
decide about. And once the return is settled, the console stops offering
"Record what came back" at all, so there is no route back.

The return itself reads **Swapped · done**. Everything on screen says this is
finished.

## Why it matters

It is silent, it is permanent, and it is money. A returned part is stock a shop
paid for. This does not appear as an error, a zero, or an empty state — it
appears as a completed return, which is the strongest possible signal that
nothing is outstanding.

**The measurement is honest about its own weakness.** Of four swapped returns on
this database, three have no inspection. All four are mine, from testing, so
that ratio measures me and not a shop. What it does show is that somebody moving
briskly falls into it three times out of four without noticing — I did, and I
was looking at this surface on purpose. The seventeen refunded returns all have
inspections, which is probably why this never surfaced before: the refund flow
is slower and people stop to look in the box.

## The fix

Recording condition is a fact about the **goods**, not about the money. Looking
in the box does not un-refund anybody, so a settled return still accepts it.

- `canRecordInspection` now includes the settled statuses.
- `inspectionAdvancesStatus` makes sure it does **not** walk a finished return
  backwards into "ready to settle", which would offer to pay the customer twice.
- The console keeps a **Say what came back** row on a settled return that has no
  inspection, with copy that says what it is for: _"This return is finished, but
  nothing was written down about the goods themselves. Note their condition so
  they show up on your returns bench."_
- The row disappears once there is a record, so it is a work list and not a
  permanent button.

### And a neighbour it had left behind

`assertReturnWritable` blocked `cancelled` and `refunded`. `exchanged` did not
exist when it was written, and I added the status without adding it here. Every
one of the six per-transition guards already refuses a swapped return, so
**nothing was open** — but the sentence a shop read on one was _"Cannot issue
refund from status exchanged; expected inspected or received"_, which describes a
state machine instead of saying the return is finished.

The three rules now live in `return-status.ts` as pure functions, because the
service that enforces them is a thousand lines of database work that only runs
against a real Postgres, and a rule nobody can test in isolation drifts from the
six places it is spelled out.

### One more false sentence, found on the way

The inspect modal said _"Anything you mark fit to resell is added back into your
stock **when you settle the refund**."_ On a return already settled that is
simply not true, and on a swap there is no refund to settle. The two consoles had
also drifted: piggles had been corrected to _"once you say what happens to it"_
and sparx still carried the old line. Both now carry the correct sentence, and a
settled return gets its own.

### Where the code changed

- `wizeworks/packages/commerce/src/services/return-status.ts` — new
- `wizeworks/packages/commerce/src/services/return-service.ts` —
  `assertReturnWritable({ allowSettled })`, `recordInspection` guards
- `sparx/…/commerce/return-detail.tsx`, `piggles/…/commerce/return-detail-moves.tsx`
  — the `Say what came back` row
- `sparx/…/commerce/return-actions.tsx`, `piggles/…/commerce/return-inspect-modal.tsx`
  — the modal's title and its promise
- Tests: `wizeworks/packages/commerce/src/services/return-status.test.ts` (8)

Dropping `exchanged` from the settled rule reddens three tests; dropping the
settled case from `canRecordInspection` reddens exactly one.

## Confirmed by

act 110, on screen. The settled swap SO-1003 now offers **Say what came back**.
Recording it: the toast said "Condition recorded", the status stayed **Swapped**
rather than reverting, the line gained "Came back as new · fit to resell", and
**What happens to the goods · 1 to decide** appeared with the four choices. The
row is now on a work list instead of on no list.

Measured after: `status = 'exchanged'`, `refunded_amount_cents = 0`,
`inspections = 1`.

## What this is an instance of

`[[feedback_a_screen_over_a_function_nobody_calls]]` turned around: a whole class
of records that no screen queries. The generalisable check is the one that found
it — **after finishing a workflow, ask the database what physically moved, not
whether the screen says done.**

Also `[[feedback_a_fix_leaves_its_neighbour_behind]]`: a new status added to one
guard and not the other, on the same day.

## Rating effect

`Selling › Returns › a return` — recorded in [rating.md](../rating.md).
