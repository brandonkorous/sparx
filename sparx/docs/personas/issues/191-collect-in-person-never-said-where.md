# 191 — "Collect in person" never said where

**Status:** fixed
**Severity:** minor
**Found by:** P01 · Gillett Diesel Service · act 13 (a fleet orders on account)
**Surface:** the Gillett site › checkout › How you'll get your order (collect in person)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P01 on screen, 2026-10-09
**Blocked on:** —

## What happened

Renée chose "Collect it from us, free". The step said "Collect in person · Free · We'll
put this aside under Renée Castañeda. We'll call +1 (801) 555-0148 when it's ready." It
never said where to collect it. Gillett has a shop on Heritagecrest Way and a warehouse
in Concord Park.

## What should have happened

The step names the place, from the business's own contact address, which the site
already loads for every page.

## Where it lives

`wizeworks/apps/site/components/checkout/collection-step.tsx`; `app/checkout/page.tsx`
passes the site's name to the checkout but not its address.

## The fix

`app/checkout/page.tsx` hands the site's own contact address (`site.contact.address`) to
the checkout; `checkout-flow.tsx` passes it to both ways into the collect step;
`collection-step.tsx` draws "Collect it from <address>." when the business has one, and
says nothing it does not know when it has none. Test
`components/checkout/collect-place.test.ts`, red first; site 449 pass; lint clean.

On screen it then read "Collect it from 14812 Heritagecrest Way Bluffdale, UT 84065":
the business keeps its address on two lines, and inside a sentence the line break became
a space. `lib/address-line.ts` `addressOnOneLine` joins the lines with commas, and the
step uses it. The same paragraph also said "We’ll put this aside" and then "We'll call",
two kinds of apostrophe; it now uses one. Tests in `collect-place.test.ts`, red first (the
step did not use the helper, and had straight apostrophes); site 456 pass; lint and format
clean. The other pages that show the address use the owner's own typed text, not this
value, so nothing else needed it.

## Confirmed by

P01 on screen, 2026-10-09, as Renée on the Gillett site, checkout › Delivery › "Collect it
from us, free": "Collect it from 14812 Heritagecrest Way, Bluffdale, UT 84065." and "We’ll
put this aside under Renée Castañeda. We’ll call +1 (801) 555-0148 when it’s ready." Not
placed.

## Rating effect

—
