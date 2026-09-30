# 748 — A shop phones an order through, and Wholesale orders has nowhere to type it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 267
**Surface:** mypiggles workbench — Wholesale orders (`b2b.orders.list`), Take a sale (`commerce.sale.new`)
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, with a real order for Loom and Larder
**Blocked on:** —

## What happened

A stockist rang. Devi opened **Wholesale orders**:

> **No wholesale orders yet**
> _When a business you supply places an order, it shows up here with what they
> bought and what they owe._

A search box, five filters, a bookmark, a refresh and a copy-link. **No way in.**
No button in the toolbar, no `+` on its nav row, and an empty state written as
though orders arrive on their own — which is true of a website and not of a
phone call, and the phone call is how a small maker's wholesale actually works.

## The data says the same thing

**MEASURED 2026-09-20:**

```
wholesale orders, all 43 tenants on this machine      3
wholesale orders for Juniper Row                      0
```

Three, across two tenants, on a machine with eleven wholesale buyers. That is
what a screen with no way in looks like from the database. It is also why
[737](737-the-till-charges-list-price.md) and
[746](746-the-till-calls-a-shopper-by-her-employers-name.md) lasted as long as
they did: nobody had ever taken a wholesale order through this console, so
nothing downstream of one had ever been looked at.

## And when she got to the till anyway, it settled the order

Finding the till by another route did not fix it. The payment box is prefilled
with the whole total, because at a counter the whole thing is paid nearly every
time:

```ts
if (!amountTouched) setPaid(asking > 0 ? asking.toFixed(2) : '');
```

So an order a shop rang through came out **paid in full before a penny had
moved** — never reaching what she is owed, never invoiced, and with the money
section still asking "how much you were handed". The same shape as 737: a
number prefilled for the counter, on the screen a wholesale order also has to go
through. [[feedback_never_present_absence_as_measurement]]

## What was done

**Wholesale orders has a way in, twice** — the toolbar's **Enter an order** and
the same button in the empty state, which is what the Orders list beside it has
always done.

**It opens the till**, which is the console's one order-entry screen and already
resolves a wholesale customer's agreed prices (737) and names them properly
(746). That is a COMMERCE surface reached from a B2B one, which is safe by
construction: `requiredModules('b2b')` is `['commerce']`, so wherever this pane
exists the till does too.

**The tab says what she pressed.** The till has two doors and they are not the
same errand — a counter sale from Orders, an order rung through from Wholesale
orders — so `through: 'wholesale'` carries which, and the tab reads **Enter an
order** rather than renaming her action to "Take a sale" on arrival
([743](743-the-rail-and-the-pane-name-one-action-twice.md)). The launcher passes
nothing and gets the counter name, which is the ordinary case.

**`createParams` is a registry field now**, in both consoles, so the `+` on the
nav row opens with the same words as the button. A field one console honored and
the other ignored would be the next version of this bug.

**The till offers nothing on an account order.** `whatToOffer` puts the rule in
one place:

| what is on the sale                        | the box opens with |
| ------------------------------------------ | ------------------ |
| a counter sale                             | the whole total    |
| a counter sale with a deposit due          | the deposit        |
| a shop ordering on account, deposit or not | empty              |

Nothing here overrides a number she has typed; that is `amountTouched`, the
older half of the same idea.

### And I got the deposit wrong first, and the database said so

The first version let a deposit outrank ordering on account, reasoning that a
deposit is a rule on the PRODUCT and therefore holds whoever is buying. That is
true and beside the point. Driving the order through proved it:

```
O-000018   Tamsin Vale, Loom and Larder
           total $52.00, payment_status partially_paid
           order_payments: one CAPTURED row, $30.00, manual
```

A thirty dollar payment nobody had made, on the first wholesale order this
console has ever taken — the same defect the issue is about, one number smaller,
reintroduced by the exception I wrote into the fix.

**A deposit is what is DUE, not what was TAKEN.** At a counter those are the
same moment, which is why the distinction is invisible there and is the whole
story on the phone. The deposit is still real and still owed; it is the first
thing on the invoice. The till records what was handed over.
[[feedback_a_fix_leaves_its_neighbour_behind]]

O-000018 is left standing, phantom payment and all, as the record of what this
found.

**The money section says what it is for.** "How much you were handed" is a
question about a counter. On an account order it now reads: _Nothing is expected
today: a shop ordering on account pays you later, and the order shows up under
what you are owed. Fill this in only if they paid on the call._

**The empty state stopped assuming they place it themselves:** _Every order from
a business you supply lands here, with what they bought and what they owe. Enter
one yourself when a shop phones it through._

## The same gap in sparx, and why it is not closed here

sparx has no till: no `commerce.sale.*` in its catalog, and its own Orders list
has no create action either. So its Wholesale orders cannot be given a way in
without first building it one, and the gap is not a wholesale gap there — it is
that **sparx cannot write down a one-off order at all**, from any screen.
`repeat-order-new` is the only order-making surface and it makes subscriptions.
That is a surface to build, not a button to add, and it is recorded here rather
than half-done.

## Files

- `piggles/apps/workbench/surfaces/b2b/orders-list.tsx` — the way in
- `piggles/apps/workbench/lib/surfaces/catalog/b2b.ts` — the `+` and its words
- `piggles/apps/workbench/lib/surfaces/catalog/commerce-orders.ts` — the tab's two names
- `piggles/apps/workbench/surfaces/commerce/sale-taking.ts` — new, what the box opens with
- `piggles/apps/workbench/surfaces/commerce/sale-taking.test.ts` — new
- `piggles/apps/workbench/surfaces/commerce/sale-detail.tsx`, `sale-payment.tsx`
- `piggles|sparx/apps/workbench/lib/surfaces/registry.ts` — `createParams`
- `piggles/apps/workbench/components/app-panel.tsx`, `sparx/…/components/module-panel.tsx`

## Proof

Eleven tests, proved red two ways: deleting the account branch (**1 of 11**, the
case the issue is about) and putting the deposit back in front of it (**1 of
11**, the mistake actually made). Three of them read the pane rather than the
function, because a perfect rule over a caller that never uses it is the shape
this issue already was.

Driven end to end afterwards, from Wholesale orders:

| what P03 did                                                                              | what happened                                       |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------- |
| pressed **Enter an order**                                                                | the till opened, tab reading Enter an order         |
| picked Tamsin                                                                             | **Wholesale · Loom and Larder** on the chosen row   |
| typed "Marlow Knit XL"                                                                    | two rows, not eight and not none (749)              |
| added XL · Moss                                                                           | **$52.00** · Their agreed price · normally $96.00   |
| looked at What they paid                                                                  | empty, and "Nothing is expected today"              |
| pressed **Write it down**                                                                 | **O-000018**, and it appears under Wholesale orders |
| [[feedback_screen_over_a_function_nobody_calls]] · [[feedback_a_test_that_cannot_go_red]] |
