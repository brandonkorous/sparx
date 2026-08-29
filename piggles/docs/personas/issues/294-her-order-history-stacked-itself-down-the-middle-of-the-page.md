# 294 — Her order history stacked itself down the middle of the page

**Status:** fixed
**Severity:** minor (layout; every shopper's order history on every site)
**Found by:** P03 · Juniper Row · standing check "Buyer's side"
**Surface:** the tenant site — **Account › Orders**
**Filed:** 2026-08-27
**Fixed:** 2026-08-27
**Confirmed by:** The row reads left-to-right at full width and wraps inside the card at 360px

## What happened

Anneliese's order history holds one order. The row is written to be a row — order
number and date on the left, status and total on the right:

```tsx
style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', … }}
```

What renders is a narrow centered stack floating in a wide empty card: `#O-000004`
centered, `Aug 25, 2026` centered under it, then the status badge and `$170.00`
centered under that. The whole left two-thirds of the card is blank.

## What should have happened

The row reads as a row: identity on the left, status and money on the right,
which is what the code is asking for and what every list on the platform does.

## How to reproduce

Every time, on any account with at least one order.

1. Sign in on Juniper Row's site as `anneliese.vogt@example.com`.
2. Open **Account › Orders**.

## Why it matters

Cosmetic, and stated as cosmetic. It is worth fixing because it is the first
screen a returning customer sees after signing in, it holds her money, and a
centered stack in an empty card reads as an unfinished page rather than as a
list.

## Where it lives

[wizeworks/apps/site/app/account/(authed)/orders/page.tsx](<../../../../wizeworks/apps/site/app/account/(authed)/orders/page.tsx>)
— the row is a `<Link className="card border-base-300 border">` carrying an
inline `display: flex` that never sets a direction.

`.card` is not a neutral box; it is a flex column already:

```js
[sel()]: {
  display: "flex",
  flexDirection: "column",
  …
```

An inline `display:flex` cannot undo that, because it never names
`flex-direction`. So the card's `column` survives, the main axis is vertical,
`justify-content: space-between` distributes down instead of across, and
`align-items: center` — meant to centre the two groups on a shared baseline —
centres the entire contents horizontally. Every declaration does exactly what it
says; they are just being applied to the wrong axis.

This is the cost the no-inline-style rule exists to avoid. Hand-written `style`
props do not compose with a component's own CSS, and here the mismatch is silent:
nothing errors, the row simply renders as a column.

## The fix

The inline `style` props are gone from the whole file and the layout is
utilities, which is what the no-inline-style rule is for: `flex-row` names the
axis out loud, so `.card`'s own `column` cannot silently win.

It also **wraps** rather than overflowing. At 360px the number, the status and
the total genuinely do not fit on one line, and the first pass put `$170.00` hard
against the card border. `flex-wrap` with `gap-x-3 sm:gap-x-4` drops the status
and total onto a second line, left-aligned — which is not the centered stack this
issue is about. `whitespace-nowrap` on the order number stops `#O-000004`
breaking across lines.

## Confirmed by

Re-opened **Account › Orders** as Anneliese. At full width the row reads
`#O-000004 · Aug 25, 2026` on the left and `On its way · $170.00` on the right.
At 360px in an iframe it wraps to two left-aligned lines inside the card, with
nothing touching the border and no sideways scroll.
