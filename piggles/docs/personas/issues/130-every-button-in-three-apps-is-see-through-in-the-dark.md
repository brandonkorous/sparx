# 130 — Every button in three of the fifteen apps is see-through in the dark

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › Customers, Messages, Bookings — every control, dark theme
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Nia's phone is on dark. Opening a customer's record, her **Save** button was a
pale wash with the page showing through it. So was **Take a booking**, so was
**Check in**, so was the little camera badge on her own avatar. Beside them,
**Complete** — a `success` button — was a solid green slab. Two buttons, same
toolbar, one of them half there.

The cause is two characters:

```css
[data-theme='dark'] {
  --color-group-people: #8fc2c06e; /* six digits of colour, then an alpha byte */
  --color-group-people-content: #ffffff;
}
```

`6e` is 110 of 255 — **43% opacity**, baked into a colour token. Everything
painted from that token inherits it: fills, ink, borders, focus rings. Nothing
asked for it. Somebody then set that group's `-content` to `#ffffff`, apparently
to compensate for the washed-out fill, which is how a two-character slip becomes
two wrong values — every other group in the same block reads `#202631`, and the
file's own comment says so.

The People group is **Customers, Messages and Bookings**: three of Piggles'
fifteen apps, and the three a salon lives in.

## Why nothing caught it

It is valid CSS and valid hex. It typechecks, it lints, every test passes, and
the only symptom is that a fifth of the console looks slightly washed out —
which reads as a design choice until you put it beside an app that is not in
that group.

## Where it lives

- [packages/brand/src/theme/groups.css](../../../packages/brand/src/theme/groups.css)
- [scripts/check-theme-opacity.mjs](../../../scripts/check-theme-opacity.mjs) (new)

## The fix

`#8fc2c06e` → `#8fc2c0`, and `-content` back to `#202631` like its five
siblings. Measured on the running console: a `btn-module` in the People group
went from a 43%-transparent fill to a solid one at **7.7:1** against its label.

Then a guard, because this class of failure is invisible to everything else the
pre-push hook runs. `pnpm check:piggles-theme` fails on any `--color-*` token
declared as an eight-digit hex, across every stylesheet in `piggles/`. It was
shown to go **red on the real defect** before being trusted green:

```
A colour token is declared with transparency:
  packages/brand/src/theme/groups.css:61  --color-group-people: #8fc2c06e  →  #8fc2c0
```

Transparency itself is not banned — a scrim, a hover wash and a focus ring all
need it, written as `color-mix(…, transparent)` where they are used. What is
banned is a NAMED COLOUR that arrives already faded, because every downstream
use inherits a fade none of them chose.

## Confirmed by

> Re-ran act 10 as Nia on the phone. Save, Take a booking, Check in and the
> avatar's camera badge are all solid teal with legible labels. The desktop
> console's rail and panels are unchanged — the chrome does not use this token.
