# 463 — "Updated just now", over figures from breakfast

**Status:** fixed (the marker). One question left for Brandon — see below.
**Severity:** major
**Found by:** Devi opening "What you kept", the Money module's headline
**Surface:** `finance.profit` (both consoles)
**Filed:** 2026-09-09

## What was wrong

"Did you make money" is a CACHE of a subtraction, and it is filled **once a day**:

| job                       | schedule                 |
| ------------------------- | ------------------------ |
| `commerce-revenue-rollup` | `0 6 * * *` — 06:00 UTC  |
| `finance-profit-rollup`   | `45 6 * * *` — 06:45 UTC |

So everything a shop takes or spends after breakfast is absent from the answer
until tomorrow morning, unless somebody presses **Rebuild figures**.

The screen had no way to say so. Its refresh control showed `dataUpdatedAt` —
react-query's timestamp for **when the browser last fetched** — so a page opened
at 5pm read "updated just now" over numbers computed at 06:45.

A freshness marker that measures the wrong thing is worse than none: it answers
the question a shop is actually asking, wrongly, with confidence.

Devi's own reading: **Money in $0.00** for a month in which she had taken $726.

## The column was already there

`rollup_finance_daily_profit.computed_at` is `not null`, written on every rebuild
(`computedAt: new Date()`), and read by nobody. [[feedback_fetched_but_never_rendered]].

`profitForRange` now returns the newest `computedAt` across the range — null when
nothing has ever been worked out — and the refresh control shows THAT.

## Proven on screen

Pressed **Rebuild figures** at 10:43. Reloaded the pane at 10:51, so react-query's
fetch was seconds old. The marker reads:

```
<time datetime="2026-09-09T10:43:30.947Z">8 minutes ago</time>
```

Before the fix it would have said "just now".

## What I fixed, and what I did not

I first thought `computedAt` was the fix for the $0.00 and **it is not** — the
rollup had been recomputed seconds earlier by the cost she recorded, so it would
have said "just now" and still shown zero revenue. I reverted it, found the real
cause, and re-added it for the reason it actually serves.

The real cause of the $0.00: `recomputeDay` reads revenue from
`rollup_commerce_daily_revenue`, which only the nightly cron maintains. Recording
a cost triggers a profit recompute (`finance.expense.recorded` → finance-worker),
and that recompute reads whatever the revenue rollup currently holds. The
**button** reconciles revenue first and its comment says exactly why —

> _"a shopkeeper who took forty dollars over the counter, pressed 'Rebuild
> figures' and was told 'no money came in' was reading a revenue rollup that had
> not been touched since the small hours"_

— but the **event path** does not. The neighbour was left behind.

**Not fixed here, because it is a cost decision.** Closing it means either
reconciling revenue on the read path (a delete-and-insert window on every page
view) or a new consumer keeping the revenue rollup fresh from `order.paid`. Both
add recurring database work, which is Brandon's call rather than mine
([[feedback_verify_cost_decisions]]). With the marker in place the screen is now
honest about what it is showing, which is the part that was mine to fix.
