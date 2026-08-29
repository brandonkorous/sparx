# 286 — The console blamed the server for a product that was never hers

**Status:** fixed
**Severity:** major (a sentence on screen is FALSE, and the only action offered
cannot ever succeed)
**Found by:** P03 · Juniper Row · the standing "someone else's business" check
(CLAUDE.md RULE #7)
**Surface:** the console — every pane that loads ONE record by id. Found on
Sell › a product
**Filed:** 2026-08-27
**Confirmed:** 2026-08-27

## First, the security result: nothing leaked

The check itself passed, and it is worth recording plainly because it is the one
defect class that stops a run.

| Tried                                                         | Got                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Searched the console for `Thistle` (another owner's business) | "Nothing in your orders, customers or products matches "Thistle"."       |
| Searched for `sourdough` (only Thistle & Rye sells bread)     | same                                                                     |
| Searched for `Lindqvist` (a Halo & Hem customer's surname)    | same                                                                     |
| Deep-linked Thistle & Rye's product id into the address bar   | the record did not load; `GET /v1/commerce/products/1e0b43a7…` → **404** |

Devi's own product deep-linked from the same address bar opened correctly, so the
route works and the refusal is the tenant scope doing its job, not a broken URL.
**No leak. The run continues.**

## What is wrong is what it said instead

Pasting that link gave her:

> **Could not load this product**
> This is a problem reaching the server. The product itself is unaffected —
> nothing has been lost.
> **[ Try again ]**

Three sentences, and the server was answering perfectly the whole time.

1. **"This is a problem reaching the server"** is false. The server replied 404
   in a few milliseconds. Devi is told her connection or her shop is down, and
   the honest reading of that is "the console is broken right now" — so she stops
   working, or she calls somebody.
2. **"The product itself is unaffected"** asserts a product that, as far as her
   business is concerned, does not exist. The console is reassuring her about
   somebody else's stock.
3. **"Try again"** cannot ever work. Pressing it re-issues the same request and
   gets the same 404, forever. A button that is guaranteed to fail is worse than
   no button, because it makes the dead end look like impatience.

Confirmed on the wire rather than assumed — the retry press was watched:

```
GET  http://localhost:3100/v1/commerce/products/1e0b43a7-…   404
```

## Why it matters when nobody is testing security

A cross-tenant link is the way I found it, but it is not how Devi will. The same
screen appears when:

- she opens a saved workspace whose pinned pane points at a product she has since
  deleted
- she follows a link a colleague sent her from a different site
- she uses a bookmark from before a tidy-up

Every one of those is an ordinary Tuesday, and every one of them tells her the
server is down.

## Where it lives

`surfaces/commerce/product-detail.tsx:60` reads `isError` and never asks what the
error WAS:

```tsx
if (isError) {
  return (
    <PaneLoadError
      title="Could not load this product"
      description="This is a problem reaching the server. The product itself is unaffected — nothing has been lost."
      onRetry={() => {
        void refetch();
      }}
    />
  );
}
```

**The platform already solved this, twice, within arm's reach of that line.**

- `components/pane-load-error.tsx` has a `reason: 'unreachable' | 'missing'` prop
  whose own docblock says it: _"'missing' — the record is gone (a 404). Retrying
  cannot help, and offering it invites someone to press a button that will fail
  every time"_. It suppresses the retry and tones the state as a warning. The
  detail pane never passes it, and the **default is `'unreachable'`** — so silence
  produces a claim.
- `surfaces/commerce/products-data.ts:588` deliberately does not retry a 404,
  with the comment _"A 404 is meaningful to callers (it means deleted, not
  broken)"_. The information is sitting in the error object the pane is holding.
- `surfaces/commerce/product-scope.tsx:509` — the product's OWN scoped panes
  (Stock, Fitment, Pricing…) render a correct missing state with correct wording.

So a shopper's-eye view of one product renders four panes side by side, and the
main one contradicts the other three.

## The shape this keeps taking

Same family as [281] and [285]: a mechanism built correctly, its callers left on
a default that is a claim. Counted across the console:

```
<PaneLoadError …>                       213 call sites / 196 files
… of which worked the reason out         30 files
"This is a problem reaching the server"  263 occurrences / 240 files
```

**Inventory and Scheduling had already solved it** — `isNotFound(query.error)`
and a `gone ? … : …` ternary at nearly every one of their record panes, plus
Staff, Chat, Feedback and a handful of others. Thirty files knew; the rest, Sell
and Customers among them, took the default. So this is not a thing nobody
thought of; it is a fix that stopped where its author's app ended.

A list pane is a different case and mostly fine — a list endpoint does not 404
because a record is absent. The defect is the **record** panes, where a 404 is
routine.

## The fix

Fixed at the single point, then applied to every pane that loads one record by
id.

1. `lib/api-error.ts` gains `isNotFound` — copy-pasted verbatim into nine data
   modules until now — and `paneLoadReason(error)`.
2. **`PaneLoadError` takes the query's `error` and works the reason out itself,
   so the default stops being a claim.** On a 404 it renders its own not-there
   wording rather than the caller's network sentence, because that sentence is
   written about the other case. A caller that already passes `reason` keeps its
   own words, so the thirty files that were right stay right.
3. **51 record panes** across Sell, Customers, Stock, Content, My Site, Messages,
   Money, Bookings, Trade and the rest now pass `error={…}` and their noun.

The wording is generic on purpose and never confirms the thing exists somewhere
else:

> **That order is no longer here**
> It has been deleted, or the address points at something that is not in this
> business. Nothing of yours has been lost.

## Confirmed from the same address bar

Same ids, same browser, as Devi.

| Pasted                              | Before                                                                                       | After                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Thistle & Rye's product `1e0b43a7…` | "Could not load this product · This is a problem reaching the server" + a dead **Try again** | **That product is no longer here**, no retry, **Browse products** offered |
| Thistle & Rye's order `6ed18f0e…`   | see [287] — it never resolved at all                                                         | **That order is no longer here**                                          |

Both carry the not-found pose rather than the something-broke one, so the picture
agrees with the words. Checked in **dark and light**, and at **360px** in an
iframe, where the sentence wraps to four lines and nothing scrolls sideways.

Her own product and her own order still open normally from the same address bar,
which is the half that would have been easy to break.
