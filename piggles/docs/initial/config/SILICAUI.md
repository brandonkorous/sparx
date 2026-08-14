# SilicaUI Configuration Notes

Piggles uses SilicaUI as the implementation design system.

Canonical theme names:

- `light`
- `dark`

The application should also support a user preference of:

- `system`
- `light`
- `dark`

`system` resolves to one of the two canonical Piggles themes.

## Required theme behavior

- Components consume semantic SilicaUI colors.
- Theme switching changes token values, not component logic.
- Do not hard-code light/dark hex values in components.
- Do not create a parallel Piggles color API outside SilicaUI.
- Every named color must include its matching `-content` value in both themes.
- Additional semantic colors must exist in both themes.

Canonical values live in:

`config/brand.tokens.json`

Implementation details for exact SilicaUI theme declaration syntax should follow the installed SilicaUI version in the repository.
