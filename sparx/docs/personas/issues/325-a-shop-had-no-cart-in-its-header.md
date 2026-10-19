# 325 — A shop had no cart in its header

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9, a stranger shops before checkout
**Surface:** every silica-framed site's header; Gillett site; builder palette and site check; the 88 selling designs
**Filed:** 2026-10-17
**Fixed:** 2026-10-17
**Confirmed by:** sparx as Doty and as a stranger (Gillett Diesel Service), 2026-10-17
**Blocked on:** —

## What happened

A stranger added a DDP 6.7L injector to the cart and the cart drawer opened. Once she closed it, nothing in Gillett's header led back to it: Shop, Book, About, Locations, Journal, Contact, Sign in, Get in touch. The only way back to her basket was the "Cart" link in the footer's Account column, at the bottom of a long page. There was no count anywhere, so she could not see the item was still there.

It was not Gillett's alone. The site had a finished `CartButton` (an icon with the live count, opening the drawer) that nothing mounted. No silica host core drew a cart, the starter header had none, and none of the 191 shipped designs carried one.

## What should have happened

Every selling site shows a cart in its header, with the number of items in it, on every page and at every width, and it opens the cart. A site that does not sell shows none.

## How to reproduce

1. On any silica-framed shop, add an item to the cart.
2. Close the drawer and look for the cart in the header.

## Why it matters

The cart is the control a shopper looks for at the top of every page. Without it she cannot check what she chose or get back to checkout without scrolling to the footer, and some shoppers stop there.

## Where it lives

- The piece: `wizeworks/packages/silica-catalog/src/host-nodes.ts` (`site.cart-button`, in the palette under Your site, not pinned).
- The live site: `wizeworks/apps/site/components/silica-host-cores.tsx`, `components/cart-button.tsx`, `app/layout.tsx`, `lib/silica.ts` (`resolveSiteSells`).
- The console preview: `sparx/apps/workbench/surfaces/builder/studio/host-cores.tsx`, and Piggles' `piggles/apps/workbench/lib/studio/host-cores.tsx` + `host-core-marks.tsx` (`CartButtonMark`; added 2026-10-18, when `check-host-cores` caught that Piggles' canvas still drew the cart as a grey box).
- New sites: `silica-catalog/src/site-chrome.ts` (`ensureCartButton` in `siteNavbar`; `withCartButton` for captured headers).
- Sites already live: `wizeworks/packages/site-lint/src/chrome.ts` (`chrome-no-cart`), `types.ts`; `wizeworks/services/api-rest/src/lib/site-check.ts` (`shop` capability).
- Designs: `marketplace-catalog/_gen/template-sites/harness.ts`, `gen-sparx-themed.ts`, `gen-piggles-showcase.ts`, and the bundles under `marketplace-catalog/blueprints/`.

## The fix

- **A live header piece, `site.cart-button`.** It mounts the existing `CartButton`, rebuilt on silicaui (a small ghost square `Button` linking to `/cart`, with a primary `Badge` in an `Indicator` once something is in the cart; it used to paint its own fill and badge). It renders nothing unless the account sells and this site shows its shop (`sells` from the frame envelope, and the site's own module switches). The studio draws it at its real size.
- **New sites** get it from `siteNavbar` whenever Commerce is on, in the bar just before the phone menu toggle, on all three starter header shapes.
- **Sites already live** are not rewritten: the platform's frame repair never invents a control in a header its owner composed. Instead the builder's site check now says "Shoppers cannot get back to their cart" when the site sells and its header has neither the cart piece nor a `/cart` link outside the footer. A footer link does not count, because that is exactly what Gillett had.
- **The designs.** 66 selling designs built by the template harness were regenerated (harness version 1.5.4). The 20 themed copies and the Piggles starter, which copy the captured `sparx` header, now run `withCartButton` (versions 1.5.5 and 1.3.5): it places the cart right after the bar's account link, skipping the phone menu. The captured `sparx` design itself got the same step applied to its file (1.6.5), and its README now says to place the cart in the live Template before capturing again. 88 of 88 selling designs carry the cart; none of the 103 others does.
- **Phones.** The phone-header guard (`blueprint-phone-header.test.ts`) now lets the cart stay on the phone bar beside the Menu and the account link. Measured in a headless browser on Gillett's live header, which is the captured shape: with the small cart there is no sideways scroll at 320, 360 or 390px and the logo keeps its full 70px. At 320px the cart reaches 9px into the 24px gutter. A signed-in name is capped at 72px on a phone, the room "Sign in" takes.
- The regenerated designs also picked up generator changes already committed but never shipped in their bundles: the footer's Collections link (issue 340) and live social links, a variant picker in the product page's add-to-cart form (56 designs), a working newsletter form (5), and reworded search descriptions on some product and contact pages. The sweep's count of 56 stale footers is gone with them.

Tests: `site-chrome.test.ts` (cart on every starter shape, before the menu; none without Commerce; placement after the bar's account link in a captured header, never inside its menu, never twice; unpinned in the palette). `chrome.test.ts` (3 new: footer-only link reported, core or header link satisfies, silent without `shop`), red when the footer rule is broken. `site-capabilities.test.ts` (5). Suites: silica-catalog 44 files / 1476, site-lint 18 / 403, site 53 / 508. `tsc` clean on silica-catalog, site-lint and the site. The api-rest `tsc` ran out of memory on this machine: not checked.

## Confirmed by

2026-10-17. As Doty, the builder's Check said "Shoppers cannot get back to their cart … put the cart button in the top bar". In Header & footer, Insert › "Cart button (with item count)" placed it after Sign in, drawn at its real size, and the phone view kept logo, Menu, Sign in and cart on one row. Saved (the first save failed with "Could not save. Nothing was saved." while the API was restarting, which was true) and published. On the live site, signed out on /about: the header shows the cart with a "1" badge, read as "Cart, 1 item", and it opens the drawer. Check again: "Worth fixing" went from 4 to 3, with no cart finding.

Not checked on screen: a site that does not sell (covered by the core's gate and its tests).

## Rating effect

The site rows under "Outside the console" in `rating.md` are unchanged in number: the header was scored before the stranger shopped. The console's builder rows gain a site check that names a real gap.
