# 536 — "Used 4 times", over $91.20 she could not see

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, asking whether her Spring sale was worth running
**Surface:** `commerce/src/services/discount-service.ts`, `commerce/discounts-list.tsx`, `commerce/discount-detail.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_screen_over_a_function_nobody_calls]] — a live route with no caller

## What she saw

Sell → Discounts → Spring sale. The header:

> `Live` Used 4 times

That is true, and it answers a question nobody asks. She ran 15% off to make a
trade. The only thing she wants to know is the size of it.

## Measured

```sql
select d.usage_count, sum(u.applied_cents)/100.0 as given_away, sum(o.total) as orders_worth
from commerce_discounts d
  join commerce_discount_usages u on u.discount_id = d.id
  left join orders o on o.id = u.order_id
where d.tenant_id = '<juniper row>' group by d.id, d.usage_count;
```

| usage_count | given_away | orders_worth |
| ----------- | ---------- | ------------ |
| 4           | **$91.20** | $563.90      |

Every penny of it was already in the database. `commerce_discount_usages` records
`applied_cents` on **every** redemption, at the moment it happens.

## The part that makes this worth filing

The sum was not merely available. **It was already written, already routed, and
never called.**

`reporting-service.discountPerformance` computes redemptions, `discountCents` and
`uniqueOrders` per discount. `GET /v1/commerce/reports/discount-performance` has
served it since **2026-06-15**, and `docs/dashboard-overview-data-gaps.md` marks
it **✅ shipped**.

Measured 2026-09-16 — every reference to that path in the whole repository:

```
wizeworks/services/api-rest/src/routes/v1/commerce/site.ts:196   the route
docs/130-analytics-normalization.md:43                            a mention
docs/dashboard-overview-data-gaps.md:84                           the ✅
```

**No console has ever fetched it.** Three months of a green tick over a
capability nobody had. The endpoint existed; the feature did not.

## Why a report was the wrong answer anyway

A shop owner does not go hunting for a report to find out what her own offer cost
her. She opens the offer. The figure belongs on the screen she is already
standing on, which is why the fix is not "wire up the report".

## Fixed

`DiscountRow` gains **`givenAwayCents`**, summed from the redemption ledger by
one `groupBy` bounded to the ids on screen, so a shop with a thousand offers
still does two queries. Lifetime rather than a 90-day window, because the
question is what this offer has cost, not what it cost recently. Read from the
ledger rather than re-derived from `valuePercent`, which would disagree the
moment a cap, a minimum or a rounding rule was in play.

- **Detail header:** `Live · Used 4 times · $91.20 given away`
- **List:** a **Given away** column, `$91.20`

The words are a leaf module, `discount-words.ts`, because a rule shaped like a
sentence rots inside a component. Three cases, not two:

| uses | given away | what it says                       | why                                                                       |
| ---- | ---------- | ---------------------------------- | ------------------------------------------------------------------------- |
| 0    | 0          | nothing (list shows `—`)           | "$0.00 given away" on a new offer reads as a failure, not as an absence   |
| 4    | $91.20     | `Used 4 times · $91.20 given away` | the trade, in one line                                                    |
| 2    | 0          | `Used 2 times`                     | free delivery on an order with no delivery charge. Real, and it cost zero |

## Guards

- `discount-words.test.ts`, both consoles, 8 each. **4 go red** when the words
  are reverted to the count alone.
- `commerce-discounts-giftcards-list.test.ts` gains an integration test against
  real Postgres + RLS: the sum comes back on the **list and the detail**, which
  are two code paths, and an unused offer reports `0` rather than being left out.
  It goes red (`expected +0 to be 9120`) with the sum removed.

## Also refreshed

`docs/dashboard-overview-data-gaps.md` no longer claims discount performance is
shipped. A ✅ beside an endpoint says an endpoint exists, and that is not the same
sentence as a capability a person has.

## Files

- `wizeworks/packages/commerce/src/services/discount-service.ts`
- `wizeworks/services/api-rest/test/integration/commerce-discounts-giftcards-list.test.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/discount-words.ts` + `.test.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/commerce/discounts-data.ts`, `discounts-list.tsx`, `discount-detail.tsx`
- `docs/dashboard-overview-data-gaps.md`
