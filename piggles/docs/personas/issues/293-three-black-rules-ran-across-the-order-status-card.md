# 293 — Three black rules ran across the order status card

**Status:** fixed
**Severity:** minor (cosmetic, but it is on the shopper's order page and it looks
like the page is broken)
**Found by:** P03 · Juniper Row · standing check "Buyer's side"
**Surface:** the tenant site — **Account › Orders › Order #O-000004 › Order status**
**Filed:** 2026-08-27
**Fixed:** 2026-08-27
**Confirmed by:** The three black rules are gone from the Order status card; four steps and one rail

## What happened

The order-status card draws the lifecycle down the right-hand side — Order placed,
Payment confirmed, Shipped, Delivered — each with an icon and a thin grey rail
joining them. That part is right.

Across the empty left half of the card, three **solid black horizontal rules**
run edge to edge, one between each pair of steps. They join nothing, label
nothing and sit in white space. On a page whose job is to reassure somebody about
an order, the card looks like it failed to render.

## What should have happened

The card shows the rail and nothing else.

## How to reproduce

Every time, on any order.

1. Sign in on Juniper Row's site as `anneliese.vogt@example.com`.
2. **Account › Orders** and open **#O-000004**.
3. Look at the left half of the **Order status** card.

## Why it matters

Cosmetic, and it is stated as cosmetic. It matters only because of where it is: a
customer looks at this card when she is anxious about an order, and a card with
stray rules across it reads as a broken page at the exact moment she wants to be
reassured.

## Where it lives

[wizeworks/apps/site/components/order-timeline.tsx](../../../../wizeworks/apps/site/components/order-timeline.tsx)
— each `TimelineItem` hand-adds `<hr>` connectors:

```tsx
{i > 0 ? <hr className={before ? rail : 'bg-base-300'} /> : null}
<TimelineMiddle …>{step.icon}</TimelineMiddle>
<TimelineEnd …>…</TimelineEnd>
{i < steps.length - 1 ? <hr className={after ? rail : 'bg-base-300'} /> : null}
```

`<hr>` connectors are another library's Timeline contract, not silica's. Silica's
own source says so in as many words:

> The connecting lines are drawn as the marker's `::before`/`::after`, each
> flex-filling half the row so consecutive markers join into one continuous rail
> — **no `<hr>` markup**, and the first/last caps are hidden automatically.

Each `<li>` is `grid-template-columns: 1fr auto 1fr`, and the three tracks are
claimed by `.timeline-start`, `.timeline-middle` and `.timeline-end`. An `<hr>`
carries none of those classes, so it auto-places into **column 1** — the empty
start track of a one-sided timeline — and renders as a full-width rule. That is
precisely what is on the screen.

So this is a call site hand-painting something the component already draws
(root RULE #1). The visible rail was never coming from the `<hr>`s; it comes from
the markers, and always did.

## The fix

The `<hr>` connectors are deleted. That is the whole change: the rail was never
coming from them, and with them gone silica draws it from the markers as it
always meant to.

`RAIL_CLASS`, the `before`/`after` computation and the `cn` import went with
them, along with a `reached ? 'text-base-content' : 'text-base-content'` ternary
whose two branches were identical.

**What is lost, and where it belongs.** The `<hr>` classes were reaching for a
per-segment rail color, so the filled part read as progress. Silica draws the
rail from `var(--color-base-300)` with no per-item hook, so that is not
expressible today — it is a silica-level ask, not something to re-patch here
(root RULE #1). Progress still reads: the step MARKERS carry the order's tone,
and they always did.

Checked for siblings: `TimelineItem` has exactly one call site in the repo.

## Confirmed by

Re-opened Anneliese's order #O-000004 on Juniper Row as her. The Order status
card now holds the four steps and one thin rail, and the three black rules across
its left half are gone. Checked at 1252px and at 360px.
