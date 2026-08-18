// The shared unbound-image placeholder.
//
// A bound `Image` has no meaningful `src` until it resolves against a record, and the
// studio canvas never has one in scope — so without a default the author sees the
// browser's broken-image glyph on every card and every record template. This is a
// neutral, self-contained inline SVG data-URI (no network, no asset pipeline, no
// tenant media dependency) that reads as "an image goes here".
//
// Lives here rather than in `commerce.ts` because record templates in every module
// need it (a product card, a blog post's featured image), and a second copy would
// drift.
//
// ── It is NOT canvas-only, and that assumption was the bug ───────────────────
// This used to claim that silica's `fillValue` overwrites `src` the moment the node
// resolves against real data, so it never reaches a live, bound site — a canvas
// affordance only. That is true only when there IS data. A brand new tenant has an
// EMPTY catalog, so the starter's product cards resolve to nothing and this default is
// exactly what the live site tries to render — on the first page every new customer
// sees.
//
// And it could not render, because `toHtml`'s URL sanitiser drops `data:` on `src`
// outright — raw, percent-encoded and base64 all three, verified against the bundle.
// So every fresh site drew two broken-image glyphs on its homepage. Measured on
// production: a site with products emitted 19 of 20 images with a src, one with an
// empty catalog emitted 0 of 2.
//
// Hence TWO constants. The data URI stays for the React canvas, where it renders and
// costs no network; the site projection swaps in the served URL below, because a
// served path is the only thing that survives the sanitiser.

export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>" +
  "<rect width='400' height='400' fill='%23e5e7eb'/>" +
  "<circle cx='150' cy='150' r='36' fill='%23cbd5e1'/>" +
  "<path d='M70 300l86-104 62 74 58-70 74 100z' fill='%23cbd5e1'/></svg>";

/** The same art as a served asset — `wizeworks/apps/site/public/placeholder-image.svg`, which a
 *  static export must also carry. Root-relative on purpose: it is the one form the
 *  sanitiser keeps that needs no knowledge of the tenant's domain. */
export const PLACEHOLDER_IMAGE_SRC = '/placeholder-image.svg';
