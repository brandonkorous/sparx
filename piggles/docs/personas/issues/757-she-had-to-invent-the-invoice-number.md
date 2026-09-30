# 757 — She had to invent the invoice number, and a used one came back as a server error

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 268
**Surface:** mypiggles + sparx workbench — Raise an invoice (`b2b.invoice.detail`, new)
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, on screen, with the network response read
**Blocked on:** —

## What happened

Wholesale invoices was empty, with a proper empty state and a **Raise an
invoice** button. The form asked for four things, and one of them was:

```
Invoice number
[ INV-1042 ]
What they'll see on their bill.
```

**Required.** No default, and the only hint of the shape is a number she has
never used. Every other invoice on this platform is numbered for her: the one
she raised from an order four minutes earlier came out `INV-000011` on its own.

So she guesses. A reasonable guess is the last number she saw.

```
Could not raise this invoice
```

A red box with a title and nothing under it. **HTTP 500.**

## Why

`billing_documents_tenant_number_unique` is a unique index on
`(tenant_id, property_id, number)`. Reusing a number is a Prisma constraint
violation, which left the service as an unhandled error: a 500, logged as a
server fault, surfaced to her as a sentence that names nothing and tells her
nothing to change. She typed a number, so she can fix a number, but only if
somebody says which one is wrong. [[feedback_one_outcome_two_causes]]

And the requirement was never needed. The service already had the branch:

```ts
const seq = await nextBillingDocumentSeq(tx, ctx.tenantId, input.propertyId);
const number = input.numberOverride ?? formatBillingNumber('INV-', seq);
```

`numberOverride` was documented as "honour a caller-supplied human number (the
manual route passes one)". The manual route passed one because the schema made
it mandatory, which is the only reason anybody was ever asked.

## What was done

**The number is offered, not demanded.** The field is optional; left empty, the
issuing site's own run numbers it, the same run every other invoice comes out
of. The placeholder says what happens rather than inventing a shape:

```
Invoice number
[ The next one in your run ]
What they'll see on their bill. Leave it empty and the next number in your run is used.
```

**A number already in use is a refusal that names it**, checked before anything
is written:

> INV-000011 is already the number on another invoice. Give this one a different
> number, or leave the box empty and the next number in your run is used.

## The sentence at the top of the form

```
Bill a wholesale customer for work outside an order. Orders on terms invoice is
for everything else.
```

That is not a sentence. sparx reads "Orders on terms invoice themselves", which
is fine; Piggles' rename of "account" to "wholesale customer" went through the
first half and mangled the second. It now reads "An order placed on terms is
billed for you."

## Files

- `wizeworks/packages/b2b/src/invoices.ts` — the optional number, the refusal
- `piggles|sparx/apps/workbench/surfaces/b2b/invoice-detail.tsx` — the field, the sentence
- `piggles|sparx/apps/workbench/surfaces/b2b/invoices-data.ts` — the optional input

## Proof

Read on screen 2026-09-20: `POST /v1/b2b/invoices` returned **500**, under a red
box reading "Could not raise this invoice" and nothing else. That is the defect;
the network panel is the only place the reason existed at all.
