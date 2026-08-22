# 043 — Her orders screen showed an email address where the customer's name goes

**Status:** fixed for new customers; existing rows keep what they have (see below)
**Severity:** major (the one field a collection business calls across a counter)
**Found by:** P01 · Thistle & Rye · act 9 — opening **O-000001** behind the counter
**Surface:** mypiggles › Sell › the order pane
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21

## What happened

> **Who bought it**
> rowan.pike@example.test
> rowan.pike@example.test

The email, twice, where a person's name belongs. The shopper had typed **Rowan
Pike** into a REQUIRED "Full name" field two steps before paying — and the order
carries it: the delivery and billing address blocks on the very same screen both
read "Rowan Pike".

## Why it matters

For a bakery taking collection orders, the name is the field. It is what she
writes on the bag and what she calls out over the counter. An email address is
the one thing she cannot shout across a shop.

## Why it happened

`ensureCheckoutCustomer` created the customer from the email alone:

```ts
data: { tenantId, propertyId, email: normalizedEmail, type: 'retail', lifecycleStage: 'customer' }
```

The name went onto the ORDER's address blob and was never carried to the customer
record. The search projection has a fallback chain — name → company → email →
"(no name)" — so it degraded quietly to the email rather than failing, and every
screen that names a customer inherited that.

## The fix

`ensureCheckoutCustomer` takes the typed name and splits it into the two columns
the schema has, **on create only**: an existing customer keeps the name they gave
us, and a one-off delivery addressed to somebody else must not rename them.

`splitName` is deliberately conservative — first token given, remainder family,
a single word stays entirely in `firstName` rather than being invented a surname,
and a blank writes NOTHING. An empty string in those columns would read as "we
asked and they declined", which is not what happened. Twelve tests.

## What is still open

**Rowan's own record still shows the email**, because she was created before the
fix and the fix is create-only — which is the correct behaviour, not an
oversight. A backfill could take `recipientName` off each customer's earliest
order, but it would be guessing at whose name that is (a gift, a delivery to a
workplace), so it is left as Brandon's call rather than done quietly.
