# 538 — A return that would not let her open the sale, or the buyer

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, checking a faulty belt coming back
**Surface:** `piggles|sparx/apps/workbench/surfaces/commerce/return-detail*.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_fetched_but_never_rendered]] — the commonest shape in this codebase

## What she saw

Sell → Returns → Marguerite Adeyemi's belt.

> `Approved` Order O-000007
>
> **Marguerite Adeyemi**
> Asked Aug 27, 2026 · Wants money back · 1 item
>
> **What is coming back**
> Leather-covered belt · Faulty · 1 asked back · "The buckle came away from the strap after a week." · $72.00
>
> **Who is returning it**
> Marguerite Adeyemi

Two dead ends on one small screen.

**"Order O-000007" was plain text.** To look at the sale she had to note the
number, go to Orders, and search for it.

**"Who is returning it" was a card that said the name a second time.** It is
directly under a heading that already says "Marguerite Adeyemi", so it carried
nothing at all. And the question an owner actually has in front of a return is
whether this person sends everything back. That is on their record, and the
record was not reachable from here.

## Measured

Both were already in the component's hand.

```ts
// returns-types.ts
orderId: string;
orderNumber: string | null;
customerId: string | null; // ← nothing drew this
customerName: string | null;
```

```ts
// return-detail.tsx, sixty lines above the plain-text order number
const { data: order } = useOrder(detail.orderId);
```

The order is **already fetched** on this pane, for the line prices. The screen
had the id, had the record, and rendered a string.

## Fixed

- The order number in the header is now the button that opens the sale.
- "Who is returning it" keeps the name and gains **Open their record**, which
  opens the buyer in CRM's hue, since it is CRM's data on a commerce screen.
- Both open in a new tab, the house default, so the return stays where it was.

Proven on screen: the link opens Marguerite's card, which answers the question
the return raised (5 orders, $1,308.60, $112.00 paid).

The "Who is returning it" card now earns its place. A card that repeats the
heading is not a small waste of space, it is a promise that there is something
there.

## Files

- `piggles/apps/workbench/surfaces/commerce/return-detail.tsx`, `return-detail-record.tsx`
- `sparx/apps/workbench/surfaces/commerce/return-detail.tsx`
