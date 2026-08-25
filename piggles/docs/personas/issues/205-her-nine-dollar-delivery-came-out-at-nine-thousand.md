# 205 — Her $9 delivery came out at nine thousand

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 5
**Surface:** mypiggles › Sell › Postage and delivery › a region › a delivery option — and every money field in the console
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, on screen

## What happened

Setting up the one thing her shop needs to charge for postage — flat $9, free over
$150 — Devi clicked into **Price** and typed `9.00`:

```
Price                          9.000.00
What the shopper pays on a normal order.
```

The box was not empty. It held a real `0.00`, indistinguishable from a hint, and
the caret landed in front of it.

**This is issue [169](169-her-128-dollar-overshirt-came-out-at-128000.md), again,
four acts later, on a different screen.** There it turned a $128 overshirt into
$128,000. Here it is the delivery charge every shopper pays.

## Why it matters

[169] was closed by making the product form's price box start blank. That fixed
the product form. Nobody swept the rest, and the same trap sat in **the shared
money field itself** — the one whose own comment reads _"THE money field.
Anywhere a person types an amount, this is what they type into."_

So it was not one more instance. It was every amount in the console that opens at
zero: a delivery price, a free-shipping threshold, a weight band, an amount per
item. Two of them are on this one form, side by side.

And the failure is quiet. `9.000.00` looks like a number. A shop owner in a hurry
sees a price, saves, and finds out when a customer does.

## Where it lives

[money-input.tsx](../../../apps/workbench/components/money-input.tsx).
`MoneyInput` seeds its text from the value it is handed:

```ts
const [text, setText] = useState(() => value.toFixed(2));
```

A new delivery option starts at `0`, so the box opens holding the four characters
`0.00` — real content, not a placeholder. Clicking puts the caret where you
clicked; typing inserts.

[169]'s fix took the other route: `MoneyTextInput`, a field that owns its own text
and can be genuinely empty, used where "nobody has said yet" is a real answer.
Four surfaces adopted it. The shipping editor did not, and neither did anything
else built on `MoneyInput`.

## The fix

**Focusing a money field selects what is in it**, so typing replaces rather than
inserts:

```tsx
onFocus={(event) => {
  setEditing(true);
  event.target.select();
}}
```

Three lines, in the one shared field, and every amount in the console is defended
at once — including ones nobody has walked yet. It changes nothing about what a
value MEANS, so zero still means free where free is a real answer, and
`MoneyTextInput` stays the right choice where blank must be distinguishable from
zero.

Select-on-focus is also how a person expects a formatted number to behave: click
the price, type the new price. Editing part of an amount now takes a second click,
which is the correct trade against a delivery charge a thousand times over.

## What it looked like once fixed

The same form, the same two boxes, both opening at `0.00`:

```
Price                        9.00      ← typed into an emptied box
Free once the order reaches  150.00    ← CLICKED and typed straight over "0.00"
```

The second one is the proof: it still held `0.00` when I clicked it, and typing
`150.00` replaced it. Saved as **Delivery — $9.00, free over $150.00 · arrives in
about 4 days**.

## Rating effect

`Sell › Postage and delivery` in [rating.md](../rating.md), and every pane with an
amount on it.
