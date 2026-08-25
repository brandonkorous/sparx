# 198 — The size box said "Any size Any size"

**Status:** fixed and confirmed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 4 (the 360px pass over the Media pane)
**Surface:** mypiggles › Sell › Product › Media › This photo › When this photo shows
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 4, on screen

## What happened

Pinning the Clay photograph to the Clay colorway, the **Size** box reads:

```
Size
┌──────────────────────────────────────┐
│ Any size          Any size         ⌄ │
└──────────────────────────────────────┘
```

The same two words, twice, side by side in one control — one in full ink, one
greyed. The **Color** box beside it, holding a real value, reads `Clay` once.

It is not a narrow-screen artifact. It was found at 360px and it is identical at
desktop width.

## What should have happened

One answer per box.

## Why it matters

Small, but it lands on the one control whose whole job is to say _what this photo
is tied to_. Devi is pinning three photographs to three colorways and reading
these two boxes fifteen times over. A box that says its answer twice makes her
stop and check whether she pressed something wrong — and the greyed copy reads
like a hint that the box is still empty, which is the opposite of what it means.
Repeated across a 12-colorway catalogue, that is a lot of second-guessing over
nothing.

## Where it lives

[product-media-pinning.tsx](../../../apps/workbench/surfaces/commerce/product-media-pinning.tsx),
one prop.

The control was given **two different mechanisms for the same idea**, and both
fired:

```tsx
<Select
  placeholder={`Any ${option.name.toLowerCase()}`}   // ← mechanism one
  value={draft.byOption[option.id] ?? ''}
  items={{
    '': `Any ${option.name.toLowerCase()}`,          // ← mechanism two
    ...
  }}
/>
```

Silica's trigger always renders the resolved value **and** a placeholder span,
and hides the span unless the trigger carries `[data-placeholder]`:

```js
// silicaui/src/components/select-menu.js
[sel('-placeholder')]: { display: 'none', … },
[`${sel('-trigger')}[data-placeholder] ${sel('-placeholder')}`]: { display: 'block' },
```

Base UI stamps `[data-placeholder]` when the value is empty, and `''` is empty.
But `''` also has a real entry in `items`, so the value label resolves to
"Any size" as well. Nothing is broken in either library: they were asked two
questions and both answered.

## The fix

Drop the `placeholder`. "Any size" is a **choice**, not a hint — it lives in the
list where she can pick it back, and it is the right thing for the box to say
once. The other select in the same file, "Which version", keeps its placeholder
and is correct: its `items` map has no `''` entry, so nothing else claims the
empty value.

The house convention was already this. Sixteen other selects across the console
give the empty value a real label (`No one assigned`, `Not linked to a deal`,
`Never expires`) and pass no placeholder. This one file was the only place that
did both.

## How to reproduce

Before the fix:

1. Sell › Products › any product with options › Media.
2. Click a photo, set **When this photo shows** to _Whenever a certain choice is
   picked_.
3. Leave one of the option selects on "any". It prints its label twice.

## What it looked like once fixed

The Clay photograph, pinned to the Clay colorway:

```
Size    Any size
Color   Clay
```

One answer each. Opening the Size box still lists **Any size** at the top with a
check beside it, then XS S M L XL, so the way back to "any" is where it was.

## Rating effect

`Sell › Product › Media` in [rating.md](../rating.md).
