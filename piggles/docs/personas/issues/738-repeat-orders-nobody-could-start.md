# 738 — Repeat orders nobody could start, under three screens that said customers could

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 264
**Surface:** mypiggles + sparx workbench — Repeat orders (list, detail, and the product panel); api-rest; the subscription tick
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, end to end: set one up, then drove the renewal and watched the order appear
**Blocked on:** —

## 1. A repeat order could not come into existence

**`subscriptionService.create` shipped with the models, the renewal worker, the
dunning ladder, the invoice path and an MCP tool, and had ONE caller in the
entire platform: that MCP tool.**

```
grep subscriptionService.create across wizeworks/**       2026-09-19
  → mcp/write-tools.ts:287                                the only one
  no POST /v1/commerce/subscriptions                      (list, get, pause,
                                                           resume, skip, cancel
                                                           and payment-method
                                                           all exist)
  no checkout path                                        checkout-service.ts
                                                           mentions the word once,
                                                           in a comment
  no storefront path                                      wizeworks/apps/site has
                                                           subscribe UI NOWHERE,
                                                           only an account page
                                                           that lists ones that
                                                           already exist
```

**MEASURED:** `select count(*) from commerce_subscriptions` — **0 rows, across
all 43 tenants on the machine.** Not "none for Juniper Row". None anywhere,
because there was no way to make one.

So the whole area — a list, a detail with pause/resume/stop, a product panel with
three carefully written empty states, a "what repeat orders are worth" figure —
sat over a table that could never fill.
[[feedback_screen_over_a_function_nobody_calls]]

## 2. And three screens told the shop owner her customers could do it

Every one of these was on screen in her console:

| where                            | what it said                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Repeat orders, empty             | "When a customer sets up a product to be delivered on a schedule, their repeat order shows up here"               |
| Repeat order options, not set up | "Customers would then choose a delivery frequency at checkout, and every repeat order would appear on this panel" |
| Repeat order options, set up     | "customers can choose that at checkout. Nobody has yet"                                                           |

The third one is the worst of the three, because it tells her the feature is
live and the fault is her customers' lack of interest. There is no delivery
frequency at any checkout on any storefront in this platform.
[[feedback_a_promise_in_copy_is_a_contract]]

## What was done

**A screen that sets one up, because that is how a small shop actually gets
one.** Somebody rings and asks for a scarf every two months. She writes it down
once. `commerce.subscription.new`: who it is for, what goes out each time and at
what price, how often, where it goes, and a sentence about how it gets paid.
`POST /v1/commerce/subscriptions` behind it.

**It invoices; it does not charge a card.** Only the customer can vault a card,
on a checkout of their own. A back-office screen offering "charge their card"
would be inviting a shop owner to take card numbers down the phone. So each
delivery bills and is emailed, which is what a shop that agreed this over the
counter does anyway. The detail pane already says the other half: "Marguerite
Adeyemi has no saved card yet. They can add one from their account, then it can
be charged automatically" — and that IS reachable, from the account area's
payment-methods page.

**The form quotes the figure the platform keeps.** `repeatOrderMonthlyCents` and
`nextOccurrenceAfter` moved into `@wizeworks/commerce-schemas` and the service
now calls both, so "worth about $29.00 a month" on the form is produced by the
same function that puts $29.00 on the list afterwards. Same for the first
delivery date.

**The copy points at what exists.** The empty state now says what a repeat order
IS and offers a button. The product panel says "Open Repeat orders and start
one", and says plainly that shoppers cannot choose a schedule for themselves
yet, rather than implying they already can.

## 3. Found on the way: the tick reported nothing and did nothing

Driving the renewal to prove the chain, the tick came back `due: 1` with every
outcome bucket at zero and no errors, and the subscription was untouched.

Two separate faults, both invisible:

**`?asOf=` reached half the question.** `findDueOccurrences` took the operator's
date; `processOccurrence` compared against `Date.now()` and silently returned.
So the documented dry-run selected rows and then refused every one of them. Two
halves of "is this due", two clocks.
[[feedback_a_fix_leaves_its_neighbour_behind]]

**`skipped` was the one outcome with no counter.** `case 'skipped': break;`. A
pass where EVERY renewal did nothing reported `due: 12` and twelve zeroes, which
reads as a perfectly healthy tick over a business that billed nobody.
[[feedback_never_present_absence_as_measurement]]

Both fixed: `asOf` goes all the way down, and `skipped` is counted and
documented as ordinary in ones and a problem when it equals `due`.

## 4. Found on the way: nine product panels ignored the brand's vocabulary

Nine panes hang off one product. Each hand-wrote a `const LABEL` and handed it to
`useProductScope`, which built the tab title from it. The catalog has an entry
for all nine, and not one of them reached the tab:

| surface                          | the rail, launcher and palette | the tab             |
| -------------------------------- | ------------------------------ | ------------------- |
| `commerce.product.fitment`       | What it fits                   | **Fitment**         |
| `commerce.product.dropship`      | Shipped by a supplier          | **Dropshipping**    |
| `commerce.product.configurator`  | Build-your-own options         | **Configurator**    |
| `commerce.product.trade-pricing` | Wholesale price                | **Trade pricing**   |
| `commerce.product.subscriptions` | Repeat order options           | **Subscriptions**   |
| `commerce.product.stock`         | How many you have              | **Stock**           |
| `commerce.product.channels`      | Where it is listed             | **Where it sells**  |
| `commerce.product.translations`  | Other languages                | **Translations**    |
| `commerce.product.reviews`       | Reviews and questions          | Reviews & questions |

Nine of nine, four of them the platform jargon this brand exists to replace. The
same string was doing two jobs — a screen NAME on the tab and a lowercase noun
inside "This panel shows fitment for one product at a time" — and conflating them
is what put it out of the brand's reach.

Split: the title now comes from `surfaceTitle(ctx.descriptor.surface)`, the one
lookup every other row in the console already goes through, and the per-file
const is only the noun. **`product-panel-names.test.ts` asserts its own
denominator (9), refuses on a pane it cannot read, and was proved red twice** —
once by putting a capitalized name back in a noun, once by wiring the title back
to it.

## 5. Small ones, fixed here

**A filtered empty state blamed the filter on a list that was empty anyway.**
"No repeat orders are marked 'Payment failed'. Switch back to All to see the
rest" — and All was empty too. It now tells the two apart.

**The history named an order and would not open it.** "Renewed: an order was
placed" while `orderId` and `orderNumber` sat unread in the event's own payload.
It links now. [[feedback_fetched_but_never_rendered]]

## Checked and NOT a defect

**Nº1 Fig & Neroli did not appear in the product picker.** It is scoped to the
journal site and this was the primary site. Correct behavior, and the check that
proved it also proved the picker is site-scoped rather than tenant-wide.

**The first delivery is not today.** `create` schedules the first occurrence one
whole interval out, which is right — she is setting up the repeat, and today's
order is today's order. But nobody would guess it from silence, so the form says
so: "Nothing goes out today, so if they want one now take that as an ordinary
sale."

**An unreadable cadence is worth 0, not a guess.** `monthlyOccurrenceFactor`
returns 0 for a unit it does not recognize. Left as it was, with the reason
written down: `IntervalUnit` validates on the way in, so it is unreachable, and
guessing a cadence would put a number on a screen nobody measured.

## Found here, NOT fixed here

**Shoppers still cannot start one themselves.** No product page, cart or checkout
in `wizeworks/apps/site` offers a delivery schedule, and the cart has no line-level
place to carry one. That is a storefront feature with a real payment-vaulting
question in the middle of it, not a copy fix, so it is its own issue:
[739](739-a-shopper-cannot-subscribe.md). The copy no longer claims otherwise.

## Files

- `wizeworks/packages/commerce-schemas/src/subscriptions.ts` — `repeatOrderMonthlyCents`, `monthlyOccurrenceFactor`, `nextOccurrenceAfter`
- `wizeworks/packages/commerce-schemas/src/subscriptions.test.ts` — new
- `wizeworks/packages/commerce/src/services/subscription-service.ts`
- `wizeworks/packages/commerce/src/services/subscription-billing.ts`
- `wizeworks/packages/commerce/src/schedulers/subscription-tick.ts`
- `wizeworks/services/api-rest/src/routes/v1/commerce/providers.ts`
- `wizeworks/packages/links/src/routes.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/repeat-order-words.ts` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/repeat-order-words.test.ts` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/repeat-order-new.tsx` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/product-panel-names.test.ts` — new
- `piggles|sparx/apps/workbench/surfaces/commerce/subscriptions-data.ts`
- `piggles|sparx/apps/workbench/surfaces/commerce/subscriptions-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/subscription-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-subscriptions.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-scope.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-{channels,configurator,dropship,fitment,reviews,stock,trade-pricing,translations}.tsx`
- `piggles|sparx/apps/workbench/lib/surfaces/catalog/commerce-orders.ts`
- `piggles/apps/workbench/lib/console/vocabulary.ts`
- `piggles/apps/workbench/surfaces/automations/recipes-catalog.ts`

## Proof

On screen, in Juniper Row's console, then in the database:

1. Repeat orders, empty: the mascot, what a repeat order IS, and a button.
2. Started one for **Marguerite Adeyemi**: silk twill scarf, $58.00, every 2
   months, to her default address of three.
3. The form said **"Sent every 2 months, that is worth about $29.00 a month while
   it runs"** and **"First delivery Nov 19, 2026 … Nothing goes out today"**.
4. Saved. The detail pane reported **$29.00 a month** and **Nov 19, 2026** — the
   same two numbers, because the same two functions produced them. The list row
   read Running · Invoiced · Nov 19, 2026 · 1 product · $29.00.
5. Drove the renewal: `POST /internal/commerce/subscription-tick?asOf=2026-11-21`
   → `due: 1`, and this time the events read **created → renewed → invoiced**,
   `next_occurrence_at` advanced to **Jan 20, 2027**, and order **O-000017,
   $58.00, placed, unpaid, source `subscription_renewal`** exists.
6. The detail's history now shows **Renewed: an order was placed → O-000017** as
   a link, and opening it lands on the order.
7. The product panel's tab reads **"Repeat order options · Nº1 Fig & Neroli"**,
   not "Subscriptions · …".

All three panes checked in both themes and at 360px.

Piggles 1,095 tests / 117 files, sparx 965 / 104, commerce 225 / 22,
commerce-schemas 537 / 20, api-rest 243 / 30. Six typechecks clean (both
consoles, commerce, commerce-schemas, api-rest, links); ESLint clean on every
changed file; `prettier --check` green across the repo; **all 53 structural
checks pass**. The two new guards were each proved red before being believed.
