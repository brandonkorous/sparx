# 616 — My supplier card counted two deliveries and then said there were none

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Partners › Suppliers › Ashcombe Mills › How they have
performed
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (both branches seen on screen)

## What happened

Ashcombe Mills, all of it on one card:

> **How they have performed** · A · 99
> Over the last 365 days, from your own orders and deliveries.
>
> Based on all four measures, across **2 deliveries** and 1 order worth $720.00.
>
> | On time         | In full           | Price vs agreed         | Damaged on arrival |
> | :-------------- | :---------------- | :---------------------- | :----------------- |
> | 100%            | 100%              | 0.0%                    | 5%                 |
> | **0 of 2 late** | 0 short of 1 line | exactly what was agreed | 2 of 42 units      |
>
> **No delivery from them has been measured yet**, so planning still uses
> whatever delivery time was typed in on their record.

Two deliveries. None of them late. And then no delivery has been measured.

I cannot tell from that whether the A is real. If nothing has been measured, what
are the four green numbers? If something has, why does it say nothing has?

## Why it happened

Both halves are true about **different things**, and the sentence used one word
for both.

The four measures come from the scorecard's own pass over receipts. The delivery
**time** comes from `inventory_supplier_lead_times`, a different table filled by
a different job. `supplier-scorecard.ts` only copies it, and says so:

> It does not measure lead time. `inventory_supplier_lead_times` (Phase 7.3)
> owns that, and the sweep COPIES it. Two independent measurements of one thing
> is how a scorecard starts disagreeing with the screen it links to.

Measured:

```sql
-- the scorecard row
deliveries        2      on_time_sample  2      late_deliveries 0
lead_time_sample  0      lead_time_mean_days  (null)

-- the table it copies from
select count(*) from inventory_supplier_lead_times
 where tenant_id = '…juniper row…';                         -- 0
```

And both of her purchase orders carry an `ordered_at` **and** a receipt against
it. So the number was sitting there computable. Nobody had run the pass.

## The fix

### 1. Name what is missing, which is the time and not the delivery

> How long they actually take has never been worked out, though 2 deliveries
> from them have arrived. Until it is, planning uses the 21 days typed in on
> their record.

It no longer denies the deliveries the card above it just counted, and it names
the number planning is actually running on.

### 2. Tell the two causes apart, and offer the button to only one

One sentence covered both, and offered a way out of neither:

| cause                                   | now says                                                                                          | button                  |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------ | :---------------------- |
| deliveries arrived, nobody ran the pass | How long they actually take has never been worked out, though N deliveries from them have arrived | Work out delivery times |
| nothing has ever arrived from them      | Nothing has arrived from them yet, so how long they take cannot be worked out                     | none                    |

A pass over zero deliveries produces zero deliveries, so the second case gets no
button rather than one that cannot help ([[feedback_one_outcome_two_causes]]).

The button is **not** the card's own "Measure now". That recomputes scorecards,
which copy the lead time. The pass that works it out is the planning sweep,
`POST /v1/inventory/planning/recompute`.

### 3. Do not promise a typed-in time when nothing was typed in

`resolveLeadTimeOnTx` resolves in this order: a measured figure **with enough
samples**, else the supplier's stated days, else the stock level's own, else a
flat default. With nothing on the record, "planning still uses whatever delivery
time was typed in on their record" described a step that does not happen
([[feedback_a_promise_in_copy_is_a_contract]]). That case now says "a general
figure, because no delivery time is typed in on their record either", which
stays true whichever of the last two steps wins.

### 4. Say how much to trust a measured figure

The module next door already states the rule:

> A forecast built on nine days of sales and one delivery is arithmetically the
> same shape as one built on three years and forty deliveries.

This panel did not follow it. Below three samples the join in
`resolveLeadTimeOnTx` misses and the **stated** days win, so a confident
variance was decorating a figure nothing reads. Seen on screen after pressing
the button, with a one-delivery sample:

> Deliveries take 0.03 days on average, measured across 1 delivery, they say 21,
> so they run faster than stated by 20.97 days. **That is too few deliveries to
> plan on, so planning still uses the 21 days typed in on their record.**

Without that last sentence, "faster than stated by 20.97 days" off one delivery
reads as a fact worth acting on.

### 5. The card needs the number the record holds

`SupplierScorecardPanel` took only a `supplierId`, so it could not say what
planning falls back to. It now takes `statedLeadTimeDays`, from the record the
parent already has loaded. The comment directly above the mount point had
already said why this matters:

> directly under the terms somebody typed in when the record was set up —
> because the point of the panel is the gap between the two.

The point of the panel was the gap between the two and the panel held one of
them.

### 6. The sweep refreshes the screens it changes

Pressing the button worked and **the screen did not move**. The planning sweep
runs `recomputeSupplierScorecards` as one of its stages, and
`useRecomputePlanning` invalidated planning, reorder and stock, but never the
scorecards. So the card kept saying how long they take had never been worked
out, straight after somebody worked it out.

Fixed in the hook rather than at my call site, because it hits every caller: the
Planning screen's own "Work it out now" recomputes every supplier scorecard and
leaves the scorecards screen stale too.

## Guard

New `supplier-lead-time-words.ts` + `.test.ts`, **17 tests** in each console.

The panel renders, so this sentence had nowhere to be tested from. The words are
now a leaf module the node seat can reach.

Proven red by putting the old one-branch sentence back: **14 of 17** fail.

## Not changed

Nothing. All four of the measures above the sentence were correct.

## Still open

`MIN_RELIABLE_SAMPLES` is **duplicated** in the console, because no endpoint
exposes it and the console does not import the server's inventory package. The
constant is commented in both files and a test asserts its value, so a change is
at least visible, but the real fix is for the scorecard payload to carry whether
the measured figure is the one planning is using. That is a server change.
