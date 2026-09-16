# 494 — A placed order was drawn at half opacity

**Status:** fixed
**Severity:** major
**Found by:** Devi looking at PO-000002 straight after placing it
**Surface:** `inventory.purchase-orders.detail` (both consoles)
**Filed:** 2026-09-09

## What was wrong

The moment an order was placed, its Order details card went grey. Measured on
the placed pane:

```
totalControls: 8
fadedCount:    6      (opacity 0.5)
```

Six of the eight controls, at half opacity: the supplier, where it lands, her
reference, the arrival date, the payment terms and the carriage. That is the
entire record.

**This is the state she lives in.** A draft is open for a few minutes; a placed
order is what she opens every day for the ten to twenty-one days she is waiting
for the goods. The one version of this pane that is READ rather than filled in
was the one drawn hardest to read.

It also swallowed a fix made minutes earlier:
[493](issues/493-the-arrival-date-the-server-worked-out-never-reached-the-screen.md)
got the computed arrival date onto the screen, and it landed at 50%.

## Why

Every field carried `disabled={!editable}`, and `editable` is `status === 'draft'`.
Silica draws a disabled control at half opacity, which is **correct** — that is
what "you cannot use this" is supposed to look like, and it is not a silica bug
to fix upstream.

The mistake is one level up: reaching for `disabled` to express "this is
settled". A placed order is not a form somebody has been locked out of. Nothing
is being withheld and there is nothing to try. The values are simply **facts**
now, and a fact is not a greyed-out input.

House rule this breaks, verbatim: _never `soft`, `muted`, `/opacity` … on
anything a person is meant to READ_.

## The fix

A small `SettledField` in the pane: label, value in full ink, optional
description. `min-h-10` is the silica field height, so a settled value still
lines up with any live control beside it.

```tsx
<Field>
  <FieldLabel>{label}</FieldLabel>
  <p className="flex min-h-10 items-center text-sm">
    {value === null || value === '' ? empty : value}
  </p>
  {description ? <FieldDescription>{description}</FieldDescription> : null}
</Field>
```

Each field now picks its rendering off `editable` rather than passing `disabled`
down. Absences are said in WORDS rather than left blank, because a blank cannot
be read either: "None given", "Not agreed", "No date", "Nothing noted."

Two things fell out of it:

- **The Expected box was a dead second lever.** A live "When it is expected"
  card lower down the pane already reschedules that date, and the greyed box at
  the top duplicated it. The settled value now points at it: _"Change it under
  When it is expected, below, if the supplier gives you a new date."_
- **The Notes textarea was the last one**, and a note written before the order
  went out is the one thing on the card somebody comes back to READ. It renders
  as text with `whitespace-pre-wrap`, which keeps the lines she typed.

## Proven

On placed PO-000002, driven, not reasoned about:

|                           | before | after             |
| ------------------------- | ------ | ----------------- |
| controls in Order details | 8      | 2 (the live ones) |
| **drawn at opacity 0.5**  | **6**  | **0**             |

And on screen: Supplier **Fairfield Trims**, Where it lands **Main Warehouse**,
Your reference **None given**, Expected **September 19, 2026**, How you pay
**net 15**, Shipping cost **$0.00** — every one of them in full ink.
