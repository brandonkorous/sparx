# 794 — "It fits every apparel sizes"

**Status:** fixed
**Severity:** low
**Found by:** P03 · Juniper Row · act 279
**Surface:** mypiggles + sparx workbench — `commerce.product.fitment`
**Filed:** 2026-09-23
**Blocked on:** —

## What happened

Devi opened **What it fits** on the Silk twill scarf, pressed "Add what it fits"
and got a button written in broken English:

```
Add what this fits

  Apparel sizes
  [ ↙  It fits every apparel sizes ]
```

She pressed it anyway, and the same three words came back twice more:

```
toast   Now fits Every apparel sizes
row     Every apparel sizes
```

## Why

Two places built the phrase the same way:

```ts
`Every ${(domain?.displayName ?? 'thing').toLowerCase()}`;
```

The list's name is the TENANT's — she named it "Apparel sizes" — so it may be
singular or plural and nothing in the console may bend it into a grammatical
slot. "Every vehicle" reads; "every apparel sizes" does not, and the shop that
names its list "Machines" gets the same.

## What was done

`ruleTitle` stopped inflecting the name and says **"Everything in <Name>"**,
which reads correctly whichever way the list was named and leaves the name
exactly as it was typed. It takes a position so one function serves both the
start of a sentence and the middle of one, and the button, the toast, the saved
row, the confirm and the two accessible labels all read from it.

```
button   It fits everything in Apparel sizes
toast    Now fits everything in Apparel sizes
row      Everything in Apparel sizes
confirm  Stop saying this fits everything in Apparel sizes?
```

## Two more on the same dialog

**"Where you are" was drawn as a disabled button.** The breadcrumb's current
step rendered greyed-out and unclickable, which is how this console draws
something you MAY NOT USE — and at the top of the dialog it is the only line
naming the list you are choosing from. It is text now; the steps you can go back
to are still buttons. (Two `color="neutral"` call sites went with it.)

**The note field's example was a car part.** Under a list of apparel sizes the
placeholder read "Only with the heavy-duty bracket", and its help line called it
"a caveat". Now "Check the measurement first", and "Anything you want to
remember about this match. Kept with it, for you, and never shown to shoppers."

## Files

- `piggles|sparx/apps/workbench/surfaces/commerce/product-fitment.tsx`
