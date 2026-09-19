# 675 — A settled return still said "Waiting"

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 240
**Surface:** mypiggles › Stock › Sent back › (a return)
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03, on the screen — see below
**Blocked on:** —

## What happened

Ashcombe credited the stained roll. Devi recorded the credit and the return
closed: the badge went to **Credited**, the middle figure went to "$18.00 —
settled in full". The third figure said:

> **Waiting**
> **39 seconds ago**
> their ref AM-RMA-118

Nothing was waiting. And "39 seconds ago" was not when it settled — it is when
the goods LEFT, which is what that card falls back to once there is no waiting
time left to show.

## Why

One heading over three different facts:

```text
<StatTitle>Waiting</StatTitle>
<StatValue>
  {data.awaitingCreditDays === null ? (
    data.sentAt ? <Timestamp value={data.sentAt} format="relative" /> : 'Not sent'
  ) : (
    <Badge …>{plural(data.awaitingCreditDays, 'day', 'days')}</Badge>
  )}
</StatValue>
```

`awaitingCreditDays` is the chase number and it goes null the moment a credit is
recorded — correctly, there is nothing left to chase. The fallback was written
for the OTHER null case, a return not sent yet, and quietly took over the
settled one too.

**And the right value was already in the component's hand.** `resolvedAt` is on
the type, is fetched into both consoles, and had **zero renderers anywhere**.
[[feedback_fetched_but_never_rendered]]

## What should have happened

When a thing has finished, the card says which way it finished and when. There
are exactly three ways — credited, written off, called off — and the server
stamps `resolvedAt` for all three.

## How to reproduce

Before the fix, every time:

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. Open a return, send it, record a credit.
3. The third figure reads "Waiting" over the time it was sent.

## Why it matters

Small, and the shape is the expensive one: a card that keeps its label while its
meaning moves underneath. Somebody scanning a list of closed returns for "which
of these is still out with a supplier" reads the word Waiting on every one of
them.

## Where it lives

`piggles|sparx/apps/workbench/surfaces/inventory/supplier-return-detail.tsx` —
the third `<Stat>`.

## The fix

A small map beside the component, so the three finished states name themselves:

```ts
const SETTLED_TITLE: Record<string, string> = {
  credited: 'Credited',
  closed: 'Written off',
  cancelled: 'Called off',
};
```

The title is that word when there is one and "Waiting" when there is not, and the
value is `resolvedAt` — printed as a date, because a settled return read a month
later wants the day, not "4 weeks ago". `formatMoment`, not `formatDay`: the
moment a credit is recorded is an instant, and it belongs on the reader's own
clock. See [670](670-the-date-i-typed-came-back-a-day-earlier.md) for why those
are two different functions.

A return whose status says credited but which carries no `resolvedAt` reads "Not
set" rather than inventing a moment.
[[feedback_never_present_absence_as_measurement]]

## Confirmed by

> **RTV-000001**, after the credit: "**Credited** / **September 18, 2026** /
> their ref AM-RMA-118".

Before the fix, the same card said "Waiting / 39 seconds ago".

## Rating effect

Recorded in [rating.md](../rating.md) on the
`inventory.supplier-returns.detail` row.
