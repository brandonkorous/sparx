# 291 — On a phone, the site's header lost Gillett's logo and the page slid sideways

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming [197] (Brynn's account page at 360px)
**Surface:** the Gillett site › the header on every page, at phone width; the template frames it came from
**Filed:** 2026-10-16
**Fixed:** 2026-10-16
**Confirmed by:** sparx as Doty, 2026-10-16
**Blocked on:** —

## What happened

Signed in as Brynn O'Hara-Løvdal on http://localhost:3004/account?tenant=gillettdiesel,
in a 360px frame (no window resize). The header read "Menu · Brynn · Get in touch".
Gillett's logo was not there. The page scrolled 2px sideways. The home page is the
same.

Measured: the logo's link and its image are 0px wide. The right-hand group (the Menu
button 59px, the account button 95px, "Get in touch" 106px and their gaps) needs about
296px; the bar has 295px inside its padding at a 343px viewport. The logo is the only
thing that can shrink, so it shrinks to nothing, and the right-hand group still runs
2px past the edge.

## What should have happened

On a phone a stranger sees whose shop this is. The logo keeps its size, everything
fits the width, and nothing scrolls sideways (root CLAUDE.md: responsive is a top-2
rule for tenant sites too).

## How to reproduce

1. Any page of the Gillett site at 360px wide, signed in or not ("Account" is shorter
   than a name, so signed out it may just fit: check).
2. The header has no logo.

## Why it matters

The customer sees it on every page on a phone, which is most visits to a parts shop.

## Where it lives

The header is the site frame's first `nav`: `mx-auto flex w-full max-w-6xl items-center
justify-between gap-6 px-6 py-4` holding the `site.brand` host (`wordmark inline-flex
items-center gap-2`, no `shrink-0`) and `flex items-center gap-3 @sm:gap-6` (links hidden
under `@sm`, a `details` menu, the account link, the primary button). The same shape is
in 22 template frames under `marketplace-catalog/blueprints/*/site.json`. Gillett's live
frame is his copy of Garage's.

## The fix

No generator writes these headers: the golden `sparx` bundle's site is a capture, and
the 20 `sparx-*` clones and `piggles-starter` are copies run through
`upgradeFrameChrome`, the same repair that heals a tenant's draft frame when the owner
opens the designer. So the fix is a repair rule, `fitHeaderOnPhone` (rule 7 in
`wizeworks/packages/silica-catalog/src/upgrade-frame.ts`), applied to the golden and
regenerated into the 21 copies. On the header shape every template has:

- The `site.brand` host is `shrink-0` (and so is the component's own default class in
  `site-brand.tsx`): the logo never gives way.
- The primary button is hidden on the bar below the `@5xl` container and copied into
  the Menu as its last item (`btn btn-primary btn-sm btn-block mt-1`, same link and
  words). The light/dark switch moves into the Menu too; its empty wrapper took a slot
  and a gap even on sites with one look.
- The bar's links switch at `@5xl` (1024px), not `@sm`: the full bar needs about 715px
  with five links and 800px with Gillett's six, so at `@sm` the page would have
  scrolled sideways from 384 to 800px. Windows from 768 to 1023px show the Menu.
- Two renderer fixes in `wizeworks/apps/site`: a host core that forwards its class
  (brand, account link, social links) no longer wears it twice, on a wrapper `div` and
  on its own link (`components/host-wrapper.ts`, used by `silica-chrome.tsx`); that
  double padding is why "Brynn" measured 95px. And a signed-in name is capped at
  `max-w-18` with an ellipsis below 1024px, so a long name or an email fits.

Versions: `sparx` 1.6.3 to 1.6.4; the 20 `sparx-*` 1.5.3 to 1.5.4; `piggles-starter`
1.3.3 to 1.3.4. An existing site gets it when its owner opens the designer (the draft
is healed, never the published frame) and publishes; the publish pane names it only
as "header and footer have changes". The blueprint Update path does not carry it
reliably: bundle frames carry no node ids.

Tests: silica-catalog 1,468 (11 new phone-header cases; 5 red with the rule
unregistered); site-lint 400, with a new guard over the shipped bytes of all 22
bundles (`blueprint-phone-header.test.ts`, red when Garage was broken); apps/site 497
plus `silica-chrome-host-wrapper.test.ts`; api-rest blueprint tests 34; typecheck
clean for those three packages. Rendered through the catalog's preview harness at 320,
360, 600, 767, 768, 1024 and 1300px with Gillett's real logo, the account link as
"Teodora", "Sign in" and a long email, and five or six links: the logo held 70px and
nothing scrolled sideways. Before the rule the same harness reproduced 0px and the
sideways scroll.

Found on the way, not fixed yet: at 400px the home page body has a ghost button that
runs 10px past the edge.

## Confirmed by

sparx as Doty, 2026-10-16. Before: the live home page at 360px, signed in as Renée,
had the logo at 0px wide. Doty opened the site Editor (Search everything › "header" ›
Site › Editor) and pressed Publish: "Your site is published."

After, in a 360px frame (no window resize), on the home page and on /account:

- The logo is 70 × 32px. The bar reads "logo · Menu · Renée". The page is 341px wide
  in a 356px window, so nothing scrolls sideways.
- The Menu holds the seven links, the account link and "Get in touch" as its last
  item (`btn btn-primary btn-sm btn-block mt-1`).
- At 800px: logo, Menu and the account link; nothing scrolls sideways (781 in 796).
- At 1300px: logo, the six bar links, "Renée" and "Get in touch". "Wholesale" is in the
  Menu only, as it was before the fix (the bar had six links then too).

The 400px ghost button, 2026-10-19: the home page at 360, 375, 400 and 414px scrolls nothing
sideways (page width equals window width at each), and no element ends past the edge. At
400px the two ghost buttons, "Contact us" and "Read the journal", end at 340px and 182px.
What changed it between Oct 16 and Oct 19 was not traced.

## Rating effect

—
