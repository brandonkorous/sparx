# 176 — Two scarves got the same code, and one of them lost the price she typed

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 4
**Surface:** mypiggles › Sell › Products › Add a product
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** re-ran the two-scarf sequence as Devi — distinct codes, price saved
**Blocked on:** —

## What happened

Devi added two products, one after the other, the way anyone adds a pair of
related things.

The first: name "Throwaway test scarf A", price 12.00. The form filled the web
address in for her as `throwaway-test-scarf-a`, and filled the Product code in as
`THROWAWAY-TEST-SCARF-1`. Saved. Toast: "Throwaway test scarf A added · It is
saved but not on sale yet".

The second: name "Throwaway test scarf B", price 13.00. The web address came out
`throwaway-test-scarf-b`, correctly different. **The Product code came out
`THROWAWAY-TEST-SCARF-1` — character for character the code the first scarf is
already using.** Under that very field, in the app's own words:

> Your own reference for this product — on labels, on invoices, in your records.
> It has to be different from every other code you use.

She pressed **Add product**. It saved. No error, no warning about the code. The
toast said:

> **Throwaway test scarf B was added without a price**
> Set its price here — nobody can buy it until you do.

She had typed 13.00. It was in the box when she pressed the button.

In the database, scarf B has no price because **it has no version row at all**:

```
         title          |              variant_id              |          sku           | price_cents
------------------------+--------------------------------------+------------------------+-------------
 Throwaway test scarf A | 4b0bc568-b612-4d09-8d39-48c7e98b0084 | THROWAWAY-TEST-SCARF-1 |        1200
 Throwaway test scarf B | <NULL>                               | <NULL>                 |      <NULL>
```

The server rejected the duplicate code with a perfectly clear sentence — `SKU
"THROWAWAY-TEST-SCARF-1" already exists` — and the console threw that sentence
away and blamed the price instead.

## What should have happened

Three things, in order of when they went wrong.

1. The form should not suggest a code it could have known was taken. Two products
   with different names got the same code.
2. If a code is taken, she should be told **before** she saves, on the field, in
   the words the field itself uses — not after, about something else.
3. The message she did get should have said what actually happened. She typed a
   price; telling her she did not is telling her something false about her own
   work, and the remedy it prescribes ("Set its price here") will fail again for
   the same hidden reason, because the price cannot be saved without a code and
   the code is still the taken one. One visible outcome, two causes with
   different fixes, and the message names the wrong one and then sends her back
   to redo the thing she already did right.

## How to reproduce

Every time.

1. Sign in as Devi, open **Sell › Products › Add a product**.
2. Name: `Throwaway test scarf A`. Price: `12.00`. Leave the code as offered.
   Add product.
3. Add a product again. Name: `Throwaway test scarf B`. Price: `13.00`. Leave the
   code as offered.
4. Read the Product code field: it is the same code as step 2.
5. Add product. It saves, and the toast says it was added without a price.

The two names need only agree in their first 20 slug characters, which is why it
reproduces on names that look nothing alike at a glance:

- "Organic cotton crew neck tee, navy" / "…, black"
- "Hand-poured soy candle, lavender" / "…, vanilla"
- "Sunday Trouser, wide leg" / "Sunday Trouser, straight leg" ← in Devi's own catalog

## Why it matters

Wrong money and a false statement, together.

A product with no version is not sellable and not fixable by the route she was
sent down. She was told she forgot a price she did not forget, so the natural
next move — go and type the price again — fails a second time with no more
explanation than the first. An owner who does that twice concludes the product
form is broken, and she is not wrong.

The catalog is also left holding a product that cannot be sold and shows no price
anywhere, which is exactly the half-state the Add form's own comment says it
exists to avoid.

## Where it lives

- [piggles/apps/workbench/surfaces/commerce/products-data.ts:1533](../../../apps/workbench/surfaces/commerce/products-data.ts#L1533)
  — `suggestSku` calls `slugifyUpper(title, 20)`. The 20 is the whole bug: the
  column is `varchar(127)` and the schema's `Sku` allows 127, so the suggestion
  was being cut to a sixth of the available length for no stated reason. Anything
  past character 20 of the name — which is where a shop's distinguishing word
  usually is — is discarded before the code is formed.
- [piggles/apps/workbench/surfaces/commerce/product-add.tsx:121](../../../apps/workbench/surfaces/commerce/product-add.tsx#L121)
  — the `onError` branch builds a toast from nothing but the count. The real
  reason is on the error (`VariantAfterCreateError.reason`) and is rendered into
  an `Alert` on this pane, but the same handler navigates away to the detail pane
  first, so the Alert is never on screen to be read.
- [wizeworks/packages/commerce/src/services/variant-service.ts:362](../../../../wizeworks/packages/commerce/src/services/variant-service.ts#L362)
  — the server side is correct and already says the right thing.

## The fix

Three changes, because there were three separate failures: the code that
collided, the collision nobody caught, and the sentence that named the wrong
cause.

**1. The suggestion uses the whole name.**
[products-data.ts](../../../apps/workbench/surfaces/commerce/products-data.ts) —
`suggestSku` was `slugifyUpper(title, 20)`; it is now `SKU_STEM_MAX = 125`, which
is the schema's own 127 less room for the `-1`. The 20 had no reason behind it
and the column never wanted it. Names are the one thing a shop already keeps
distinct, so deriving from the whole name inherits that distinctness.

**2. The form asks whether the code is free, and settles on one that is.**

New `GET /v1/commerce/variants/sku-owner` →
[products.ts](../../../../wizeworks/services/api-rest/src/routes/v1/commerce/products.ts),
over a new `variantService.checkSku` in
[variant-service.ts](../../../../wizeworks/packages/commerce/src/services/variant-service.ts).
It returns who holds a code AND a free one, so a caller never has to ask twice or
invent one.

Two details that matter more than they look:

- It matches `create`'s collision check **exactly**, which means it does NOT
  filter `deletedAt`. The unique index is `(tenantId, sku)` with no deleted
  column in it, so a retired variant still holds its code. A check that skipped
  deleted rows would have answered "free" and the save would have failed on the
  very constraint the check exists to predict — the same bug, one layer down.
- The next free number counts UP from the highest in use rather than filling
  gaps. A code is a label somebody may already have printed; reusing a retired
  product's number is how two boxes in a stockroom end up saying the same thing.

In [product-add.tsx](../../../apps/workbench/surfaces/commerce/product-add.tsx)
the check always asks about the SUGGESTED code — derived from the name and
nothing else — so the query key is stable and the answer cannot chase its own
tail. What the field then shows splits on who chose the code:

| The code is                                            | What happens                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| the app's suggestion, and taken                        | quietly replaced with the next free number                            |
| typed by her, and taken                                | named on the field, with a free one offered, and Add product disabled |
| unknown (the check has not answered, or could not run) | nothing is claimed either way                                         |

The first row is the important one. She never chose that code, so showing her a
red error for it would be blaming her for the app's own suggestion.

The third row is [never present absence as measurement]: a form that says "that
code is free" on the strength of a request still in flight is making a
measurement it does not have. If the check cannot run at all, the form degrades
to exactly its old behaviour rather than blocking her.

**3. The message says what happened, and prescribes something that works.**
New [product-add-code.ts](../../../apps/workbench/surfaces/commerce/product-add-code.ts).
A code conflict is now read off the wire fields (`CONFLICT` + `details.field ===
'sku'`) rather than by sniffing the server's English, and the half-created toast
becomes:

> **Throwaway test scarf B was added, but its code is already in use**
> Another product has that code, so the price could not be saved against it. Give
> this one a different code here and the price will save with it.

The `Alert` on the Add pane and the toast on the detail pane now say the same
sentence, from one function, so the two can no longer drift.

**Siblings checked.** `suggestSku` had exactly one caller, so nothing else was
generating short codes. The Variants tab writes codes through
`variantService.create` and `renameSku`, both of which already refuse a duplicate
with the same conflict — they surface it as a normal write failure rather than
half-succeeding, because there is no second write to half-fail. The Add form was
the only two-write path.

## Confirmed by

> Re-ran the exact sequence as Devi, 2026-08-23.
>
> - "Throwaway test scarf B" now offers `THROWAWAY-TEST-SCARF-B-1`, not
>   `THROWAWAY-TEST-SCARF-1`. The truncation is gone.
> - Named a product "Throwaway test scarf", whose code `THROWAWAY-TEST-SCARF-1`
>   genuinely IS taken by scarf A. The field settled on `-2` on its own, with no
>   error shown — she never picked it, so she is never told off for it.
> - Typed `THROWAWAY-TEST-SCARF-1` over the top by hand. The field went red with
>   "“Throwaway test scarf A” is already using this code. Try
>   THROWAWAY-TEST-SCARF-2 instead.", and **Add product** went disabled
>   (`btn.disabled === true`), so the half-create cannot be reached.
> - Put the offered code back, priced it 14.00, saved. Product, code and price
>   all landed together:
>
> ```
>         title          |          sku           | price_cents
> ----------------------+------------------------+-------------
>  Throwaway test scarf  | THROWAWAY-TEST-SCARF-2 |        1400
> ```
>
> The orphaned "Throwaway test scarf B" from before the fix is still in the
> catalog with no version row, and is deleted as part of confirming
> [166](166-clearing-the-decks-took-fifteen-separate-deletions.md)'s bulk delete.

One thing found while confirming this and NOT fixed here: the error message
renders at 12px, smaller than the 14px hint it replaces. Filed separately as
[177](177-the-sentence-telling-her-what-went-wrong-is-the-smallest-on-the-form.md)
because the value is hardcoded inside silicaui and the fix needs a decision.

## Rating effect

—
