# 335 — Her customers were told to ring a sales rep she does not have

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · the standing check, as Marguerite — the buyer's side past the sale
**Surface:** the published site › Your account
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** reloaded Marguerite's account — both panels are gone; three integration tests, red before green

## What happened

Signed in as Marguerite Adeyemi, a real customer of Juniper Row, her account
sidebar offers eleven sections. Two of them are things this shop does not do.

**Bookings**, with a **Book an appointment** button at the top right. Following
it:

> **Book with us**
> Choose a service to see open times and reserve your spot.
>
> **No services are bookable yet**
> Once services are open for online booking, they'll appear here.

**B2B Account**:

> Your account doesn't have B2B access yet. Contact your sales representative to
> set up wholesale purchasing on your account.

Juniper Row is one woman sewing clothes in a Denver studio. She has **0 bookable
services, 0 B2B accounts and 0 sales representatives.** Her customer has just
been told to ring one.

## What should have happened

A shop's account area offers what the shop does. A section that cannot have
content at this shop is not in the list.

## Why it matters

**One of the two sentences is not merely empty, it is wrong.** "Contact your
sales representative" describes a business with a sales team. Devi is the whole
business. A customer who acts on that sentence has nobody to ring, and the shop
looks like it lost their paperwork rather than like it never sold wholesale.
Advice printed on a screen is part of the contract — [[feedback_one_outcome_two_causes]].

**The invitation is worse than the empty state.** "No services are bookable yet"
is a good, honest empty state. The defect is that anything invited her into it:
a **Book an appointment** button is a promise, and it was made on behalf of a
shop that takes no appointments.

**It reads as the shop's fault.** A shopper does not know Juniper Row runs on
Piggles. They see a clothes shop that offers appointments it cannot give and
wholesale it cannot set up.

## Where it lives

[layout.tsx](../../../../wizeworks/apps/site/app/account/%28authed%29/layout.tsx) —
`NAV` was a flat hardcoded array of eleven items, rendered in full for every
shopper on every tenant.

## The fix

**Evidence, never the module flag.** This is the part worth keeping. The obvious
gate is `isModuleEnabled(tenantId, 'scheduling')`, and it is wrong twice:

- A module being enabled says the tenant COULD take bookings. It says nothing
  about whether they do. Devi's `scheduling` module is on and she has never
  created a service.
- **Piggles ships every module enabled** (its RULE #2 — one flat price, the whole
  workspace on day one), so a module gate would hide precisely nothing on the
  brand where this was found.

So `/v1/public/commerce/account/me` now returns what the shop can actually
deliver to this shopper, read from the rows:

| Offer      | True when                                               |
| ---------- | ------------------------------------------------------- |
| `bookings` | at least one service is `bookableOnline` AND `isActive` |
| `b2b`      | THIS customer's `companyId` is set                      |

`bookings` reuses the exact predicate the booking surface uses to serve a
service, in all five places it checks — so a service the shopper could not book
never puts the panel back.

`b2b` is per shopper, not per shop, because B2B access is per account. Gating it
on "the shop has any B2B account" would tell every retail customer to call their
rep the moment one wholesale account exists, which is the same defect facing the
other way. There is a test for that.

**Defaults to nothing on offer.** `NO_OFFERS` is the value until the read
answers, so a slow or failed request hides the panels rather than advertising
them — an unanswered question is not a yes.

**Deliberately left alone:**

- **Returns** — already unconditional, and the file says why: "a return she
  cannot start herself becomes an email to the shop."
- **Requests** — the customer support portal. Every shop has customers who need
  to ask something.
- **Estimates** — any shop may be asked to quote for work, and for a maker doing
  custom runs that is a real thing to want. Offering it is a decision rather than
  an accident, so it stays until somebody decides otherwise.

The pages themselves stay reachable by URL and keep their honest empty states.
Hiding a link is not the same as removing a route, and the empty states are good.

## Confirmed by

`account-offers.test.ts`, three tests against a real database, and the middle one
is the load-bearing one: a service is created bookable (panel appears), taken off
online booking (panel goes), then deactivated (panel stays gone) — all with
`scheduling` enabled throughout, which is exactly what a module flag would have
got wrong.

Proved red first: with the gate replaced by `{ bookings: true, b2b: true }` all
three fail. Restored, all three pass, and `api-rest` is **431 tests across 76
files**.

Then on screen as Marguerite: the sidebar now reads Overview, Orders, Returns,
Estimates, Requests, Wishlist, Addresses, Payment methods, Profile, Sign out. Her
four orders still list, with their amounts and statuses unchanged.

## RULE #7 — it must not break an earlier business

`wizeworks/apps/site` serves every tenant, so the gate was run against the real
rows of three of them:

| Business                    | Bookings panel                   | B2B panel           |
| --------------------------- | -------------------------------- | ------------------- |
| Halo & Hem (P02, salon)     | **stays** — 21 bookable services | none of 13 shoppers |
| Thistle & Rye (P01, bakery) | **stays** — 3 bookable services  | **1 of 4 shoppers** |
| Juniper Row (P03)           | hidden — 0                       | none of 35 shoppers |

Thistle & Rye is the case that argues the design: one of Marisol's four
customers genuinely is a B2B account, and the per-shopper gate keeps the panel
for that one while removing it from the other three. A per-SHOP gate would have
told all four to call their rep.

Checked against the rows rather than by driving P02's storefront, which needs a
shopper credential on that tenant that I do not hold and would not enter.

## Rating effect

Against the P03 site's account area. Scored for the first time here — this run's
standing check for the buyer's side past the sale.
