# 691 — The screen said "you could make 0" and the button held the parts anyway

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 243
**Surface:** mypiggles — Making things › Runs; and every path that commits stock
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen — refused live, message quoted below
**Blocked on:** —

## What happened

Devi had one antique brass buckle at the Fulfillment Center and fifty-nine good
ones at the Main Warehouse. The one at the Fulfillment Center was on a shelf she
does not sell from: damaged, in quarantine, or waiting to be looked at.

Her recipe screen knew. It said:

> **You could make** 0 · from what is free at Fulfillment Center
> **Runs out first** Brass belt hardware, antique · Order this to make more.

She planned a run at the Fulfillment Center anyway, pressed **Hold the parts**,
and the platform held them. Status went to **Parts held**. The stock ledger went
to minus one.

## The measurement

```
BRASS-BELT-1 @ Fulfillment Center   on_hand 1   allocated 0   unsellable 1
BRASS-BELT-1 @ Main Warehouse       on_hand 59  allocated 0   unsellable 0
```

Platform-wide at the time: **1 of 630 levels** had anything unsellable on it, and
that one unit was hers. This is a latent defect that almost nothing had touched
yet, and the returns disposition workflow exists to create exactly this state.

## Why

`inventory_levels` carries four numbers that decide how much of a thing is free:

| column               | what it means                                          |
| -------------------- | ------------------------------------------------------ |
| `on_hand`            | physically here                                        |
| `allocated`          | already spoken for                                     |
| `safety_buffer`      | a POLICY cushion, deliberately withheld                |
| `unsellable_on_hand` | a PHYSICAL fact: damaged, quarantined, awaiting repair |

`low-stock.ts` has carried the one definition of "free" since it was written, and
its header says so:

> "This arithmetic used to live in five places and disagreed with itself… Every
> read path that decides whether a level is low now routes through here."

It said READ path. The guards were never converted. What was actually shipping:

| where                        | terms | what it decides                        |
| ---------------------------- | ----- | -------------------------------------- |
| `availability.ts`            | 4     | what the shop shows as in stock        |
| `low-stock.ts`               | 4     | the alerts                             |
| `boms.ts`                    | 4     | "you could make 0"                     |
| `provenance.ts`              | 4     | the breakdown pane                     |
| **`reservations.ts:163`**    | **3** | **whether a shopper may take a unit**  |
| **`reservations.ts:532`**    | **3** | **which warehouse to ship from**       |
| **`assembly-orders.ts:897`** | **3** | **whether a build may hold parts**     |
| **`stock-grid.ts:158`**      | **3** | the bulk grid's `available` column     |
| **console `sellable()` ×2**  | **3** | every "can sell" figure in the console |

**Every surface that DISPLAYS availability had four terms. Every guard that
ENFORCES it had three.** That is the dangerous way round: the screen shows the
strict number and the software acts on the loose one.

The assembly guard is the sharpest of them, because it had the column in its hand:

```ts
select: { onHand: true, allocated: true, safetyBuffer: true, unsellableOnHand: true },

const available = Math.max(
  0,
  (level?.onHand ?? 0) - (level?.allocated ?? 0) - (level?.safetyBuffer ?? 0)
);
```

Selected and not subtracted. You do not select a column by accident, so the
intent was there and the arithmetic was one term short.

## The worst of the four

`reservations.ts:163` is the `FOR UPDATE` lock behind a shopper's basket. With
three terms, **a customer could buy a damaged unit.** The `low-stock.ts` header
describes that failure precisely, and had done for months:

> "routing a returned item to the quarantine shelf moves it on a screen and
> leaves it on sale, which makes the whole disposition workflow decorative."

That sentence is about this line. It was written next to the fix and the line it
describes was never touched. [[feedback_a_fix_leaves_its_neighbour_behind]]

## What was changed

- `reservations.ts` — the reservation lock reads `unsellable_on_hand` under the
  same lock and subtracts it; the warehouse picker uses `sellableUnits`.
- `assembly-orders.ts` — the hold guard uses `sellableUnits`, and its refusal now
  says WHERE the rest went (below).
- `stock-grid.ts` — `available` uses `sellableUnits`.
- `provenance.ts` + both consoles — the term is now REPORTED, not just
  subtracted, so the breakdown pane adds up (issue 692).
- `/v1/inventory` sends `unsellableOnHand`; both consoles' `sellable()` subtract
  it. Additive to the response, so no integrator is affected.
- Two stale comments in `public-api.ts` that quoted the definition three terms
  long were refreshed.

## The refusal now says why

"Not enough stock" beside a shelf a person can see a unit on reads as the count
being wrong, and sends them to recount something that is correct.
[[feedback_one_outcome_two_causes]]

> **Could not hold the parts**
> Not enough BRASS-BELT-1 to commit to this run: it needs 1 and 0 are free here.
> There is 1 here, with 1 on a shelf nothing may be used from.

Each clause is added only when that term is actually withholding something.

## The check

`scripts/check-sellable-terms.mjs`, wired into the pre-push guard.

**The rule is about the CHAIN, not the file.** A file-level rule ("must mention
`unsellable` somewhere") reads green over the assembly guard, which mentioned it
two lines above while leaving it out of the arithmetic. A nearby-lines rule does
too. The subtraction chain is the only honest unit.

Deliberately NOT a rule about `on_hand - allocated`: that two-term figure is the
documented public `available` and stops before the buffer on purpose. Subtracting
neither cushion is a different, documented question. Subtracting the soft one and
not the hard one is not a position anybody holds — it is an omission.

**Proved red.** Reinstating each original formula one at a time, restoring after
each:

```
RED   assembly-orders guard              assembly-orders.ts:918
RED   reservations FOR UPDATE guard      reservations.ts:175
RED   reservations warehouse picker      reservations.ts:555
RED   stock grid available column        stock-grid.ts:162
RED   console sellable()                 data.ts:556
restored -> exit 0: 4653 files, every buffer chain also withholds the quarantine shelf
```

[[feedback_a_test_that_cannot_go_red]]

## Confirmed

On screen, in this order:

1. Held one damaged buckle under the old guard. Level went to −1 free.
2. Called the run off. Level back to `on_hand 1, allocated 0, unsellable 1`.
3. Planned ASM-000002 at the same warehouse and pressed **Hold the parts**.
4. Refused, with the message quoted above. The run stayed **On paper**.
