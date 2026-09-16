# 520 — A box on her own counter would have said it was on the way

**Status:** fixed and proven
**Severity:** minor (latent: 0 orders in that state today, reachable by every shop that collects)
**Found by:** Devi, filtering her orders list by Delivered
**Surface:** `order-tone.ts` (piggles) and `commerce/data.ts` (sparx) — `shippingState`
**Filed:** 2026-09-15

## What she was doing

Her orders list has a chip bar: All / Not paid / To send / On the way / Delivered
/ Cancelled. She clicked **Delivered** and got three orders, every one of them
marked **Collected**.

That is correct. Juniper Row's three finished orders were all picked up in
person, and the badge says so on purpose — issue 215 fixed "Collected" being
printed on orders going in the post, so the console asks each order which of the
two it was.

Looking at where that question is asked found a branch where it is not.

## The defect

`shippingState` turns a stored status into the word an owner reads. Three of its
five branches can be reached by an order the customer collects, and only two of
them asked:

| stored status | asked "collected?" | posted     | collected  |
| ------------- | ------------------ | ---------- | ---------- |
| `placed`      | yes                | To send    | To collect |
| `fulfilled`   | **no**             | On the way | On the way |
| `delivered`   | yes                | Delivered  | Collected  |

`fulfilled` means every item has been picked and packed. For something going in
the post that means it is with the carrier. For something being collected it
means it is **on the shop's own counter**, waiting.

The console would have said **On the way**, and underneath it, in the sentence a
person reads when they stop:

> This order has been sent and is with the carrier.

Nothing had been sent. There is no carrier. An owner reading that line would
have told a customer on the phone that their order was in transit, about a box
three feet away from her.

## Why nobody had seen it

**No order is in that state today.** Across the whole platform: 39 delivered
orders (6 collected), 23 placed (2 collected), and **30 fulfilled, none of them
collected**. So the wrong sentence has never yet been rendered.

It is not unreachable, though. A collection goes through the same packing
machinery as anything else — `pack-fulfillment` promotes an order to `fulfilled`
when every item is packed, and it does not care how the customer is getting it.
The first shop to pack a collection before the customer walks in gets the wrong
sentence.

And it is the shape that keeps happening here: **a fix applied to the branches
somebody was looking at.** The comment above this very function says it is "the
one place both the list and the order pane read it from, so correcting it here
corrects it everywhere rather than in the two call sites that happened to
notice" — which is exactly right, and it was still corrected in two branches out
of three.

## What changed

```ts
case 'fulfilled':
  return {
    label: collected ? 'Ready to collect' : 'On the way',
    tone: 'info',
    detail: collected
      ? 'This order is packed and waiting for the customer to come and get it.'
      : 'This order has been sent and is with the carrier.',
  };
```

Both trees. `sparx/apps/workbench/surfaces/commerce/data.ts` held its own copy of
the same function with the same gap.

## Proven

`order-tone.test.ts` — ten guards, and deliberately **one per branch** rather
than one for the case that was found, because a branch nobody wrote a test for
is how this happened. Putting the defect back reddens exactly two:

```
expected 'On the way' to be 'Ready to collect'
expected 'This order has been sent and is with …' not to match /carrier|sent to|in transit/i
```

The third guard per branch asserts that no collected order's detail sentence
mentions a carrier at all, so the next branch added to this function has to
answer the question before it can pass.

## Left alone, on purpose

The chip bar still reads **Delivered** over rows that read **Collected**, and
**To send** over rows that would read **To collect**. Measured: on every shop
where this happens it is total, never partial — juniper-row 3 of 3,
halo-and-hem 2 of 2, quiet-haven 1 of 1 delivered and 2 of 2 placed. The chip's
own word appears on none of the rows it returns.

That is a wording mismatch and not a falsehood: the chip names a filter
category, the badge states a fact about one order, and a collected order did
reach the customer. Every covering word tried for it either loses the meaning
that makes the chip useful ("Ready" for a parcel already in transit) or widens a
bar that this file's own comment protects on purpose ("a sixth chip costs every
operator a wider bar forever"). It is a voice decision with a real trade-off
rather than a defect, so it is recorded here with the measurement instead of
being renamed on my own judgment.
