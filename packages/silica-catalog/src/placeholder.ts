// The shared unbound-image placeholder.
//
// A bound `Image` has no meaningful `src` until it resolves against a record, and the
// studio canvas never has one in scope — so without a default the author sees the
// browser's broken-image glyph on every card and every record template. This is a
// neutral, self-contained inline SVG data-URI (no network, no asset pipeline, no
// tenant media dependency) that reads as "an image goes here".
//
// silica's `fillValue` overwrites `src` the moment the node resolves against real
// data, so it never reaches a live, bound storefront — it is a canvas affordance only.
// Lives here rather than in `commerce.ts` because record templates in every module
// need it (a product card, a blog post's featured image), and a second copy would
// drift.

export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>" +
  "<rect width='400' height='400' fill='%23e5e7eb'/>" +
  "<circle cx='150' cy='150' r='36' fill='%23cbd5e1'/>" +
  "<path d='M70 300l86-104 62 74 58-70 74 100z' fill='%23cbd5e1'/></svg>";
