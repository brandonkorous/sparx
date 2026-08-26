# 216 — The follow-up list would not say who to follow up

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 6
**Surface:** mypiggles › Sell › Baskets left behind — the list and the basket pane
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 6, on screen

## What happened

A shopper put a $145 Linen Shirtdress in her basket, went to checkout, typed her
name, her email address, pressed **Continue to delivery** — and then closed the
tab.

Devi opened the screen built for exactly that:

```
Baskets left behind          [ In progress ] [ Walked away ] [ Came back ]

Shopper          Items   Last active               State         Value
Guest shopper      1     Aug 25, 2026, 4:05 PM     In progress   $145.00
Guest shopper      1     Aug 25, 2026, 3:05 AM     In progress   $192.00
Guest shopper      1     Aug 25, 2026, 2:54 AM     In progress   $128.00
Guest shopper      2     Aug 24, 2026, 11:30 PM    In progress   $192.00
```

Four baskets, $657 between them, and one name repeated four times. She opened the
$145 one to find out more:

```
Whose cart it is
A guest — this cart was filled by someone who was not signed in, so there is
no account attached to it.
```

The row in the database, at that moment:

```
customer_name   Priya Menon
customer_email  priya.menon@example.com
step            contact
```

## What should have happened

The screen says who to chase.

## Why it matters

**This is the entire purpose of the surface.** Its own empty state promises it:
_"When a shopper fills a cart and leaves without paying, it lands here so you can
follow it up."_ You cannot follow up a Guest shopper. A list of anonymous amounts
is not a worklist, it is a scoreboard for money you already lost.

For Devi it is 340 orders a year. A $145 basket with a name and an email on it is
one polite email away from being a sale, and the platform had both and would not
say either.

The sentence on the detail pane is the part worth dwelling on, because **it is
not false**. She genuinely was not signed in; there genuinely is no account. It
answers "is there a customer record?" — a true statement about the database — when
the question a person opening that pane is asking is "who do I email?" A screen
can be accurate and still refuse to do its job, and this is what that looks like.

And it is the pattern this run keeps re-finding, at its cleanest: **the value was
already stored, one join from the row the screen was reading.** Nobody had to
build anything. The query simply asked the wrong table.

## Where it lives

A `Cart` has a `customer` relation, and it means **a signed-in shopper**. Most
shoppers are not. What a guest types at checkout lives on `CheckoutSession`,
which has carried `customerName` since [064] — put there for precisely this kind
of reason:

> Who is buying. Asked for on the CONTACT step, because it is the one thing every
> order needs however it leaves.

The carts inbox
([lists.ts](../../../../wizeworks/services/api-rest/src/routes/v1/commerce/lists.ts))
joined only the account:

```ts
customer: {
  select: { id: true, firstName: true, lastName: true, email: true, companyName: true },
},
```

and the detail endpoint
([carts.ts](../../../../wizeworks/services/api-rest/src/routes/v1/commerce/carts.ts))
returned the storefront's cart snapshot, whose `customerName` is the same
signed-in shopper's. So both ends of the surface asked the one question that is
`null` for the majority of the rows they list.

The console then did the honest thing with the nothing it was given —
`cartShopperName()` already had a `fallbackName` parameter, and the detail pane
already passed one. It was passing the field that is always null for a guest.

## The fix

**Read the contact off the checkout session, on the list as well as the detail.**

A new [cart-contact.ts](../../../../wizeworks/services/api-rest/src/routes/v1/commerce/cart-contact.ts)
returns the name, email, phone, and how far the shopper got, choosing the
FURTHEST session a basket has rather than merely the newest — a reload opens a
second session, and the one that stopped early is usually the later of the pair.
One query per page, never one per row.

Both endpoints now carry `contact`, and three screens use it:

- **The list's Shopper column** shows the person. "Guest shopper" is gone; a
  basket nobody left anything on reads **"Nobody left a name"**, which is a fact
  about the basket rather than a label for the shopper.
- **The pane's tab** is titled with them, so an open basket is identifiable in
  the dock.
- **"Whose basket it is"** shows the name, the email as a `mailto:` link, the
  phone if there is one, and one line saying how far they got — _"They had typed
  their details and stopped there."_ How close somebody came is part of deciding
  whether to chase them.

The "not signed in" fact is still said, because it is true and it explains why
there is no customer record to open — it just stops being the whole answer.

**Also fixed on the way past:** the pane's fact line read **"1 lines"**. Same
family as the "Express · 1 days" caught in [185].

**RULE #0.5, applied to what was touched:** `cart-detail.tsx` was 290 lines
before this and would have grown. Its lines-and-totals block came out to
[cart-lines.tsx](../../../../piggles/apps/workbench/surfaces/commerce/cart-lines.tsx)
and the shopper block to
[cart-shopper.tsx](../../../../piggles/apps/workbench/surfaces/commerce/cart-shopper.tsx),
leaving it at 195.

## What it looked like once fixed

```
Shopper                  Items   Last active               State         Value
Priya Menon                1     Aug 25, 2026, 4:05 PM     In progress   $145.00
Anneliese Van der Berg     1     Aug 25, 2026, 3:05 AM     In progress   $192.00
Anneliese Van der Berg     1     Aug 25, 2026, 2:54 AM     In progress   $128.00
Nobody left a name         2     Aug 24, 2026, 11:30 PM    In progress   $192.00
```

Three real people and one honest blank, from four identical "Guest shopper" rows
— and the fourth is correct: that basket's session carries no name.

The pane, tab titled **Priya Menon · basket**:

```
Your website · 1 line

Whose basket it is
Priya Menon
Email  priya.menon@example.com
They were not signed in, so there is no account behind this — but they gave
you this much at checkout.
They had typed their details and stopped there.
```

## Not checked

Whether a basket ever reaches the **Walked away** tab. Priya's is 20 minutes old
against a 120-minute abandonment window, and marking it abandoned is a worker's
job, not a screen's — so the tab this issue is really about was empty throughout
and the fix was proved on **In progress** instead. The rows are the same rows and
the same component draws both, but the abandoned path itself is **not checked**.

## Rating effect

`Sell › Baskets left behind` in [rating.md](../rating.md) — the pane could not
name the person it exists to help her contact. Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
