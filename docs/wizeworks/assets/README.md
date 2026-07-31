# WizeWorks — brand assets

**Version:** 1.0.0
**Author:** Brandon Korous
**Last Updated:** 2026-07-30

Source artwork for the WizeWorks mark. Spec and rules in
[../04-brand-and-visual-identity.md](../04-brand-and-visual-identity.md) §3.

## Files

| File                 | What                                    | Size     |
| -------------------- | --------------------------------------- | -------- |
| `wordmark.svg`       | Light surfaces — ink, `z` in pine       | 3492×798 |
| `wordmark-dark.svg`  | Dark surfaces — bone, `z` in light pine | 3492×798 |
| `wordmark-black.svg` | One-colour black, `z` at 50% opacity    | 3492×798 |
| `wordmark-white.svg` | One-colour white, `z` at 50% opacity    | 3492×798 |
| `icon.svg`           | Pine tile, paper W                      | 1183²    |
| `icon-dark.svg`      | Light-pine tile, dark W                 | 1183²    |
| `icon-black.svg`     | Black tile, white W                     | 1183²    |
| `icon-white.svg`     | White tile, black W                     | 1183²    |

## How these were made

Outlined from **Instrument Serif Regular** (SIL OFL 1.1 — outlining for a mark is permitted),
shaped with harfbuzz for correct kerning, tracked -0.02em. Pure `<path>` data with no font
dependency, so they render anywhere including edge-runtime OG images.

The icon is the wordmark's own `W` reversed out of a solid tile. That is not a style choice — a
high-contrast serif's hairlines disappear at 16px, so the tile carries the silhouette instead. Four
monograms were built and tested down to favicon size before this one was chosen; the comparison is
recorded in §3.2.

## Regenerating

Both scripts live outside the repo (scratchpad). To rebuild: download
`InstrumentSerif-Regular.ttf` from Google Fonts, outline the string with `fontTools` +
`uharfbuzz`, and emit per-glyph paths so the `z` can carry its own fill. Keep the ratio at
**0.229** and the icon at **14%** corner radius.

## Constraints

- **Minimum wordmark width 92px** (≈20px cap-height).
- **Icon is legible to 16px**; do not substitute a bare serif W at small sizes.
- Never re-set the wordmark as live text — the `z` is a path, not a span.
- Never stretch, condense, or re-track.

## Where these go

Uploaded as **tenant media** (`upload_image` → `update_site_settings` with `logoLightMediaId` /
`logoDarkMediaId` / `faviconMediaId`), never into `@sparx/brand` — that package holds the
platform's own marks and a tenant cannot publish into it. See
[../06-build-plan.md](../06-build-plan.md).

## Photography

Pexels imagery for the site lands here too, alongside the required `image-manifest.csv`
(file, source URL, photographer, downloaded date, page used on) —
[../04-brand-and-visual-identity.md](../04-brand-and-visual-identity.md) §7.5.
