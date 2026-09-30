# 779 — The sample invoice was a diesel repair shop

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 275
**Surface:** api-rest — `GET /v1/invoicing/templates/:id/preview`
**Filed:** 2026-09-22
**Blocked on:** —

## What happened

The template preview draws the layout against a real document when one is given,
and against representative figures otherwise. A textile studio in Portland
pressed Preview and got:

```
DESCRIPTION            QTY   UNIT PRICE   AMOUNT
Fuel injector            2      $150.00   $300.00
  Part
Diagnostic + install   2.5      $120.00   $300.00
  Labor  non-taxable
```

Gillett is one client. It is not the running example, and a person designing
their own letterhead should not have to read somebody else's trade to picture
their own. [[feedback_industry_agnostic_no_diesel]]

`DEFAULT_DOCUMENT_LINE_TYPES` was neutralised for exactly this reason and carries
a comment saying so — "deliberately INDUSTRY-AGNOSTIC … so a salon, a
consultancy, a publisher, and a repair shop all read their own work into it."
This sample sat one file away and was missed.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## The second half

Three of the nine blocks the editor offers drew **nothing** in the preview,
because the sample had nothing for them:

```
shipTo        null   → "Who it is for" showed only the bill-to
shippingTotal 0      → no delivery line in "The amounts"
payments      absent → "Payments received" drew an empty space
```

The preview is the one place a person is deciding which blocks to keep. A block
that draws nothing there does not read as "nothing to show" — it reads as a block
that does not work. [[feedback_never_present_absence_as_measurement]]

## What was done

The sample is rewritten to two rules, both stated at its definition:

**Industry-neutral.** "Something you sell" as a Product, "Work you did, by the
hour" as a Service, against an example address in Portland. The words describe
the SHAPE of the line rather than a trade.

**Every block populated.** A ship-to at a deliberately different address from the
bill-to (one that repeats the line above it teaches nothing), a $12 delivery
charge, a $200 payment already received, a partially-paid status, and a due date.

## Proof

Before and after, same pane:

```
before   Fuel injector · Diagnostic + install · no Ship to · no Shipping · no Payments
after    Something you sell · Work you did, by the hour
         Bill to 18 Example Street / Ship to Unit 4, 220 Example Road
         Subtotal $600.00 · Tax (8.75%) $26.25 · Shipping $12.00 · Total $638.25
         Partially paid
```

## Files

- `wizeworks/services/api-rest/src/routes/v1/invoicing/templates.ts`

## What was checked and was fine

The eleven sample-data packs (`apparel`, `florist`, `salon`, `food`, `fitness`,
`professional`, `wholesale`, `electronics`, `generic`, `auto-parts`,
`apparel-scale`) are a deliberate spread, and `auto-parts` being one of eleven is
the point rather than a violation. The fitment dictionaries and the auto-part
product type are a vertical's features, not a default. This sample was the one
place the trade was presented to everybody.
