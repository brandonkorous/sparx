# 559 — "Earned per pound of stock", in a shop that deals in dollars

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, on "How it is performing"
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/performance.tsx`, `wizeworks/packages/inventory/src/services/report-registry.ts`, `wizeworks/packages/commerce-schemas/src/costing.ts`
**Filed:** 2026-09-16
**Family:** [[feedback_american_spelling]] · [[feedback_non_technical_audience]]

## What she saw

Three headline figures across the top of the screen. The middle one:

> **Earned per pound of stock**
> **1.26**
> _Fair_

and below it, the card that explains it:

> _For every **pound** tied up in stock, how much profit it brought back._

Every other number on the screen, and on the four screens beside it, is in
dollars: $967.92, $1,837.92, $145 shirtdresses. This one sentence is written in
someone else's money.

## Measured

```js
[...document.querySelectorAll('main *')].filter(
  (e) => e.children.length === 0 && /\b(pound|pence)\b/i.test(e.textContent)
);
```

```
["Earned per pound of stock",
 "For every pound tied up in stock, how much profit it brought back. …"]
```

Two on her screen. Across the tree, four places where a currency word is shipped
to a reader:

| where                                        | text                                |
| -------------------------------------------- | ----------------------------------- |
| `performance.tsx` ×2 consoles (stat tile)    | Earned per pound of stock           |
| `performance.tsx` ×2 consoles (card)         | For every pound tied up in stock    |
| `report-registry.ts` (spreadsheet + summary) | Earned per pound of stock           |
| `costing.ts` (validation message)            | Enter the amount in whole **pence** |

The last one is the sharpest. It is what she is told while typing a freight
charge onto a delivery, and there are no pence in her shop.

Separated out and left alone: `pound` as a unit of **weight** (stretch film sold
by the pound, TikTok's `POUND` shipping unit) and `British pounds` as the name of
the GBP currency in a currency picker. Those are all correct.

## The fix

Where the currency is known, name it. Where it is not, do not name one.

**The card**, which already renders `formatCents(…, report.currency)` twice:

```tsx
For every {formatCents(100, report.currency)} tied up in stock, how much profit
it brought back.
```

→ "For every **$1.00** tied up in stock", and "For every **£1.00**" for a shop in
London. The unit comes from the tenant, never from a word typed in a component.

**The stat tile** is drawn before the GMROI report lands, so there is no currency
to name yet, and a title that changes as data arrives reads as a glitch. It goes
currency-free and says what the ratio means:

> **How hard your stock money works**
> **1.26** · _Fair_

**The spreadsheet label** has `r.currency` in hand and a `money()` helper one line
below it: `` `Earned per ${money(100, r.currency)} of stock` ``.

**The validation message** has no currency and cannot get one, so it says what she
actually did wrong instead of naming a coin:

```ts
.int('Enter the amount with no more than two decimal places')
```

## Proven

Re-measured on her screen after: the `pound`/`pence` filter returns `[]`, the tile
reads "How hard your stock money works", and the card reads "For every $1.00 tied
up in stock".

Both consoles typecheck, and so do `inventory` and `commerce-schemas`. 368
inventory, 463 commerce-schemas, 383 piggles and 295 sparx tests pass.

## Not filed, noted

The same British-currency habit survives in code comments and doc comments
("Pounds-and-pence as typed → whole pence", "a ten-million-pound freight bill",
"how many levels, units and pounds of stock"). Nobody reads those but us, and the
ones inside the files touched here were refreshed in passing. The rest is a tidy,
not a defect.
