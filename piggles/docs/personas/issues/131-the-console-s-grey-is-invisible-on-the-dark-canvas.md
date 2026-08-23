# 131 — Every grey control is invisible on the dark canvas

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · act 10
**Surface:** mypiggles › everywhere, dark theme
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** see below

## What happened

Found by asking a simple question about one screen: what color is the text on
that calendar event? A **completed** booking in Nia's diary was a blank
rectangle. Not faint. Blank.

Measured on the running console:

| element                    | ink       | ground    | contrast |
| -------------------------- | --------- | --------- | -------- |
| a completed booking block  | `#27232a` | `#272b37` | **1.09** |
| `badge-neutral badge-soft` | `#27232a` | `#272b37` | **1.09** |
| `alert-neutral alert-soft` | `#27232a` | `#272c37` | **1.10** |
| `btn-neutral btn-outline`  | `#27232a` | `#272d39` | **1.12** |
| `btn-neutral btn-ghost`    | `#27232a` | `#272d39` | **1.12** |

AA wants 4.5. These are 1.1 — the ink and the ground are the same color to
within a rounding error. The Previous/Next buttons under every list in the
console were button-shaped holes.

**416 controls** say `color="neutral"`, of which every `soft`, `outline` and
`ghost` one drew like this. Only the solid fill worked.

## The cause: one token doing two jobs

Silica resolves a `soft`/`outline`/`ghost` variant by using the color ITSELF as
the ink. That works for every tone whose value inverts with the canvas — success,
info, warning and error are all lights in dark mode, chosen to be read on it.

`neutral` was the exception, on purpose. In Piggles it was also **the chrome**:
the rail and the app panel, pinned dark in both themes, because — as palette.css
puts it — "a frame that swaps ends when the canvas does is not a frame." That is
a fine argument, and `--color-neutral: #27232a` with `--color-neutral-content:
#ffffff` is a correct pairing for a FILL.

It is not a color that can be ink. And it was being asked to be ink 416 times.

## Where it lives

- [packages/brand/src/theme/palette.css](../../../packages/brand/src/theme/palette.css)
- [apps/workbench/app/globals.css](../../../apps/workbench/app/globals.css) — the registered colors, and the `[data-chrome]` island
- The chrome's own call sites: the rail, the phone's nav bar and sheets, the app panel, the chrome column, the two rail cards, the builder's dark preview swatch

## The fix

The two meanings become two tokens.

**`chrome` / `chrome-deep`** keep the exact values the chrome had, in both
themes, and the seven places that paint chrome now name it. Nothing about the
rail, the panel, the phone's bar or its sheets changes by a pixel.

**`neutral`** becomes what every other registered color in that file already
is — a value that turns over for the dark canvas so it can be read on it:
`#b3adb5` with `#211e24` content, the same plum family lifted.

| element                    | before   | after |
| -------------------------- | -------- | ----- |
| `btn-neutral`              | 15.4     | 7.5   |
| `btn-neutral btn-outline`  | **1.12** | 6.3   |
| `btn-neutral btn-ghost`    | **1.12** | 6.3   |
| `badge-neutral badge-soft` | **1.09** | 4.9   |
| `alert-neutral alert-soft` | **1.10** | 5.1   |

## A design consequence Brandon should see

A solid `badge-neutral` / `btn-neutral` in dark mode was a near-black slab with
white text; it is now a light slab with dark text, which is what every other
solid control does in dark mode and is louder than what was there. That is the
honest rendering of the tone — but the tone itself is a separate question, and
root RULE #4 makes it Brandon's: 416 call sites chose `neutral` without asking,
and `bookingStateMeta` gives `completed` a grey that could reasonably be a real
color instead. **This issue fixes how the token draws, not whether those 416 are
right to be grey.**

## Confirmed by

> Re-ran act 10 as Nia. The 3 PM completed booking now reads "3:00 PM · Cut and
> finish · Yusuf Karadeniz" in the diary where it was blank. Previous and Next
> are visible under the bookings list. The rail, the header, the tab strip and
> the phone's bottom bar are pixel-identical to before.
