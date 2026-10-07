# 928 — "Take pre-orders for it" took no pre-orders

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P03 · Juniper Row · act 325, re-scoring Preorders from a product
**Surface:** mypiggles › a product › Versions › "When you run out of this one", Stock › Preorders, the item picker (both consoles), and the stock hold
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row · act 325, the Linen Shirtdress L · Chalk showing its offer and opening it, and XS · Chalk opening a new offer with itself picked
**Blocked on:** —

## What happened

Every product version has a choice, "When you run out of this one", with three
answers. One is **Take pre-orders for it**. On its own that does exactly what
"Keep selling it and owe it" does: it sells past zero and says nothing. The
product page shows no ship date, and there is no limit on how many she owes.
What makes a preorder is an offer in Stock › Preorders, with a date, a note and a
limit. Nothing on the product said that, and nothing led there. Preorders could
only be found by somebody who already knew it existed (the rating's gap since
issue 678).

Two more came out with it.

1. **The limit held only on items set to "Take pre-orders".** Opening an offer
   switches a "Stop selling it" item to "Take pre-orders", and leaves a "Keep
   selling it" item alone. The stock hold checked the offer's limit only for
   "Take pre-orders" items. So an offer limited to 2 on a "Keep selling it" item
   took a third order, and the step that counts sold units swallowed its own
   refusal (`.catch(() => null)` in `sell-path.ts`). Devi's Colette Tennis
   Bracelet is set up exactly this way, without a limit for now.
2. **The item picker searched one site and did not say so.** Juniper Row has
   seven sites. Searching Preorders for the Studio Hoodie, which is only on
   Juniper Row Press, read "No product matches", as though it did not exist.

## The fix

- **On the product** (both consoles): choosing "Take pre-orders for it" now shows
  what is behind it.
  - With no offer: "Not a preorder yet. Until you set one up, this works like
    Keep selling it and owe it: your product page gives no ship date, and there
    is no limit on how many you owe." and **Set up the preorder**, in Stock's
    color.
  - With an offer: "Taking preorders. Ships March 10, 2027 · 20 left." (or "to
    be confirmed", or the opening day) and **Open the preorder**.
  - With Stock switched off, the same warning, naming the app, with no button.
- **Preorders** opens on the item it is given: its running offer ready to edit,
  or a new offer with the item already picked. `variant` and `product` are view
  settings, so an open Preorders tab is reused, not copied.
- **The limit** is checked on every hold that goes past the shelf, whatever the
  item's setting (`reservations.ts`). With no offer, the check answers nothing,
  as before.
- **The picker** (both consoles), when the business has more than one site and
  finds nothing: "Nothing on Juniper Row matches “Studio Hoodie”. This list shows
  the site you are working in; switch site at the top to look in another."

## Proof

- `demand.test.ts`, "a preorder on an item set to keep selling": 1 on the shelf,
  a limit of 2, a hold of 4 refused, a hold of 3 taken. Red on the old
  `reservations.ts`.
- On screen, as Devi:
  - Linen Shirtdress L · Chalk showed "Taking preorders. Ships March 10, 2027 ·
    20 left." Open the preorder opened its offer in Preorders.
  - XS · Chalk, switched to Take pre-orders without saving, showed "Not a
    preorder yet". Set up the preorder reused the Preorders tab and opened a new
    offer reading "Linen Shirtdress · XS · Chalk". Canceled, and the version put
    back to "Stop selling it" with nothing unsaved.
  - The Studio Hoodie search read as above.
- The sparx console's half is typechecked and tested, not driven.
