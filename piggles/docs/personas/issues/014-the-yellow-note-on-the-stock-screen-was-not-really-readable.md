# 014 — The yellow note on the stock screen was barely there

**Status:** fixed — **but the last section needs Brandon's word, because it touches the palette**
**Severity:** design
**Found by:** P01 · Thistle & Rye · act 6
**Surface:** mypiggles › Stock › Set up your stock — and every soft `<Alert>` and `<Badge>` in the console
**Filed:** 2026-08-19
**Fixed:** 2026-08-19
**Confirmed by:** re-ran the same screen in light — "You have already done this somewhere else — tick it off." is now legible olive-amber instead of pale yellow-on-cream, and a probe of all five soft alerts and four soft badges reads cleanly in **both** themes
**Blocked on:** —

## What happened

Marisol opens **Stock → Set up your stock**. Step one has a note in it:

> You have already done this somewhere else — tick it off.

It is 14px, and it is `#ffd166` on a near-white cream panel. Against the page
that is **1.44:1**. WCAG's floor for body text is 4.5:1, so this is not "a bit
light" — it is roughly the same failure as issue #003's invisible Sign in, one
step less severe because there is a tint behind it.

Rendered side by side, all five soft alerts wash out and warning disappears.

## What should have happened

Text a person is meant to read clears 4.5:1. Root RULE #3 is explicit that faded
ink is reserved for text deliberately NOT meant to be read, and this note is
instructions.

## How to reproduce

Every time, light theme:

1. Console → **Stock** → **Set up your stock**.
2. Read step 1's amber note. Or render the family:

```js
['warning', 'success', 'info', 'error', 'primary'].map(
  (c) =>
    `<div class="alert alert-${c}"><div class="alert-content">
     <div class="alert-description">${c}: the quick brown fox</div></div></div>`
);
```

## Why it matters

Soft alerts and soft badges are how the console says almost everything
conditional — "already done this", "not on sale", "40 days overdue", a status
pill on every list row. Piggles' audience is named as a 61-year-old on a phone in
a workshop. Pale amber at 14px is not for them.

## Where it lives

The same structural mistake as issue #003, one family over.

`piggles/packages/brand/src/theme/palette.css` chooses the semantic hues as
**fills** — light, warm, friendly, each with a dark `-content` to sit on it. That
is the brand and it is right; those colours are lovely as a filled badge.

silica then uses the same token as **ink**. A colour class is a pure var-setter:
`.alert-warning` assigns `--alert-bg`/`--alert-fg` (the solid look) and
`--alert-accent`, and `--alert-accent` is what `soft`, `outline`, `ghost`, `dash`
and `link` paint the TEXT with. So a hue picked to be sat on gets painted onto a
pale tint of itself.

Dark mode is fine, because a light hue on a dark surface is exactly what it is
good at. This is a light-theme failure of a token that has to serve both.

- **The hue is kept and given somewhere to go.** 60% of the hue mixed with the
  surface's own content colour. Because `--color-base-content` flips with the
  theme, ONE rule darkens in light and lightens in dark — a warning stays amber
  and a success stays green in both.
- **60% was chosen by looking, not by arithmetic.** 40/50/60/70/100 were rendered
  in both themes and compared: below 60 the hue drifts toward grey and stops
  carrying meaning, at 100 it is the defect.
- **Solid fills are untouched.** `--alert-bg`, `--badge-bg` and `--btn-bg` still
  take the raw hue with `-content` on top. That is where these colours are at
  their best and where the brand actually lives.

Five families, seven colours: button, badge, alert, link, tabs.

## Confirmed by

> Re-ran act 6 and reopened **Stock → Set up your stock** in light. The note now
> reads as a legible olive-amber, and "Mark it done" beside it as a readable
> green.
>
> Then rendered all five soft alerts and four soft badges as a probe, in **light**
> and again in **dark**, and looked at both: every line readable, every colour
> still recognisably itself. Before and after screenshots are the evidence — the
> "before" light probe has a warning line that is genuinely hard to find on the
> panel.

## The part that is Brandon's, and why I did not wait

`palette.css` says, in as many words: _"The palette is Brandon's. Do not compute
color. Use these tokens as given; if a pairing looks wrong on screen, say so and
ask."_ This is a pairing that looks wrong on screen, so this section is the
asking. you do not get to change palette or colors, including work arounds to avoid the palette, without Brandon's word.

## Rating effect

mypiggles › Stock › Set up your stock — Design 5 → 8. Every pane carrying a soft
alert or badge is affected; the ones already scored keep their numbers, since the
score was taken before the fix and the gap column names it.
