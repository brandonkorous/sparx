# Theme submission

A **theme** restyles a whole site — colors, type, shape, and rhythm — without
touching its content or layout. It is pure data; no code runs.

## Bundle

```
aurora/
  sparx.json     # category: "theme"; facets: mood, colorFamily, density, industry
  theme.ts       # exports a DataThemePreset (v1 tokens + v2 preset)
  media/
    preview.png  # a screenshot of the theme applied to a sample site (card image)
    swatch.svg   # optional palette swatch
  README.md
```

## Payload contract (`theme.ts`)

`export default` a `DataThemePreset`:

- **`v1.light` / `v1.dark`** — the 11 storefront tokens (`colorPrimary`, …,
  `radiusBase`, `containerWidth`).
- **`v2`** — `shared` (fonts, the radius trio, border width, rhythm, depth,
  container width) plus `light` / `dark` color slots (`base100/200/300`,
  `baseContent`, `primary`, `secondary`, `accent`, `neutral`, status colors,
  `border`). `*Content` pairs are optional and auto-derived for legibility.

## What gets checked

- Parses against `DataThemePreset` (every required slot present, hex/length valid).
- Derived/explicit `-content` colors clear **WCAG AA** contrast on their surface.
- `containerWidth` is a known key (`narrow|medium|wide|full`) or a CSS length.
- Allow-list: only the files above; no imports beyond the type import.

## Apply

On approval the tokens are stored on the catalog row. A tenant who clicks **Apply**
loads them into their site **draft** (nothing public changes until they publish).
The compile engine reads the data preset directly — no code preset, no deploy.
