# 555 — Two screens that both say what your stock is worth, $870.00 apart

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, reading two stock screens in the same sitting
**Surface:** `wizeworks/packages/inventory/src/services/gl-reconciliation.ts`
**Filed:** 2026-09-16
**Follows:** [553](553-every-unit-has-a-cost-behind-it-over-393-that-do-not.md)
**Family:** [[feedback_a_fix_leaves_its_neighbour_behind]] · [[feedback_verify_capability_in_code_not_docs]]

## What she saw

Two panes open at once, same shop, same day, both about what her stock is worth:

| screen                              | says          |
| ----------------------------------- | ------------- |
| Stock → **Cost to keep**            | **$1,837.92** |
| Stock → **Stock versus your books** | **$967.92**   |

Neither mentions the other. The second one is the screen whose entire job is to
name the reasons two figures differ, and the difference it did not name was its
own.

## Measured

$870.00 exactly, and it is three stock lines:

| SKU                    | on hand | priced by          | cost layer |
| ---------------------- | ------- | ------------------ | ---------- |
| BRASS-BELT-1           | 58      | level avg $3.84    | receipt    |
| LINEN-NAT-200          | 40      | level avg $18.63   | receipt    |
| LEATHER-BELT           | 6       | **product $29.00** | **zero**   |
| LINEN-SHIRTD-S-INDIGO  | 6       | **product $58.00** | **zero**   |
| LINEN-SHIRTD-XS-INDIGO | 6       | **product $58.00** | **zero**   |

The top two were bought through a purchase order, so a cost layer carries their
price and both screens see them: $222.72 + $745.20 = **$967.92**.

The bottom three she **counted onto the shelf and priced herself**. 6 × $29 +
6 × $58 + 6 × $58 = **$870.00**. Every ordinary stock screen honors that price.
The reconciliation, which walks the purchase ledger and nothing else, cannot.

## The cause

`glReconciliationReport` starts from `valuationAsOf`, which values a unit only
from what was PURCHASED. The report's own type said otherwise:

```ts
/** What sparx says the stock is worth at `asOf` — the same figure the
 *  valuation screen shows, deliberately, so the reconciliation reconciles the
 *  number the business actually reads. */
sparxValueCents: number;
```

It is not the same figure, and had not been for any shop that stocked its
shelves by counting. A comment asserting a behavior is not the behavior
([[feedback_verify_capability_in_code_not_docs]], now wrong seven times).

The consequence is not cosmetic. The moment she types her trial balance in, the
$870 lands in **Unexplained** — the one line on the screen that means "this is
the part worth investigating" — with no line above it to account for it. The
screen would send her looking for an error that is not there.

## The fix

One more reconciling line, which is what this screen is for:

> **Priced by you, not bought through us** · 3 lines · **$870.00**
>
> _Stock you counted onto the shelf and put a cost price against yourself. Your
> other stock screens include it, and the figure above is built only from what
> you bought through us, so this is the difference between them (measured today,
> not at the date above: a cost price has no history)._

Counted in `explainedCents`, so `sparxValueCents + explainedCents` is now the
figure the rest of the platform shows. That identity is the thing that makes the
reconciliation mean anything, and it is asserted in the guard.

**`valuationAsOf` is left alone on purpose.** Its contract is "value from the
append-only ledgers, and say what they cannot cover", which is what makes it able
to answer for a date last March. Teaching it to fall back on a cost price would
have put today's price behind a year-old figure, quietly. The difference belongs
on the screen that exists to name differences.

**The uncosted line stops double counting.** [553](553-every-unit-has-a-cost-behind-it-over-393-that-do-not.md)
made it report 393 units with no cost behind them. Eighteen of those are the
three lines above, which now have their own line, so the count is
`393 − 18 = 375` — the same 375 the "What your stock cost you" screen has been
saying all along.

## Proven

Her three screens now agree:

|                          |                                        |
| ------------------------ | -------------------------------------- |
| Stock versus your books  | $967.92 + $870.00 = **$1,837.92**      |
| Cost to keep             | **$1,837.92**                          |
| What your stock cost you | **375 units** with no cost recorded    |
| Stock versus your books  | **375 units** with no cost behind them |

1 guard in `reporting.test.ts`, asserting the delta rather than the total
(every test in that file shares one tenant, so an absolute figure measures
whatever ran before it). Proven red by zeroing the line: expected 5000, got 0.
368 inventory tests pass.
