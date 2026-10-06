# 071 — Ordering from a supplier: codes by heart, no way to start the order, and "sent" when nothing was

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 4 ("a supplier, a purchase order sent and received")
**Surface:** workbench › Inventory › a supplier; purchase orders; the printed order (both consoles, inventory service)
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02, as Doty: Alliant Power added; "What you buy from this supplier" found "L5P injector" by name and "AP54851" / "AP0128" by code; "New purchase order" opened with Alliant Power chosen and nothing marked unsaved; "Add a line" filled each price and code; PO-000001 (6 × $238.00, 10 × $42.00, 2 × $880.00 = $3,608.00, equal to the hand sum) placed, expected October 7 from the 5-day lead time; booked in 6, 10 and 1 (one pump kit short): "17 units in total were added to your stock", goods $2,728.00. Database: AP54800 warehouse 2 → 8, AP0128 13 → 23, AP54851 0 → 1; the counter unchanged; the order "partial". The printed order (read from the page the button builds) carries his logo, both addresses, the reference, Net 30 and every line.
**Blocked on:** —

## What happened

1. **An item could be added to a supplier only by typing your own product code from memory.** "Your product code … We find the item in your catalog by its code." Doty has 693 versions and does not carry their codes in his head; every other place in the console picks an item by name.
2. **Nothing started an order from the supplier's page,** though the section said "A purchase order to them starts from this list". The orders section was hidden until an order existed, and it had no button.
3. **A placed order said "Sent to the supplier"** straight after the dialog said "Nothing is sent to the supplier for you: print the order or pass it on yourself."
4. **The printed order said "Submitted"** beside a screen that said "Placed", "Partially received" beside "Partly received", and would have printed the raw `pending_approval` for an order waiting on a sign-off.

## Fix

- `supplier-detail.tsx` (both consoles): the item is chosen with the shared item search (by name or code, any size of catalog after [069]); the chosen item shows with "Choose a different one". The orders section is always there, with "New purchase order", and says "Nothing ordered from them yet" when empty. Two `color="neutral"` buttons in that section are now plain.
- `purchase-order-detail.tsx` (both consoles): a new order takes a preset supplier (`supplier=` in its address) as its starting state, so the untouched form is not "unsaved".
- `purchase-orders-data.ts` (both consoles): "Placed with the supplier. Waiting for it to arrive."
- `inventory/src/services/purchase-order-document.ts`: `PURCHASE_ORDER_STATUS_LABEL` uses the console's words, including "Waiting for sign-off". 2 tests; the old words redden both.
- Typecheck clean (both consoles), eslint clean, prettier clean.

## Emailing the order to the supplier (built 2026-10-02)

Placing an order sent nothing, and the dialog said so. Brandon said to build sending it from here.

- **Placing** opens a dialog with "Email the order to Alliant Power", ticked when the supplier has an address. The button reads "Place and email it", or "Place the order" when unticked. With no address on file, the dialog says so and points to the supplier page. An order held for sign-off keeps its own confirm: it cannot go to the supplier until somebody approves it.
- **"Email to the supplier"** on any placed, partly received, received or closed order. It sends to their address, or to one typed for this one email without changing their record. Refused for a draft, an order waiting for sign-off and a canceled one, each with its own sentence.
- **The order screen** says "Emailed to orders@alliantpower.test on October 2, 2026." or "Not emailed to Alliant Power from here." It never says "not sent": an order may go by phone.
- **The email** (`purchase-order-sent`) carries the whole order: every line with our code, their code when it differs, quantity × price, the delivery address, the wanted-by date, the reference, the terms and the note. It comes from the business's name and replies go to the business.
- **Endpoint** `POST /v1/inventory/purchase-orders/:id/email` (`{ to? }`); **MCP** `email_purchase_order`. Each send is written to the order's audit trail, which is what the screen reads.

### Found on the way, fixed

- **Every coded email a business sends to an outsider went out under the platform's name.** The invoice, the signing request and the download link published no sender, so the worker used "sparx <noreply@sparx.email>". The invoice ends by inviting a reply "straight to" the business; the reply went to a mailbox nobody reads. All four now resolve the site's sender and reply address (`settingsService.senderHeaders`), the same way the keyed emails always did.
- **A business name ending in "Inc." printed two full stops** in the invoice email ("from Gillett Diesel Service Inc.."). Both emails now end those sentences on another word.
- Piggles' supplier page called its orders list "Orders you have sent them", over drafts nobody sent: now "Orders to this supplier". Its new-order button says "New order", the name the Orders to suppliers screen uses.

### Confirmed

On screen, 2026-10-02, as Doty: PO-000002 (one AP54851 pump kit, $880.00, "Restock AP54851 after short delivery") placed with the box ticked: "PO-000002 placed and emailed to orders@alliantpower.test". Unticked, the button read "Place the order" and the line "Nothing goes to Alliant Power". "Email to the supplier" to corbin.ashdown@alliantpower.test: "Only this one email goes here. Their supplier page still says orders@alliantpower.test", then "Sent 2 times in all"; the supplier record unchanged. Database: one `accepted` email event per send, one `inventory.purchase_order.emailed` audit row per send. The real email, rendered from PO-000002: From "Gillett Diesel Service <noreply@sparx.email>", Reply-To Doty's address, subject "Purchase order PO-000002 from Gillett Diesel Service Inc.", greeting "Hi Corbin Ashdown-Reyes", the Concord Park address, October 7, Net 30, AP54851 1 × $880.00.

### Tests

Email template 7 (the old reply line reddens 2); every-template count 40; inventory refusal 2 (refusal removed reddens 1), lines and freight 3 (their code always, freight always, redden 2); screen words 5 (3 red when broken); invoice "Inc.." 1 (red before the fix). Typecheck clean: inventory, email, email-worker, events, email-platform, commerce-schemas, api-rest, api-mcp, sparx and Piggles workbench. eslint and prettier clean.

Not driven: the MCP tool (same three calls as the endpoint, typecheck only), and the place dialog's no-address message (Doty's one supplier has an address).
