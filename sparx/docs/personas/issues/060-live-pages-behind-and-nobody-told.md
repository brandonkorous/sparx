# 060 — His live product page fell behind the shop, and the sparx console never told him

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 3 (proving [057] on the website)
**Surface:** workbench › Start here; the Editor (site builder); the live product page
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** On screen, 2026-10-01. Start here showed "Your product pages have not caught up with your shop" with both lines; "Bring my pages up to date" ran the repair (publish state went from `waiting` to `saved` for both); the offer then read "Your live site is behind the pages you have saved"; "Review and publish" opened the Editor with the same two lines above the canvas and "Saved · not live yet"; Publish cleared both. The live Bosch 0986435621 page then showed "A $150.00 refundable core deposit, or send your old part first" and the "Your old part" choice, and the cart drawer and checkout carried the $150.00 deposit ($750.00 total).
**Blocked on:** —

## What happened

After [057] turned his Bosch injector into one part at $600.00 with a $150.00 deposit,
the live product page showed **$600.00 and a plain Add to cart**. No deposit, no
"send your old part first" choice. The cart then added the $150.00 he had set. A
buyer saw one price and was charged another.

A product page is stamped from the catalog once, when the site is made. Later
improvements to the buy box reach it only when a repair rewrites the saved copy and
the owner publishes. The server already works out what each live page cannot say
(`livePageGaps` on the publish state, since Piggles issue 684). Measured on his site:

- "If a rebuilt part can be bought by sending the old part first, your page cannot
  offer that." (not yet in his saved copy)
- "If you sell rebuilt parts with a core deposit, your page cannot say so. A customer
  sees the price and is charged more." (already in his saved copy since [051], never
  published)

The sparx console fetched this list and drew nothing; the only place it appeared was
an empty fallback for a failed read. Piggles shows it on Home and in its Publish pane.

So since [051], every rebuilt part on his site quoted a price $150.00 lower than the
cart charged, and nothing anywhere said so.

## What should have happened

The owner is told, in his own words, what his live pages cannot say, and given the one
button that fixes it, without having to open a page he has no reason to open.

## Fix

- `sparx/apps/workbench/surfaces/builder/site-behind.tsx` (new):
  - `SiteBehindOffer` on Start here. Pages before header and footer. Two roads: a gap
    not yet in the saved copy runs the repair first ("Bring my pages up to date"),
    then opens the Editor; a gap already saved goes straight to the Editor ("Review
    and publish"). Says so if the repair fails.
  - `StudioLiveGaps` above the Editor canvas, so Publish is not a guess.
- `surfaces/builder/studio/data.ts`: `useRepairPages()` (`POST
/v1/builder/site/repair-pages`), which also drops the cached site so a later Editor
  does not save the stale tree back.
- `surfaces/builder/studio/studio-surface.tsx`: renders `StudioLiveGaps`; re-reads the
  publish state once the site has loaded, because the site read is what repairs the
  pages and the two are fetched together.
- `surfaces/home.tsx`: renders the offer under the setup banner.

Two defects found on the way, both fixed in the same session:

- The first button was solid warning on a solid warning box, so it read as a line of
  text. Now a soft box with a solid button, matching the setup banner above it.
- The first build opened `builder.site`, which is **Site identity**, not the Editor.
  Now `builder.studio`.

## Not changed, and why

- The live page took about a minute to change after Publish. That is the cache purge
  through the event worker ([040]), working as built.
