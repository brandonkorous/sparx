# Piggles Mascot System — Batch 02

Ten original Piggles illustrations for product, marketing, onboarding, commerce, and support experiences, rebuilt against `MASCOT.md` v1.1, `originals.png`, and the official brand icon source. Every image is a new render; no earlier batch art was cropped, mirrored, reframed, or reused.

All assets use the canonical brand formula: natural peach-pink Piggles, almost-circular proportions, tiny limbs and brown hooves, matte charcoal shirt, official pink `P`, and controlled charcoal, cream, warm-gray, pink, or intentional yellow accents.

## Contents

- `assets/png/` — transparent PNG masters
- `assets/webp/` — transparent WebP derivatives for production
- `assets/sheets/` — visual character sheet
- `manifest.json` — asset registry and paths
- `src/` — JavaScript, TypeScript, and React helpers
- `docs/` — character rules, roadmap, and usage guidance

## Quick start

```jsx
import { PigglesCharacter } from './src/PigglesCharacter';

<PigglesCharacter id="piggles-thumbs-up" alt="Setup complete" />
```

Set `basePath` when the package is served from another public directory. WebP is the default; pass `format="png"` for PNG.
