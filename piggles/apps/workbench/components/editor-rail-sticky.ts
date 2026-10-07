/** Apply to the ONE rail child that should pin while the main column scrolls —
 *  the summary. Sticky only once the layout is actually two-column (@4xl), and
 *  only while it is the LAST thing in its rail.
 *
 *  A pinned card with cards after it collides with them whichever way it is
 *  stacked. Under them, the next card slid over the summary and its text read
 *  through "Nobody has been asked to sign this yet" (sparx persona issue 085).
 *  Over them, the summary hid the cards that scrolled up beneath it: on an
 *  invoice, Payments and its "Record a payment" button went behind the totals,
 *  and a click there landed on the summary (issue 096). A summary followed by
 *  Signature, Payments and History therefore scrolls with them; one with
 *  nothing after it (a person's card, the jobs running now) still pins. */
export const EDITOR_RAIL_STICKY = '@4xl:last:sticky @4xl:last:top-4';
