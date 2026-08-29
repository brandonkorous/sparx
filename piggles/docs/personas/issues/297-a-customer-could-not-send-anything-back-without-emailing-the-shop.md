# 297 — A customer could not send anything back without emailing the shop

**Status:** fixed
**Severity:** major (the whole of a fifth of this business's orders ran through
the owner's inbox; the model was built for the other way round and no screen
offered it)
**Found by:** P03 · Juniper Row · standing check "Buyer's side", then raised as
scope by Brandon
**Surface:** the tenant site — **Account › Returns**, and **Account › Orders ›
Order › Return or exchange**
**Filed:** 2026-08-27
**Fixed:** 2026-08-27
**Confirmed by:** Two customers started returns themselves; both landed in Devi's
console as "Needs a decision" and she approved one

## What happened

Working the "Buyer's side" standing check, I could find no way for a shopper to
send anything back. The account area offers Orders, Estimates, Bookings,
Requests, Wishlist, Addresses, Payment methods, Profile and B2B Account. It does
not offer Returns, and an order page offers no action at all.

The only path was **Requests › "Ask for help"**, which is a free-text message to
the shop.

**Returns are 22% of Juniper Row's orders.** So for something close to a quarter
of everything Devi sells, the process was: the customer writes, Devi reads it,
Devi types it into the console herself. That is the "three messages back and
forth" she named as one of her three reasons for moving to this platform.

## What should have happened

The customer starts the return herself, from the order it came on, and both
sides can see where it has got to.

**This was not a missing feature so much as a missing door.** The data model was
built for it and says so in its first line:

> Returns / RMA — **customer-initiated** or staff-initiated, with inspection +
> restock decision per line item.

`commerce_return_requests.requested_by` takes `'customer'`, the create service
accepts it, and it already writes `actorType: 'customer'` to the audit log. Rows
with `requested_by = 'customer'` were already in the database. Everything existed
except the screens and the endpoints a shopper could reach.

## How to reproduce

Before the fix, every time:

1. Sign in on Juniper Row's site as any customer with a delivered order.
2. Open **Account › Orders** and any order.
3. There is nothing to click, and no Returns entry in the account menu.

## Why it matters

It is the single largest gap the buyer's-side check found, and it is the one
Devi would feel every week rather than once. It also puts the shop in the way of
its own data: a return that arrives as an email has to be re-typed, which is
where wrong quantities and missing reasons come from.

## Where it lives

- `wizeworks/apps/site/app/account/(authed)/` — ten sections, none of them returns.
- `wizeworks/services/api-rest/src/routes/v1/public/account.ts` — the public
  account API covered orders, addresses and wishlist. No returns.
- [wizeworks/packages/commerce/src/services/return-service.ts](../../../../wizeworks/packages/commerce/src/services/return-service.ts)
  — `create` already took `requestedBy: 'customer'`. Nothing public called it.

## The fix

Built as a whole surface, and **seeded so no tenant has to think of it** — which
is the part that matters, because a shop that has to build its own returns flow
will not have one.

### What a shopper can now do

| Screen                             | What it does                                                            |
| ---------------------------------- | ----------------------------------------------------------------------- |
| **Order › Return or exchange**     | Pick lines, quantities, a reason each, refund or swap, an optional note |
| **Account › Returns**              | Every request, newest first, led by whose move it is                    |
| **Account › Returns › one return** | Where it has got to, what is on it, what came back                      |

Four public endpoints back them (`returns-account.ts`), every one ownership-
checked against the session's customer, answering **404 rather than 403** for
someone else's record so no endpoint can be used to discover that another
customer's return exists.

### Three decisions worth naming

**Eligibility is facts only, never a policy I invented.** `returnService.returnability()`
is the single point of change for "can this be sent back", so the shopper's
screen and the shop's console can never disagree. It answers from what was
bought, what is already spoken for by a live return, and whether the parcel has
actually left. It applies **no time limit**: nothing in the schema records a
returns window, and inventing one here would print a deadline no tenant ever set.
The tenant's own Return Policy page states their rule, and they approve or deny.

**The shopper's view is an explicit projection, not the console's record.**
`returnService.get()` answers with the shop's working notes — inspection
conditions, whether a line was judged restockable, which warehouse it went to,
what the return label cost. None of that is hers. Two deliberate inclusions:
`restockingFeeCents`, because it is money out of her refund, and the staff note
**only on a declined return**, where `deny` writes the reason into it — a refusal
with no reason leaves her with nothing to do next.

**The shop is told.** `return.requested` was published and **nothing consumed
it** — it was not even in the automation resolver's `RETURN_EVENTS`, so no rule
could fire on it. Self-service makes that worse, not better: the request now
arrives with no email attached, so without an alert it lands silently in a screen
nobody has a reason to open. `return.requested` is now resolvable and a new
system seed, **"Return requested — staff alert"**, ships active with Commerce.

### Seeded, so a tenant gets it without doing anything

- The account area is app-routed, so **Returns appears for every tenant** with no
  authoring — that is what makes this "pre-built" rather than "possible".
- `siteFooter()` seeds a **Returns** link in the Account column for new sites.
- `upgradeFrameChrome` adds it for everyone already published, cloned from the
  Orders link so it wears that column's styling, inserted as a sibling list item
  rather than a second link inside an existing one, and skipped entirely if the
  tenant already has one.

Also fixed while here: the footer guard `links to NO legal page directly` matched
`returns?` **anywhere** in a path, so `/account/returns` tripped it — a tripwire
firing on the thing it was built to protect. It is anchored to the path root now
and still catches `/returns-policy`.

## Confirmed by

Driven end to end as two real customers on Juniper Row.

**Marguerite Adeyemi**, order #O-000007 (delivered): her order offered **Return or
exchange something**; she picked the Leather-covered belt, "Something is wrong
with it", a refund, and wrote _"The buckle came away from the strap after a
week."_ She landed on the return reading **Waiting for a decision**. The row is
`requested_by = customer`, and the audit log records `actor_type = customer`.

**Jo Kim**, order #O-000005: the form offered **only the Marlow Knit** — the
Everyday Tee was correctly excluded, because the shop had already refunded it.
She asked for a swap and got _"You asked for a swap on August 27, 2026."_

**As Devi**, both appeared at the top of **Sell › Returns** marked **Needs a
decision**, with Marguerite's note reaching her verbatim. She approved the belt,
and Marguerite's page changed to **Approved** with _"Post the items back to us
when you can."_

**The alert fired.** After `reconcile-seeds` (37 commerce tenants), "Return
requested — staff alert" is `active` on her tenant; Jo's request produced a run
that completed on the next tick — `runs: 1, completed: 1, failed: 0`.

**Nothing leaked between customers.** Signed in as Jo, opening Marguerite's return
by its address answered _"We could not find that return. It may have been
removed, or the address may point at something that is not yours."_

**Not a dead end when there is nothing to do.** Anneliese's order, whose lines are
both already spoken for, offers no button, and the address answers _"You have
already asked to send back everything on this order."_ with two ways onward.

**Her footer** now reads **Your account · Orders · Returns · Cart**, healed and
published from her own studio.

### Not checked

Stated plainly rather than assumed (CLAUDE.md RULE #4):

- **The request form's controls at 360px.** The returns list and the return
  detail were both checked at 360 and hold. The form needs an order with
  something still returnable, and by the end of the run every one of hers was
  spoken for.
- **The declined view.** `declinedReason` is built and is the only place the
  shop's reason reaches her, but Devi approved rather than declined — a faulty
  belt is not something she would turn down — so that branch has not been seen.
