# 057 — His 84 rebuilt parts fake the core charge as a choice, and half let the buyer send the old part first

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 3
**Surface:** workbench › a product's Options and Variants tabs; the live product page; orders; Cores owed
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** On screen as Doty, 2026-10-01:

- **Core charges set up as choices:** 84 listed. Bosch 0986435621 proposed $600.00 + $150.00 deposit, send-first on; "Change this one" → one version `0986435621` at $600.00, deposit $150.00, send-first on; the DEFER version retired; the "Core Charge" choice gone (database checked). Then "Change all 83" → 0 left, empty state pointing to Cores owed; database: 0 core options, 84 one-version parts each with a deposit and send-first.
- **The screen first failed for every request** (it selected `optionValues`, a relation that does not exist; the row type was hand-written behind a cast). Fixed: the type now comes from the model with `satisfies Prisma.ProductSelect`, so typecheck catches it (proved: TS2353 with the old name), and `check:prisma-selects` now follows a select held in a `const` (proved red on exactly that line).
- **Website**, after [060]: product page shows "A $150.00 refundable core deposit, or send your old part first" and the "Your old part" choice; cart drawer and cart page carry the same choice; deposit way: $600.00 + $150.00 = $750.00 at checkout; switching to send first in the cart: deposit row gone, $600.00, "Ships when your old part arrives" on the line and in the checkout summary.
- **Move in, same Shopify file again (practice run):** 168 rows (2 per converted part) left alone with "Its core charge is a real deposit here now…"; none flagged as a core choice; the Bosch part unchanged in the database.
- **Orders, through the counter sale ([061]); card checkout correctly refuses until Brandon sets up Stripe:**
  - Deposit way, O-000001: line "Core deposit 1 × $150.00", $750.00 taken by card; Cores owed listed it (1 owed, $150.00 back). "Core came back" → refund $150.00 recorded ("Core returned: …", back the way she paid), line 1 returned / 0 kept, Cores owed empty. The order then read an amber "Part refunded"; fixed to a green "Paid, deposit back" (server `depositsReturned` from the refunds' kind; both consoles; red proved).
  - Old part first, O-000002: no deposit, $600.00 cash, "Waiting for an old part". Handover refused on screen ("Not ready to hand over yet") AND by the server (422, same sentence). "Old part arrived" (no money moves) → "They collected it" offered → collected.
  - Not waiting, O-000003: "Don't wait for the old part" with a required reason → handover allowed, the line stays on Cores owed as "No deposit" / "Not waiting for the old part".
  - Brynn moved from Lead to Customer on her first purchase.
- **Words changed on the way:** everything said "ships" ("ships when the old part arrives", "Ship without waiting", "ready to ship", "We ship right away"), but a counter sale ships nothing. Shopper side now "ready once your old part arrives"; console "Held until the old part arrives", "Don't wait for the old part"; server refusals "is held until". Both consoles, the three product-page renderers, cart, checkout, account page, email, AI tool descriptions; tests updated; all suites green. Also fixed: "If 1 this part goes now" (count before "this"), and the line still saying "Held until" after the owner chose not to wait (now "You chose not to wait for it", red proved).
- **Receipt email:** O-000003's confirmation reads "DDP … is ready once your old part arrives. Bring or send it to Gillett Diesel Service Inc., 14812 Heritagecrest Way, Bluffdale, UT 84065." The same emails showed four other defects, filed as [064].
- **Not checked:** the shopper's account order page (Brynn has no site login; checked by test only).
  **Blocked on:** —

## What happened

[051] built real core deposits. Then Doty opened his Bosch injector (0986435621)
to give it one, and found no way to.

His Shopify store had no core deposit, so it faked one with a choice on 84
products, under five option names and forty spellings:

- "Accept Core Charge (+$150)" at $730.15 and "Defer Core Charge" at $600.00.
- "Ship now add $200 core charge" and "Ship when core received".
- "Ship now add $150 per core $1200 total" (a set of eight injectors).

Three things were wrong for him in sparx:

1. **Nothing turns these into a real deposit.** Removing the choice by hand "stops
   every version that depends on it being sold". So the safe way is 84 products ×
   several careful steps, with no guide.
2. **One part is two versions.** One injector on one shelf is sold as two versions,
   so its stock is split in two. When he counts 3 injectors in (act 4), one of the
   two versions shows sold out.
3. **Half of his choices are not a deposit at all.** "Ship when core received" means
   the buyer sends the old part first, pays no deposit, and the part ships when the
   old one arrives. sparx has no way to say that, and no way to hold an order
   until the old part arrives.

And the prices do not follow the words. Of the 84: on 7 both sides cost the same, so
the deposit was never charged; on 15 the ship-now side is CHEAPER; on 62 it is dearer,
by amounts that rarely match ("Accept (+$150)" is $130.15 dearer). The deposit cannot be read from the price difference. It has to be read from
the words, and the owner has to see each product before it changes.

## What should have happened

One rebuilt part is one version with one stock count. It carries the deposit its
words name. A buyer picks on the product page:

- **Pay the deposit, ship now.** The deposit comes back when the old part does.
- **Send the old part first.** No deposit. The part ships when the old one arrives.

Nothing in the building can ship a "send it first" line before the old part arrives,
unless the owner says "ship it anyway".

## The whole surface (definition of done)

Data and rules

- [x] Migration: `core_first_offered` on variants; `core_first` on cart lines and
      order lines; `core_hold_released_at` on order lines; checks that a
      send-first line carries no deposit.
- [x] Label reader: `commerce-schemas/src/core-choices.ts`, every one of his labels
      tested (red when the "total" rule is removed).
- [x] Variant: `coreFirstOffered` on create and update (REST, MCP, both consoles).
      Refused on a part the supplier ships (dropship): the old part cannot come here first.
- [x] Cart: `coreFirst` on add; no deposit on that line; part of the merge key;
      merged carts and repricing keep it; refused when the part does not offer it.
- [x] Checkout: the order line carries `coreFirst`.
- [x] One shipping gate, used by every way out: record a shipment, pick list, box,
      pack scan, pack-and-ship. A send-first line waits for its old part; a held
      B2B order waits for approval ([058]).
- [x] Cores owed: send-first lines listed as "Ships when it arrives". Receiving the
      old part releases the line (no money moves). "Ship without waiting" releases it
      with a reason. "Keep deposit" is refused on a line with no deposit.

The conversion

- [x] Service: find every product with a core choice; propose part price (the
      send-first price) and deposit (the words); merge the two versions into one
      (keep the plain SKU, retire the other, move its pictures, refuse when the
      retired one holds stock or is on an open order), remove the choice, set the
      deposit and "send first" on the kept version.
- [x] REST `GET /v1/commerce/core-choices`, `POST /v1/commerce/core-choices/convert`.
- [x] MCP `list_core_choices`, `convert_core_choices`, `release_core_hold`.
- [x] Workbench screen "Core charges set up as choices": every product, today's
      prices beside the new ones, editable part price and deposit, the rows where
      today's price and the words disagree called out, convert one or all.
- [x] Reachable: search phrases; a notice on the product's Options tab when an option
      is a core choice; the Move in result notes it with a link; Cores owed points to it.

The shopper side

- [x] Product page (current design, saved pages repaired, the older page, the builder
      buy box): the two-way choice, with the deposit and what happens next.
- [x] Cart drawer, cart page, checkout summary: "Ships when your old part arrives".
- [x] Order email and account order page: where to send the old part.

Both consoles (sparx and Piggles), parity check, tests proved red, PRD 09.

## Rating effect

Product editor and Move in: Ease deductions until done.
