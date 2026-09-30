# 846 — The total went backwards when she did

**Status:** fixed
**Severity:** the wrong number on the screen where the number is the whole point
**Found by:** P03 · Juniper Row · act 292, as the shopper
**Surface:** Cart to checkout to order, on the tenant site
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** six real orders placed end to end, at 1280px and at 390px

## The shape of it

Marguerite buys a tee. Three steps: her details, where it goes, how she pays.

On step two she picks the one delivery on offer:

> **Delivery · 4 days** $9.00 ◉

The panel beside it, the one that exists to say what this costs:

> Shipping **Once we know where**
> Total so far **$42.00**

We know where. She just said. The price is ticked, in her eye line, nine
dollars. The summary went on saying it did not know.

Step three finally added it up: **$51.00**. Then she pressed **← Back** to
change the address, and the total dropped to **$42.00** again, with the $9.00
delivery still selected on the same screen.

**The number went backwards when she did.**

On a phone it is worse, because at 390px the summary moves to the TOP: the
stale total is the first thing read, above the price it is ignoring.

## Why

`checkout-flow.tsx` has one flag for two questions:

```ts
const settled = collectionOnly || step === 'payment' || step === 'done';
```

That flag protects something real, and `order-summary.tsx` says so at length:

> Zero shipping is two different answers: "this delivery is free" and "nobody
> has chosen a delivery yet". Printing the second as Free told a shopper her
> $128 order cost $128 on two screens, and $137 on the third.

That is issue 206, and the reasoning is right: the checkout session opens on
mount and its totals go stale, so its zero must never print as Free.

But the flag was then asked a second question it cannot answer — _do we know
what delivery costs?_ — and it said no while the answer was ticked on screen.
The chosen rate carries `amountCents`. The summary was never given it.

The failure the old comment describes is the failure that came back: two screens
saying one number and the third saying another.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## The fix

The two questions are now two functions, in `summary-lines.ts`, where they can
be proved:

```ts
export function shippingLine(input: ShippingInput): ShippingLine {
  const cents = input.settled ? input.settledShippingCents : input.chosenShippingCents;
  if (cents === null) return { kind: 'unknown' };
  return cents > 0 ? { kind: 'amount', cents } : { kind: 'free' };
}
```

`null` is still "nobody has chosen", and still prints "Once we know where". A
chosen zero is Free, because somebody chose it. Once the step is submitted the
session wins, exactly as before.

**Proved red before it was believed.** Reverting to the old behavior fails
three of the eight tests and leaves five green — the five that hold issue 206's
rule. [[feedback_a_test_that_cannot_go_red]]

```
 × prices a delivery the shopper has picked but not yet submitted
 × calls a chosen zero Free, because somebody chose it
 × adds a chosen delivery to a total that does not carry it yet
 Tests  3 failed | 5 passed (8)
```

**Walked after:** pick the delivery, summary reads **Shipping $9.00 · Total so
far $51.00**. Go on to payment: **$51.00**. Press Back: **$51.00**. It no longer
moves.

## Four more, found on the same walk

### Her usual address printed itself twice and lost her name

```
◉ 1184 SE Ash St, Portland OR 97214 · your usual one
  1184 SE Ash St, Portland OR 97214
○ Marguerite Adeyemi
  2201 Blake Street, Denver CO 80205
```

The first row is the DEFAULT one, the one already selected, the one most people
will never look past. Its top line is meant to be who the parcel is for. It fell
through to the address, which the line below already says.

```
{a.label ?? a.recipientName ?? describeAddress(a)}
```

The name was in the file the whole time: `toCheckoutAddress`, two functions up,
already falls back to the contact name for exactly this.
[[feedback_fetched_but_never_rendered]] It is passed in now, and the address is
never the title.

```
◉ Marguerite Adeyemi · your usual one
  1184 SE Ash St, Portland OR 97214
```

### The one word telling those rows apart was in nobody's ears

Each row carried `aria-label={`Send it to ${describeAddress(a)}`}` on its
`<label>`, with a comment explaining the intent. An `aria-label` REPLACES the
contents, so the accessible name was the street and **"your usual one" was not
in it** — the single fact that distinguishes the row she wants from the two she
does not. The same shape as the rail badge in issue 839.

Gone. The `<fieldset>` legend already says "Send it to one of your addresses",
so the contents are the name, and now they contain everything on the screen.

### The phone field was named with a whole sentence

```
input type=tel
accessible name: "Phone (optional) So we can reach you if there is a question
                  about your order."
```

The help text sat inside the `<label>`. It is `aria-describedby` now, so the
field is called **Phone (optional)** and the sentence is a note, which is what
it is.

### The last screen anybody reads carried almost nothing

The confirmation was a heading, an order number and **Continue shopping**. Not
what she bought, not what it cost, not where it was going, and no way to look at
the order.

On a shop that takes money in person, its own copy admits no email is coming:

> Keep this order number: we'll be in touch about paying.

So the number on that screen was the entire record of the sale, and the screen
did not say what the sale was.

`placeOrder` has always returned `{ orderId, orderNumber }`. Checkout kept the
number and dropped the id one line later — the id being the link to the order
page that already exists and was scored at 8 in this file.
[[feedback_fetched_but_never_rendered]]

**Read off the screen now**, at 390px:

```
🎉 Order confirmed
Thank you! Your order O-000026 has been placed. Keep this order number: we'll
be in touch about paying.

Order summary
1  The Everyday Tee · L · Clay      $42.00
Subtotal                            $42.00
Shipping                             $9.00
Total                               $51.00

Coming by: Delivery · about 4 days
Going to: Marguerite Adeyemi, 1184 SE Ash St, Portland OR 97214

[ See your order ]  [ Continue shopping ]
```

It is the same `<OrderSummary>` that stood beside all four steps, so the last
screen agrees with the four before it rather than being written twice. **See
your order** lands on the real order, checked: status timeline, the same
$126/$9/$135 on the order I placed with three of them in it.

### An empty cart got a checkout with no way out

Opening `/checkout` with nothing in the basket gave the whole three-step form,
a **$0.00** total, and a submit button reading **Saving…** — disabled, with no
message, forever. The session it waits for cannot be opened without a cart.

```ts
const cartReady = cart.cartId !== null;
const cartEmpty = cartReady && cart.lines.length === 0;
```

`cartId === null` is two facts wearing one face: _this shopper has no cart_ and
_we have not looked yet_. Checkout read it as the second and waited.
[[feedback_absent_behaves_like_fine]]

The cart now says out loud that it has looked (`known`), and nothing stored is
an answer rather than a gap. **Measured:** `/checkout` with an empty basket is
the "Your cart is empty" screen with a **Shop all products** button. With one
item it is the form, as before, with no flash of the empty screen in between.

## What it gets right

Measured, because most of this checkout is good and the good parts are the
reason the bad number stood out.

|                       |                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **The copy**          | "Once we know where" for a line it cannot know; "Placing this order does not take any money now, and no card details are needed" |
| **The pay button**    | says the amount: **Place order: $51.00 to pay**                                                                                  |
| **Prefill**           | name, email and phone arrive filled from the signed-in shopper, with real `autocomplete` on all three                            |
| **The email promise** | conditional on the shop actually sending one, with forty lines saying why                                                        |
| **390px**             | no sideways scroll on any of the four screens; the summary moves ABOVE the form, so she sees what she is buying before typing    |
| **Sold out**          | six tees later, `M · Black` is a disabled radio labelled **"M · Black, sold out"** rather than a grey box                        |

## The one I nearly filed

The first reading of this act was `/checkout` showing a **$0.00** total with a
cart the `/cart` page also called empty. Two screens agreeing. The cart had one
tee in it the whole time: both readings came from a cached page, and a fresh
query string showed $42.00.

That is the sixth reading this session that looked like a defect and was an
artifact of how it was taken. [[feedback_no_arguing_without_proof]] The empty-cart
defect above is real, but it is a different one, and I found it later by
emptying the basket for real.

## Measured, not swept

- Checkout calls the rate **Delivery**; the order page calls the same rate
  **Standard Delivery**. One shipping method, two names, on two screens a
  shopper sees ten seconds apart.
- The "Email me with news and offers" row is a 327 × 24px tap target at 390px.
  That clears WCAG 2.5.8 at 24px and is under the 44px this platform's own
  console sets for itself.
- `← Back` is 85 × 40px on both middle steps. Same note.
- `order-summary.tsx` carried eight inline `style` props for layout. They are
  Tailwind utilities now, since the file was open, and the page's own two went
  with them.

## Files

- `wizeworks/apps/site/components/checkout/summary-lines.ts` (new)
- `wizeworks/apps/site/components/checkout/summary-lines.test.ts` (new)
- `wizeworks/apps/site/components/checkout/order-summary.tsx`
- `wizeworks/apps/site/components/checkout/checkout-flow.tsx`
- `wizeworks/apps/site/components/checkout/checkout-chrome.tsx`
- `wizeworks/apps/site/components/checkout/saved-addresses.tsx`
- `wizeworks/apps/site/components/checkout/delivery-step.tsx`
- `wizeworks/apps/site/components/checkout/contact-step.tsx`
- `wizeworks/apps/site/components/checkout/payment-step.tsx`
- `wizeworks/apps/site/components/cart-provider.tsx`
- `wizeworks/apps/site/app/checkout/page.tsx`

## The thing to remember

**A flag that protects one thing gets asked about a second thing and answers
anyway.** `settled` was built to stop a stale zero reading as Free, and it did
that job for a year. Then the summary asked it "do we know the delivery yet",
which is a different question with a different answer, and it said no with total
confidence while the answer sat ticked on the same screen.
