// Which ink does silicaui's CSS fallback paint on a role color?
//
// WHY THIS EXISTS AS ITS OWN MODULE. A theme need not define
// `--color-primary-content`. When it doesn't, silicaui derives the ink in CSS with
// relative-color syntax — it cannot measure contrast there, so it compares the color's
// OKLCH LIGHTNESS against `--silica-content-threshold` and flips. Two places in this
// repo have to predict that rule: the theme audit (`themes-ink.test.ts`) and the
// pre-publish contrast check (`@sparx/site-lint`'s `palette.ts`). Both had their own
// copy of the threshold, and BOTH WENT STALE — see the version note below. A third
// copy would have gone stale too, so the rule lives here once.
//
// The copies also disagreed on the BOUNDARY, which is the subtler reason to share a
// function rather than a number. site-lint read `l < threshold ? light : dark`; the
// theme audit read `l > threshold ? dark : light`. Those differ at exactly `l ===
// threshold`, and the CSS settles it: `clamp(0, (t - l) * 1000, 1)` is `0` when `l === t`,
// and `0` selects the DARK ink. site-lint was right, the audit was wrong, and neither
// could see the other to notice.
//
// ── THE VALUE, AND HOW TO RE-VERIFY IT ──────────────────────────────────────────────
// 0.57, changed upstream FROM 0.68 in silicaui **0.36.0**. sparx asked for exactly this
// (doc 139 §9 proposed 0.6 as a lower bound); silicaui went further and picked a value
// inside the real crossover range instead of above it. We adopted the rest of 0.36.0 and
// missed this, so two stale 0.68s sat in the tree for five releases.
//
// A lightness threshold is a STAND-IN for "which ink has more contrast", and the two
// part company: the true crossover runs from l ≈ 0.54 to l ≈ 0.59 depending on chroma
// and hue, so no single constant is right everywhere. 0.68 sat ABOVE that entire range,
// which is what made it wrong — every color in the mid band was painted with white when
// black was the legible choice.
//
// NO TEST CAN CATCH THE NEXT UPSTREAM CHANGE. The ground truth is a string inside the
// Tailwind plugin, and neither this package nor site-lint depends on that package (only
// on `@wizeworks/silicaui-html`), so nothing here can read it. Verify it BY HAND on every
// silicaui bump — which is already the standing rule for a bump (doc 139 §9: read the
// shipped bundle, never the changelog):
//
//   grep -o 'content-threshold, [0-9.]*' \
//     node_modules/.pnpm/@wizeworks+silicaui@<version>_*/node_modules/@wizeworks/silicaui/src/lib/auto-content.js
//
// If that number ever stops matching this one, every contrast verdict in the pre-publish
// check is wrong for colors between the two values — silently, and in whichever direction
// hurts more: a false alarm on a correct theme, or a pass on an illegible button.

/**
 * silicaui's default `--silica-content-threshold` (0.57 as of 0.36.0 — see the file
 * header for how to re-verify it, and why nothing automated can).
 *
 * A theme may override it with its own `--silica-content-threshold` token, which moves
 * every derived foreground on the site; callers that resolve a theme should prefer the
 * theme's value and fall back to this.
 */
export const SILICA_CONTENT_THRESHOLD = 0.57;

/**
 * The ink silicaui's CSS fallback paints on a color of this lightness — `'light'` for
 * near-white, `'dark'` for near-black.
 *
 * Reproduces `clamp(0, (threshold - l) * 1000, 1)` exactly, boundary included: at `l ===
 * threshold` the clamp yields `0`, which selects the DARK ink.
 *
 * Pass the lightness read off the AUTHORED token, never one round-tripped through sRGB.
 * `oklch(68% 0.1 232)` round-trips to 0.6798, and that drift is enough to flip a
 * comparison sitting on the threshold — which changes the ink on a real button.
 */
export function inkForLightness(
  lightness: number,
  threshold: number = SILICA_CONTENT_THRESHOLD
): 'light' | 'dark' {
  return lightness < threshold ? 'light' : 'dark';
}
