// An image whose source resolved to nothing must not ship as `<img src="">`.
//
// `src=""` is not "no image" to a mail client. Per the URL spec an empty `src` resolves
// to the CURRENT document, so the client fetches the email itself as if it were a
// picture and draws its broken-image icon — a grey box with a torn-page glyph, sixty-four
// pixels wide, in the middle of an order confirmation.
//
// Found by rendering all 39 provisioned defaults to disk and looking: three of them —
// `order-confirmation`, `order-delivered` and `post-purchase-review` — emitted
// `<img src="" alt="" width="64">` for a line item whose product carries no photo. That
// is not an edge case a tenant has to go looking for; a service, a custom line, or a
// product nobody has photographed yet all produce it, on the single email every customer
// is guaranteed to receive.
//
// ── Why DROP rather than substitute a placeholder ───────────────────────────
// The site render answers the same question with `fillMissingImageSrc`, which swaps in a
// served placeholder — right there, because a product grid with a hole in it reads as
// broken. Email is the opposite case on both counts: a line-item row with no thumbnail
// reads as a line item that has no picture, which is the truth; and the placeholder
// itself could not travel — it is a `data:` URI, and Gmail strips those, so "fixing" a
// broken image would mean hosting an asset and asking every client to fetch it just to
// draw a grey square. The row simply renders without a picture.
//
// Runs on the PROJECTED HTML and AFTER token interpolation, because that is the only
// point the emptiness exists: the authored node says `src="{{item.image}}"`, and it does
// not become `src=""` until the token resolves against a record that has none.

/** `<img …>` carrying a literally empty `src`, in any attribute order, self-closing or
 *  not. Deliberately narrow: only an EMPTY src matches, so an image with a real source —
 *  or one with no `src` attribute at all, which some clients tolerate — is untouched. */
const EMPTY_SRC_IMG = /<img\b[^>]*\bsrc=""[^>]*>/gi;

/** The cheap pre-test. Case-INSENSITIVE and a regex rather than `includes('src=""')`,
 *  which was the first cut and was wrong: it skipped the replace entirely for `SRC=""`,
 *  so the guard meant to make the function fast quietly made it incorrect. `toEmailHtml`
 *  emits lowercase, but this is exported and an author may paste raw HTML. */
const HAS_EMPTY_SRC = /\bsrc=""/i;

/**
 * Remove every `<img src="">` from a projected email body.
 *
 * Pure, and returns the SAME string when nothing matched, so an email whose pictures all
 * resolved pays one regex test and no allocation.
 */
export function dropEmptyEmailImages(html: string): string {
  return HAS_EMPTY_SRC.test(html) ? html.replace(EMPTY_SRC_IMG, '') : html;
}
