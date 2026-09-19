# 668 — It told me how late, but never what day

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 238
**Surface:** mypiggles › Stock › Overdue deliveries
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** — (the console half is done; the `Timestamp` half needs the
silicaui release, same as [667](667-i-could-not-type-the-date-it-asked-me-for.md))

## What happened

Devi had one order genuinely late — PO-000005 from Ashcombe Mills, promised for
the 4th of September. She opened **Overdue deliveries** to ring them, and the
row said:

| Order                                                                             | Overdue by | Was due         | Still to come | Value   |
| --------------------------------------------------------------------------------- | ---------- | --------------- | ------------- | ------- |
| PO-000005 · Ashcombe Mills<br>against the date on the order · **not yet flagged** | 14 days    | **2 weeks ago** | 6             | $108.00 |

Two problems, both about what she says next.

**1. There is no date anywhere on this screen.** "Overdue by 14 days" and "Was
due 2 weeks ago" are the same fact said twice. The sentence she needs on the
phone is "you promised me the 4th", and the 4th is not on the row, not in a
tooltip, and not under the mouse. She had to open the order to find it.

**2. "not yet flagged."** She read this as something she had failed to do. It is
not: it means the platform's overnight check has not yet passed the order on.
Nothing in the console explains that, the word appears nowhere else in Piggles,
and it only ever shows in one of its two states — so the meaning lives entirely
in the absence of the words and can never be learned.

## What should have happened

The column headed **Was due** says the day it was due.

And a label a business owner cannot define should not be on the row. This
console already made that call elsewhere: the reviews queue renders the internal
`flagged` status as **"Reported"** rather than showing the raw word
([`product-reviews.tsx:93`](../../../../piggles/apps/workbench/surfaces/commerce/product-reviews.tsx)).
Overdue deliveries was the one place that leaked it.

## How to reproduce

Every time.

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. Raise an order to a supplier with an expected date in the past and place it.
3. **Stock › Overdue deliveries.** The row reads "2 weeks ago" and "not yet
   flagged". Hover the "2 weeks ago" — nothing.

## Why it matters

**Chasing a supplier is a conversation, and this screen does not give her the
one number the conversation runs on.** A late-delivery list that cannot tell her
the promised date makes her open each order individually, which is exactly the
scrolling the pane exists to replace.

The missing tooltip is not local to this pane. **210 call sites across the two
consoles render `<Timestamp format="relative">`**, and not one of them offers the
real moment — "3 days ago" on an order, a payment, a stock movement, a customer
message. `format="auto"` had the tooltip; asking for relative explicitly threw it
away, which is backwards, because the relative label is the one that needs it.

And the flag: the late-order event has **exactly one consumer** on the whole
platform — the webhook list under **Tell other software**
(`services/api-rest/src/routes/v1/webhooks/subscriptions.ts:87`). No worker, no
automation trigger, no email, no notification. So nobody in the business is ever
told an order is late; the row is the telling. The copy must not imply otherwise.

## Where it lives

- `piggles|sparx/apps/workbench/surfaces/inventory/late-orders.tsx`
- `@wizeworks/silicaui-react` → `packages/silicaui-react/src/timestamp.tsx`
  (the repo at `G:/code/@wizeworks/silicaui`)

```text
// the column
<Timestamp value={row.dueAt} format="relative" />

// the label
{row.alertedAt === null ? ' · not yet flagged' : ''}
```

```text
// silicaui: keyed on the FORMAT rather than on what was rendered
title={format === "auto" ? formatAbsoluteTime(date, now) : undefined}
```

## The fix

**The column** now shows the date. `formatAbsoluteTime` already does the right
thing at every distance — a time for today, "Sep 4" this year, "Sep 4, 2025"
beyond it — so no new formatting was written:

```text
<Timestamp value={row.dueAt} format="absolute" />
```

**The label** names who actually hears about it, and shows both halves so the
meaning is learnable rather than implied by silence:

```text
{row.alertedAt === null
  ? ' · not passed to your other software yet'
  : ' · passed to your other software'}
```

**The tooltip**, in silicaui, keyed on what is rendered rather than on what was
asked for:

```text
title={useRelative ? formatAbsoluteTime(date, now) : undefined}
```

Strictly more informative than before: `format="relative"` gains a tooltip,
`format="auto"` on a relative label keeps the one it had, and both absolute cases
still have none, because the text is already the answer. A caller's own `title`
still wins — `{...rest}` is spread after it.

`verify-timestamp.mjs` is new, 6 checks, wired into the package's `verify`.
**Proved red:** putting the old `format === "auto"` rule back fails 2 of the 6 —
the relative case losing its tooltip, and `auto` gaining a redundant one.

**Sibling check.** Both consoles carry byte-identical copies of `late-orders.tsx`
and both were changed. Nothing else in either console renders `alertedAt`.

## Confirmed by

Re-ran P03 act 238 on the screen.

> **Stock › Overdue deliveries**, one row:
> PO-000005 · Ashcombe Mills · against the date on the order · **not passed to
> your other software yet** — 14 days · **Sep 4** · 6 · $108.00

The toolbar above it reads "$108.00 of stock is late across 1 order", which was
right already.

## Rating effect

`Stock › Overdue deliveries — Design 8 · Ease 8`, first scored this act. Recorded
in [rating.md](../rating.md).
