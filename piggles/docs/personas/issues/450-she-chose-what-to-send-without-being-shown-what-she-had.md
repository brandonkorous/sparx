# 450 — She chose what to send without being shown what she had

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 109
**Surface:** Selling › Returns › a return › Send the replacement
**Filed:** 2026-09-08
**Fixed:** 2026-09-08
**Confirmed by:** P03 · Juniper Row · act 109

## What happened

Jo Kim returned a Marlow Knit and wrote:

> "A size up in Oat **if you have one**, otherwise Moss."

The customer asked the question and deferred to Devi's stock in the same
sentence. Devi opened **Send the replacement**, and the screen that asks which
version to send showed her the product name, the version, the code and the
price — **and no count of any kind**.

She typed her answer into the note herself: _"Oat is gone in L. Send Moss."_

**She had six of L·Oat.** The customer's first choice was on the shelf, and the
one screen that could have said so was the screen asking her to decide.

## And it opened on the wrong products entirely

Before any search, the picker lists the whole catalog alphabetically. Juniper Row
sells clothes and jewellery, so a knitwear return opened on:

> Astrid Signet Ring · Colette Tennis Bracelet · Céleste Cuff

Typing `Marlow` fixes it, but the obvious answer to "what are you sending
instead" is another version of the thing that just came back, and the screen made
her ask for it.

## Why it matters

Returns are **22% of Devi's orders** and exchanges are the normal case, so this
is not an edge. Sending the customer's second choice while their first sits in
stock costs her twice: the goodwill, and a size she now cannot sell to the person
who wanted it.

Worse, nothing catches it afterwards. The swap settles cleanly, the ledger moves
both halves, and the record simply says a Moss went out. There is no screen on
which the mistake ever appears.

## The fix

Both halves, on the one screen.

**1. The product that came back goes first.** The return line now carries the
`productId` and `variantId` of the order line it returns — the server had them on
the order item and dropped them on the way out, so the console could not know
which product the customer was talking about. The picker takes a `preferProductId`
and floats that product's versions to the top before anything is typed. The rest
of the catalog is still there, because sending something else is allowed.

**2. Every row says how many there are.** Three states, not two:

| what she sees   | when                                                    |
| --------------- | ------------------------------------------------------- |
| **6 to sell**   | counted, and there are some                             |
| **None left**   | counted, and there are none — the only one with a color |
| **Not counted** | nobody ever counted it                                  |

The third state is the one that keeps being got wrong. A version nobody counted
is UNTRACKED, not zero: the shop sells it without limit, and drawing "none left"
over it would invent a measurement nobody took — the same mistake as the band
that told a shop to go and count its memberships ([444], [446]).

The number is `sellable`, not the API's `available`: the sell path also withholds
the safety buffer, so `available` on a buffered level is a figure nobody can
reach. That function used to be private to the stock pane; a second screen now
asks the same question, so it moved beside the type it reads.

### Where the code changed

- `wizeworks/packages/commerce/src/services/return-service.ts` — `productId` /
  `variantId` on each return line
- `{piggles,sparx}/apps/workbench/surfaces/commerce/returns-{types,data}.ts` — the type
- `piggles/apps/workbench/surfaces/commerce/variant-picker.tsx` — `preferProductId`,
  `stock`, `StockNote`
- `piggles/apps/workbench/surfaces/commerce/return-exchange-modal.tsx` — passes both
- `{piggles,sparx}/apps/workbench/surfaces/commerce/products-data.ts` — `sellable`
  moved here, `stockNoteKind` added; `useProductStock` no longer fires on an empty id
- Tests: `{piggles,sparx}/apps/workbench/surfaces/commerce/products-data.test.ts` (6 each)

Both props are optional, so the four other call sites of this shared picker (a
bundle component, a configurator add-on, a B2B tier) are untouched.

Guards run red one at a time: making "never counted" report as "none left"
reddens exactly that test; dropping the safety buffer from `sellable` reddens
exactly its own.

## Confirmed by

P03 · Juniper Row · act 109. A fresh return on order O-000014 taken to "back with
you", then **Send the replacement**: the picker opened on **Marlow Knit** with
every version reading its own count — XS·Oat 3 to sell, L·Moss 6, L·Oat 5, M·Moss
4 — instead of on signet rings with no numbers. Searching `Tote` showed the two
genuinely uncounted totes badged **Not counted** rather than as zero.

## Rating effect

`Selling › Returns › a return` — recorded in [rating.md](../rating.md).
