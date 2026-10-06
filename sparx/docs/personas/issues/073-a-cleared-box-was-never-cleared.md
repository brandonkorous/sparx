# 073 — A cleared box on a supplier or an address was never cleared

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 4 (testing [071] with a supplier that has no email)
**Surface:** workbench › Inventory › a supplier (both consoles); CRM › a customer's addresses (both consoles); commerce-schemas, crm-schemas
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** Supplier on screen, 2026-10-02, as Doty: Alliant Power's email emptied and saved: "Alliant Power saved", and the database now holds no email, with the phone, contact and lead time untouched. PO-000002's "Email to the supplier" then said "Alliant Power has no address on their supplier page. Type one for this email." with Send off; placing a new draft said "Alliant Power has no email address on file, so nothing goes to them…" and offered only "Place the order". The address was then typed back and saved. Customer address on screen, act 5: Renée Castañeda's "Main office" address (Wasatch Front) edited, "Suite 200" emptied and saved: the card dropped the line and the database holds no line 2; typed back and saved.
**Blocked on:** —

## What happened

1. I emptied Alliant Power's email box and pressed Save. The toast said "Alliant Power saved". The email was still on file, and every order went on offering to email it.
2. The cause covers every optional field on a supplier: contact, email, phone, website, the address lines, terms, lead time, notes. The form left an empty box out of the request, and the server reads "left out" as "leave it alone". There was no way to say "take it off". A value could be changed but never removed.
3. A customer's saved address had the same shape for its label, recipient, company and second line: emptying "Suite 200" and saving kept "Suite 200".

## Fix

- `commerce-schemas/src/inventory.ts`: a supplier's optional fields accept null. The service already wrote any key it was given, so null now clears the column.
- `crm-schemas/src/customers.ts`: label, recipient, company and line 2 on an address accept null, like region, postcode and phone already did.
- Both consoles: `supplier-input.ts` (new, shared shape) sends a cleared box as null. A half-typed country or a lead time that is not a number is still left out, so it never wipes the value on file. `customer-addresses.tsx` sends cleared lines as null.
- Tests: supplier input 3 per console (blank-as-omitted reddens 1); schema 3 (`.optional()` on email reddens 2); address schema 1 (`.optional()` on line 2 reddens 1). Typecheck clean: commerce-schemas, crm-schemas, inventory, crm, api-rest, api-mcp, both consoles.
