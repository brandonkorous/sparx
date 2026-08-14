# Accessibility

Target WCAG 2.2 AA.

## Required

- keyboard-accessible MDI
- visible focus states
- logical focus order
- accessible names for windows and controls
- color contrast
- no color-only status meaning
- reduced-motion support
- scalable text
- screen-reader labels
- form errors associated with fields
- clear validation
- accessible modal/window behavior
- usable target sizes
- captions/transcripts for instructional media where practical

## Pink contrast caution

The primary pink may not be suitable for small text on white.

Use pink primarily as:

- accent
- icon fill
- large graphic element
- tinted surface/background
- interactive emphasis where contrast passes

Use dark charcoal for primary readable text.

## SilicaUI semantic contrast

Every Piggles named color must define and use its paired `-content` color.

Examples:

- `primary` / `primary-content`
- `secondary` / `secondary-content`
- `accent` / `accent-content`
- `success` / `success-content`
- `info` / `info-content`
- `warning` / `warning-content`
- `error` / `error-content`

`base-content` is the default readable ink for the base surface system.

Do not assume:

- white text on a colored background is accessible,
- a color pair remains accessible after opacity/transparency,
- an inherited foreground is appropriate on a semantic background.

Piggles' starting `primary` intentionally pairs with dark `primary-content`, not white.

## Light and dark validation

WCAG 2.2 AA validation must be performed independently for both canonical themes:

- `light`
- `dark`

Do not assume a semantic pair that passes in light mode also passes in dark mode after token tuning.

Test:

- text
- icons
- buttons
- focus rings
- disabled states
- selected states
- alerts
- form validation
- MDI active/inactive window states
- charts
- hover/focus combinations

Theme switching must not cause focus loss or make current keyboard focus visually ambiguous.
