# 874 — The Notes on an order could never be written

**Status:** fixed
**Severity:** **major** — the order pane has a **Notes** section that prints two
headings, "From the customer" and "Your team's note". Nothing on the platform
could write either one. Not the console, not the till, not checkout, not a
channel import. The section rendered nothing at all while both were empty, and
both were empty on every order ever placed
**Found by:** P03 · act 310, opening Money by data weight
**Surface:** mypiggles › Sell › Orders › an order, in both consoles, and the
shopper's own checkout
**Filed:** 2026-09-29
**Fixed:** 2026-09-29
**Confirmed by:** 5 tests, proved red on two plausible wrong rules; typecheck and
every suite green

## Measured

```
orders on the platform                    122
of those, with an internal note             0
of those, with a customer note              0
Devi's own orders                          26   (0 and 0)
```

Not "rarely used". **Never once, by anybody.**

## The chain

`PATCH /v1/orders/:id` accepts four writable things:

```ts
...(input.customerNote !== undefined ? { customerNote: input.customerNote } : {}),
...(input.internalNote !== undefined ? { internalNote: input.internalNote } : {}),
...(input.shippingAddress !== undefined ? { shippingAddress: ... } : {}),
...(input.billingAddress !== undefined ? { billingAddress: ... } : {}),
```

Two of the four were wired into the console. The note beside them explains why:

> `PATCH /v1/orders/:id` has always taken `shippingAddress` and `billingAddress`.
> The order pane READ them ... and offered no way to fill one in.

The other two are the notes. **Same endpoint, same pane, same sentence, and the
neighbor was left.** [[feedback_a_fix_leaves_its_neighbour_behind]]

This is the fourth time on this one file. `order-actions.ts` is a record of
somebody walking the order endpoints: record a payment, record a handover, put a
tracking number on it, put an address on it. Each carries a paragraph headed
"WHY THIS WAS MISSING AND WHY THAT MATTERED". The notes and the payment void
(issue 875) are the two that were not reached.

## What it costs

**The shop's own note.** A business that takes work over a counter writes things
down: "wants the cuffs shorter, spoke to her Tuesday", "leave it with the
neighbor", "collecting Saturday, not Friday". There was nowhere to put any of it
under a heading saying **Your team's note**.

**The customer's note.** Worse, because the shopper is the only person who knows
it. The published API contract says exactly what the field is:

> `customerNote` — A note from the customer, shown on the order.

Checkout collected no such thing. `ContactBody`, `ShippingBody` and `CompleteBody`
have no note field between them. Neither does the till. Neither does any channel
import. So a heading reading "From the customer" described something no customer
on the platform could ever have said.

The platform already knows the pattern and uses it one module over: the booking
widget asks **"Anything we should know? (optional)"**. Somebody booking a haircut
could say they were allergic to something; somebody buying a cake could not.

The PRD asks for both, by name, in `docs/09-ecommerce-engine-prd.md`:

```
### Order Notes & Tags
- Internal notes (staff only)
- Customer-visible notes
```

## What it does now

**On the order pane, in both consoles**, the Notes section always renders. The
customer's note prints when there is one. The shop's note is a box with one Save,
last write wins, and an unsaved note registers the leave-guard:

```
Your team’s note
[ Anything about this order the people packing it should know.        ]
Only your team sees this. It is not on the receipt, the invoice, or
anything else the customer gets.
```

That last sentence was checked before it was written. `internalNote` is read by
nothing outside the two consoles: no email template, no invoice renderer, no
packing slip, and the customer's own order page picks its fields by hand and does
not include it. [[feedback_a_promise_in_copy_is_a_contract]]

**Only one of the two is a box.** The shop's note is hers to write. The customer's
note is a record of what somebody SAID, and a box beside it would be a box for
editing what a customer told her.

**At checkout**, on both the delivery and the collection step:

```
Anything we should know? (optional)
[ Where to leave it, a gift message, anything else.                   ]
```

## Why the note is stored before payment, not after

The obvious build is to collect it on the last step and send it with the order.
That loses it for a whole class of shop. A hosted-redirect gateway navigates the
tab away:

```ts
window.location.href = intent.redirectUrl;
```

Everything held in the page goes with it. A box that asks "anything we should
know?" and then silently drops the answer for some shops' payment providers is
worse than no box, so it rides `submitShipping` and lands on the checkout session
before anybody is sent anywhere. That needed one nullable column,
`commerce_checkout_sessions.customer_note`.

## Three states, not two

The rule that carries the note is small and easy to get wrong, so it is its own
tested function rather than an expression inside a Prisma `data`:

```ts
export function noteWrite(sent: string | undefined): { customerNote?: string | null } {
  if (sent === undefined) return {};
  return { customerNote: sent.trim() || null };
}
```

- **absent** — an older storefront, the B2B portal, an integration. Not talking
  about notes, so leave whatever is stored alone.
- **empty** — somebody selected the text and deleted it. That is an answer, and
  it clears the note. The tidy version of this, `if (!sent) return {}`, reads a
  cleared box as "not mentioned" and **makes the box impossible to empty**.
- **text** — store it, trimmed. Two spaces is an empty box, and storing the
  spaces prints a blank line on the order under a heading saying the customer
  said something.

## Proved

**5 tests**, proved red on the two plausible wrong rules:

```
gate on falsy instead of undefined  →  1 of 5 fails ("clears the note when the box is emptied")
drop the trim                       →  2 of 5 fail
```

**Checks:** typecheck 0 on `@wizeworks/commerce`, `@wizeworks/commerce-schemas`,
api-rest, the tenant site and both workbenches. Tests: piggles workbench 162
files / 1512, sparx 133 / 1221, commerce 25 / 246, api-rest 34 / 272.
`check:console-parity` green, now pairing 1,239 interfaces.
`order-notes.tsx` is byte-identical in both consoles.

**Driven end to end on her own screens**, once her console was back up.

The shop's half: the box takes typing, the pane tab shows the unsaved dot and the
status bar says **Not saved: Order O-000018** while it is dirty, Save clears both
and reports **Saved just now**, and `orders.internal_note` holds the text. At
360px, set on the pane rather than by resizing anything, the label, box and the
three-line description all fit with no overflow.

The shopper's half, on the real storefront at Juniper Row: added The Ash Overshirt
to a cart, filled in the delivery step, typed _"Please leave it with Ines at number
12 if I am out. It is a birthday present, so no receipt in the box."_, and pressed
**Continue to payment**. The note was on
`commerce_checkout_sessions.customer_note` at that point, **before the payment step
was ever shown**, which is the property the whole design turns on. Placing the
order carried it to `orders.customer_note`, and the order pane now prints it under
**From the customer** — the first time that heading has rendered on this platform.

## Files

- `wizeworks/packages/db/prisma/schema/40-commerce-checkout.prisma` — the column
- `wizeworks/packages/db/prisma/migrations/20270522000000_a_shopper_can_say_something_about_their_order/`
- `wizeworks/packages/commerce/src/services/checkout-note.ts` (new) + its test
- `wizeworks/packages/commerce/src/services/checkout-service.ts` — stores it,
  then carries it onto the order
- `wizeworks/packages/commerce-schemas/src/checkout.ts` — `SubmitShippingInput`
- `wizeworks/services/api-rest/src/routes/v1/public/checkout.ts` — `ShippingBody`
- `wizeworks/apps/site/lib/checkout-client.ts`,
  `components/checkout/{checkout-flow,delivery-step,collection-step}.tsx`
- `{piggles,sparx}/apps/workbench/surfaces/commerce/order-notes.tsx` (new, identical)
- `piggles/apps/workbench/surfaces/commerce/{order-actions,order-detail-risk,order-detail-body}.tsx`
- `sparx/apps/workbench/surfaces/commerce/{data.ts,order-detail.tsx}`

## A second thing the move fixed

The Notes section used to be the last block before **Refund this order** and
**Cancel order**. That was harmless while it could never render. The moment it
became a box somebody types in, it put a Save button directly on top of the two
most irreversible controls on the pane, so it moved up to read with what was
bought and where it goes, which is what it is about.

## The thing to remember

**A section that renders nothing when its data is empty cannot tell you its data
can never be filled.** `OrderNotes` returned `null` when both notes were absent,
which is ordinarily the right call: an empty "Notes — none" card on every healthy
order trains people to skip it. Here that same kindness meant the section had
never appeared on a screen in the platform's life, so nobody ever stood in front
of the question "how do I write one of these?"

The measurement that finds this shape is not "does the screen look right" but
**"how many rows in this column are filled, and what would fill one?"**
