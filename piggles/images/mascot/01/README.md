# Piggles Mascot System

Drop-in mascot asset package for Piggles.

## Included

- 9 production-ready Piggles illustrations
- PNG source assets
- optimized WebP production assets
- `manifest.json`
- JavaScript registry/helper
- TypeScript declarations
- React `<PigglesCharacter />` helper
- character bible
- usage matrix
- future pose catalog
- visual character sheet

## Suggested app install

Copy:

```text
assets/webp/*
```

into:

```text
public/characters/piggles/
```

Then copy:

```text
src/pigglesCharacters.js
src/pigglesCharacters.d.ts
src/PigglesCharacter.jsx
```

into your app.

Example:

```jsx
import { PigglesCharacter } from "@/lib/piggles/PigglesCharacter";

<PigglesCharacter
  id="thinking"
  className="w-72 h-auto"
  alt=""
/>
```

Or choose by intent:

```js
const mascot = getPigglesByIntent("bookings");
```

## Dynamic use

The site should select semantic character IDs rather than filenames.

Good:

```js
character="calendar"
```

Bad:

```js
src="/images/pig3.webp"
```

That lets artwork change without rewriting product code.

## Formats

- PNG = source/master
- WebP = default production format

All reusable mascot assets are intended for transparent-background placement.

## Important

See `docs/CHARACTER_BIBLE.md` before creating new Piggles artwork.
