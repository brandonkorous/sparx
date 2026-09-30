# 832 — A column name is not a secret, and a step that had not happened

**Status:** fixed
**Severity:** correctness + copy
**Found by:** P03 · Juniper Row · act 281
**Surface:** both consoles — Ship-direct suppliers, one supplier, one supplier order
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** connected a real supplier as Devi and read the pane back

## Nineteen fields hidden behind a sentence about four

`DropshipSupplier.credentials` is one encrypted bag and the API returned it as
one bag: nothing. `toSupplierView` said so in its own comment — _"NEVER the
secret values themselves"_ — and the pane said so on screen:

> **Connection details**
> Already stored securely and never shown. Fill a field in only to replace it.

That is right for a key. Measured across the five vendors:

| Vendor    | Secret (`password`) | Plain (`text` / `url`) |
| --------- | ------------------- | ---------------------- |
| Printify  | 1                   | 1                      |
| Printful  | 1                   | 1                      |
| DSers     | 1                   | 1                      |
| Spocket   | 1                   | 0                      |
| CSV feed  | **0**               | **15**                 |
| **Total** | **4**               | **19**                 |

The nineteen are a store id, a shop id, a feed address, and **fifteen
spreadsheet column names**. For the CSV vendor there is no secret at all, so the
sentence described nothing that was there — and a business that had typed
`style_code`, `product_name`, `sku` and `wholesale_price` could not read back its
own mapping. Only retype it, blind, to change any one of them.

The server now returns `credentialValues`: everything except `type: 'password'`.
The form seeds from it, so what she set is what she sees, and the section says
what is true for the vendor in front of her:

> How we reach this supplier. Nothing here is a password, so you can come back
> and read it.

## "A token that has expired or been revoked" — on a connection with no token

The connection failed, correctly: `highlineknitwear.example.com` does not
resolve. The pane said:

> **Needs attention**
> The connection is not working, usually a token that has expired or been
> revoked. Re-enter its details to fix it.

Two things wrong at once. **"Token" is jargon**, and **there is no token** — this
is a spreadsheet address on the web. Re-entering the details would not have
fixed it, and looking for a token would have found nothing to look at.

One outcome, two causes, one piece of advice. `supplierState` took only the
status; it takes the type now, because four vendors fail when a key stops
working and the fifth fails when nobody can read a file:

> We could not read this supplier's file. Check the address is right and that the
> file opens for anybody, not just for people signed in to their system.

[[feedback_one_outcome_two_causes]]

## A toast that said two opposite things

> **Highline Knitwear (Denver) connected**
> Check its credentials: the connection did not come up healthy.

The title says it worked and the body says it did not. "Credentials" and "did not
come up healthy" are both from inside the machine. It now says
**"Highline Knitwear (Denver) saved, but we could not reach it"**, with the
reason in full on the pane below.

## A progress step that reported itself done

The supplier order's Progress list opened with:

> Reached the supplier — 25 Sep 2026, 10:58

drawn from `order.createdAt`. In the schema that column is `@default(now())` on a
row whose `status` defaults to `pending`: it records that we decided to send the
order, not that anybody received it. The row directly beneath it, drawn from
`submittedAt`, is the one that measures sending — and on every pending order it
said:

> Sent to the supplier — Not yet

**So the first row said the supplier had it and the second said it had not been
sent.** Two rows, four inches apart, contradicting each other, with the top one
making the stronger and wronger claim. It reads **Lined up to send** now.
[[feedback_never_present_absence_as_measurement]]

## A disabled button that would not say why

Connecting a CSV supplier needs five things. The two that look like the point —
the name and the feed address — are the first two, and the other three are
column names 500px down the form. Fill in the first two, press **Connect**, and
nothing happened: no message, no movement, no network request. The field errors
below were correct and were off screen.

The pane already computed the sentence. `blocked` is
_"Enter the column: product id: it is needed to connect."_, assembled from five
named checks, and it was used for exactly one thing: `disabled`. It is on the
toolbar now — the one part of the pane that never scrolls — and on the button's
tooltip:

> ⚠ Give the supplier a name.
> ⚠ Enter the column: product id: it is needed to connect.
> Ready to connect

## Five descriptions written for somebody who already knew

The supplier-type picker offers Printify, Printful, DSers, Spocket and CSV feed,
under _"Each one connects a little differently"_ — and then explained the
difference like this:

> Connect your Printful store to import its sync products, submit orders for
> fulfillment, and sync shipment tracking. Apparel-led with strong print quality.

"sync products", "submit orders for fulfillment", "sync shipment tracking",
"AliExpress-sourced", "route orders", "without an API". And **"fulfilled"** is
the word this console keeps off screen on purpose — `order-tone.ts` says why in
its own header: _"'fulfilled' reads as 'finished' to everyone who has not worked
in commerce, when it means the opposite."_

All five rewritten, keeping every fact, for both consoles:

> Products made to order and shipped for you, clothing above all, and known for
> the print quality. Connect your Printful store and we bring its products in,
> send each order over, and bring the tracking number back.

## Three more states that were a different shape

`<PaneWaiting />` bare, with no shell and no card, on the supplier order (both
consoles) — and in sparx it was not even that, but a bare `<p>Loading…</p>`,
with the failure rendering outside the pane background too. Three states of one
pane, three shapes. Same fix as issue 831's three.

## Files

- `wizeworks/services/api-rest/src/routes/v1/dropship/suppliers.ts`
- `wizeworks/packages/dropship/src/vendors.ts`
- `piggles|sparx/apps/workbench/surfaces/dropship/{dropship-data,supplier-detail,suppliers-list,order-detail}.ts|tsx`

## Confirmed on screen

`credentialValues` is a new field on the supplier read, and the dev api-rest
picked it up without a restart: the pane came back showing
`https://highlineknitwear.example.com/feeds/juniper-row.csv`, `style_code`,
`product_name`, `sku` and `wholesale_price` in the fields they were typed into.

## Also fixed in passing

Four `color="neutral"` call sites on secondary toolbar buttons (Browse products,
Sync now, Track parcel ×2) are colorless now, which needs no approval and is what
RULE #4 asks for on a control with no meaning of its own.

## The thing to remember

**A bag of secrets is not a secret bag.** One boolean, `credentialsSet`, stood
for twenty-three fields of which four were sensitive, and the copy was written
for those four. Whenever one flag stands for a collection, check what fraction of
the collection it is actually true of — here it was 17%.
