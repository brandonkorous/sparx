# 214 — A supplier was sent an address with no name on it

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 11 (dropshipping)
**Surface:** the order a supplier gets for a product they ship (every kind of supplier)
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** the dev outbox, a real send, 2026-10-11
**Blocked on:** —

## What happened

Renée ordered the S&B 68 gallon tank (O-000023), to be sent to her company's saved
address. The checkout said "Going to: Accounts Payable, 2275 S 900 W, Suite 200, Salt Lake
City UT 84119". Teodora approved it, and S&B Filters was sent the order. Under "Ship to our
customer" it read:

> 2275 S 900 W, Suite 200, Salt Lake City, UT 84119, US

No name and no company: a parcel addressed to a street. The phone was dropped too, when
there is one.

## What should have happened

The supplier gets the address exactly as the customer chose it at checkout: the name, the
company when there is one, the street, the city, and the phone.

## How to reproduce

1. A product a supplier ships (here the tank, from S&B Filters).
2. Buy it with any saved or typed address, then read the order the supplier is sent.
3. Every time: the name is missing.

## Why it matters

A carrier delivers to a person or a company. A fuel tank on a pallet at a street number,
with nobody's name on it, is refused or lost, and the customer has paid for it. It is the
same for every supplier: Printful, Printify, DSers and Spocket are handed the same empty
name.

## Where it lives

`wizeworks/packages/dropship-worker/src/handlers/route.ts`: the order's address is read
with keys the order does not use (`name`, `address1`, `province`, `zip`). An order stores
`AddressSnapshot` (`packages/crm-schemas/src/common-commerce.ts`): `recipientName`,
`company`, `line1`, `line2`, `city`, `region`, `postalCode`, `country`, `phone`. Only the
keys both shapes share came through.

## The fix

- `packages/dropship-worker/src/handlers/ship-to.ts` `shipToOf`: reads the order's
  `AddressSnapshot` (`recipientName`, `company`, `line1`, `line2`, `city`, `region`,
  `postalCode`, `country`, `phone`), the older keys second. The router uses it for every
  supplier, so Printful, Printify, DSers and Spocket get the name too.
- `ShippingAddress` (`packages/dropship/src/types.ts`) carries `company`; the emailed order
  prints it under the name when it differs.

Shared: the dropship worker runs for every brand.

Tests, red first: `ship-to.test.ts` (5): the stored shape, the older shape, blanks left
out, no address, and the emailed order naming person and company. dropship-worker 11 pass;
lint clean.

## Confirmed by

P01, 2026-10-11: Renée's second order (O-000024) went to S&B with "Ship to our customer:
Accounts Payable, 2275 S 900 W, Suite 200, Salt Lake City, UT 84119, US" (rendered from the
order with the same code the worker runs; the dev mail file did not exist yet). Her saved
address names "Accounts Payable" and no company; her checkout said the same.

In the dev outbox, a real send: "Purchase order O-000026 from Gillett Diesel Service Inc." to S&B Filters (08:43 UTC Oct 11), "Ship to our customer: Accounts Payable, 2275 S 900 W, Suite 200, Salt Lake City, UT 84119, US", with her delivery note.

## Rating effect

—
