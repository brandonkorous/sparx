# 562 — "Everything matched, nothing to correct", over 372 corrected garments

**Status:** fixed and proven
**Severity:** high
**Found by:** checking whether the neighbour console had the fix piggles already made
**Surface:** `sparx/apps/workbench/surfaces/inventory/counts-list.tsx`
**Filed:** 2026-09-16
**Follows:** 175 (the same defect, fixed in piggles only)
**Family:** [[feedback_a_fix_leaves_its_neighbour_behind]] · [[feedback_never_present_absence_as_measurement]] · [[feedback_fetched_but_never_rendered]]

## What it said

The sparx console's stock-count list, on Juniper Row's largest stock event:

> Main Warehouse · CNT-000001
> **62 items · everything matched, nothing to correct** — **$0.00** — Applied

372 garments were counted onto empty shelves by that session. The line says
nothing needed correcting.

That is not awkward wording. It is a **false statement about what happened**, on
the screen an owner opens to see what a count did.

## The cause

```ts
return count.varianceValueCents > 0
  ? `${items} · ${formatCents(count.varianceValueCents)} of corrections applied`
  : `${items} · everything matched, nothing to correct`;
```

`varianceValueCents` is Σ |counted − expected| × unit cost. A cost price is
optional and nothing ever asks for one, so a shop that has never entered one
gets **zero out of that sum however much stock moved**. Branch on the money and
"we checked and it all matched" is indistinguishable from "we corrected 372
garments and cannot price them" — and the code picked the reassuring one.

The Difference column did the same thing:

```ts
const difference = count.status === 'counting' ? '—' : formatCents(count.varianceValueCents);
```

A **discarded** count applied nothing at all, and printed `$0.00`, which claims a
check that never happened.

`varianceUnits` — Σ |counted − expected| in UNITS, the field that tells the two
apart — **was already on the API response** and this console simply never
declared it. [[feedback_fetched_but_never_rendered]], the commonest defect shape
in this codebase.

## Measured

Every stock count in the database. `varianceUnits` counts only lines that have
actually been counted, which is what the service does:

| tenant        | count      | status    | value | **units moved** | sparx said                                         |
| ------------- | ---------- | --------- | ----- | --------------- | -------------------------------------------------- |
| Juniper Row   | CNT-000001 | Applied   | $0.00 | **372**         | **everything matched, nothing to correct** + $0.00 |
| Sable Thyme   | CNT-000001 | Applied   | $0.00 | **2**           | **everything matched, nothing to correct** + $0.00 |
| Juniper Row   | CNT-000004 | Discarded | $0.00 | 0               | discarded + **$0.00**                              |
| Juniper Row   | CNT-000003 | Discarded | $0.00 | 0               | discarded + **$0.00**                              |
| Juniper Row   | CNT-000002 | Discarded | $0.00 | 0               | discarded + **$0.00**                              |
| WizeWorks LLC | CNT-000001 | Counting  | $0.00 | 0               | 0 of 5 counted + — (right)                         |

**Every count in the database sits at `variance_value_cents = 0`**, because no
tenant has ever entered a cost price. Two of them moved units and were told
nothing moved. Three applied nothing and were given a figure. **Five of six rows
wrong on one screen.**

## The fix

Port `counts-list-summary.ts` from piggles, which reads UNITS before money, and
delete the local `summaryLine`. Add `varianceUnits` to `CountRow`. The
Difference column becomes `differenceLabel()`, which gives a dash where nothing
was applied and "No cost yet" where the units moved but nothing can price them.
The unpriced notice comes over too, with a route to the costing screen.

## Proven

A test on the shared module in **both** consoles — piggles had shipped it
untested — **proven red** by putting the money-branch back. 3 of its 11
assertions failed, naming the exact three sentences:

|                                                                 |     |
| --------------------------------------------------------------- | --- |
| "does not say everything matched over a count that moved stock" | red |
| "shows a dash, not $0.00, for a count that was never applied"   | red |
| "says so rather than printing a confident zero"                 | red |

One more disagreement was closed while porting. `anyUnpriced` (the standing
notice) did not check status while `differenceLabel` (the column) did, so a
discarded count could show a dash in its own row under a banner saying it "moved
real stock". The status test now lives in one place, `hasSomethingToReport`.

sparx renders the screen (WizeWorks LLC, CNT-000001, still being counted:
"0 of 5 counted", difference "—", notice correctly absent).

313 sparx tests pass, 401 piggles tests pass, both typecheck.

## Still open

The two rows that carried the false sentence belong to Juniper Row and Sable
Thyme, which the signed-in sparx session cannot see. So the fix is proven by the
measured rows and the guard rather than by a screenshot of the wrong row going
right.
