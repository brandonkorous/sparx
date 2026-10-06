# 046 — His live site spoke the template's words, and nothing said so

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 2
**Surface:** the live site; workbench › Editor › Check; every shipped design's footer
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-ran P01 act 2. Check on his real site listed "Words from the starter design are still here" for 7 pages and the header and footer; after he rewrote Home it named only the other six; the footer row went once his footer showed his tagline. Live homepage 10 s after Publish: his words, his tagline in the footer, 0 template lines
**Blocked on:** —

## What happened

Gillett Diesel's site had been live since act 1. Its homepage sold the platform,
not the shop: "Build it. Sell it. Grow it. All in one place.", "Everything your
business needs, working together", "More ways to sell", a high-five stock photo,
and lines written to the OWNER, read by every customer as the shop's own voice:

> "A handful of favorites. Swap in your own products when you make this yours."
> "Swap in your words, your products, and your brand. This template is a starting point, not a straitjacket."

Every page had the same (About: "A short story about who you are… Replace it
with your own"). The footer under his name said "Everything you publish and sell,
in one place." although he had set his tagline, "Diesel Done Right Since 1986!",
in Site identity. Launch, Publish and Check said nothing about any of it.

## What should have happened

The owner learns, before and after publishing, which words are still the
design's. A footer line meant to describe the business shows the tagline he set.

## Where it lives

- `@wizeworks/site-lint` had no rule for it, though each install keeps the
  design's original pages as baselines (`tenant_blueprint_install_artifacts`).
- The footer line: issue 851 (Piggles) fixed it in the code starter
  (`siteFooter`), but the golden `sparx` design is captured, not generated, and
  42 shipped designs still carried the old sentence. A fix left its neighbor
  behind.

## The fix

- **New check rule** `starter-text` (`site-lint/src/starter-text.ts`): one
  warning per page (and one for the header and footer, merged across pages) that
  still carries the design's copy word for word, quoting two lines. Lines under
  four words and bound text are left alone. `starterLinesOf()` exported so the
  caller and the rule read a "line" the same way. 7 tests on the real starter and
  on the Garage design he installed; 3 fail with the rule off.
- **api-rest** `lib/site-check.ts` `starterText()`: reads the install baselines for
  this site's pages and frame. `undefined` when there is no design or the read
  fails, so the rule stays silent instead of calling an unread site clean. 2
  tests.
- **Check copy** (`site-check.tsx`) now says it looks for "words your design came
  with that are still not yours", so its promise covers the new rule.
- **Footer line bound to the tagline**: `upgradeFrameChrome` repair 5
  (`silica-catalog/src/upgrade-frame.ts`) binds a platform-written footer line to
  `site.identity.tagline` with the fallback "Glad you found us. Get in touch any
  time." (an unset tagline resolves to `null`, which keeps the fallback). The
  starter's own `siteFooter` ships bound, so a new site never needs the repair.
  Install never copies a design's tagline, so the binding cannot bring a pitch
  back. 6 tests; red with the repair off.
- **Shipped designs**: the 20 themed copies and the Piggles starter regenerated;
  the golden and 19 template designs patched node by node (no regeneration,
  which would re-mint every node id), each diff read back: one node per design,
  +6/−2, plus 1.5.1 → 1.5.2 in `blueprint.ts` and `sparx.json` for the 19.
  The golden and its copies were already bumped for [023] this session.
- **His site, as Doty, on screen**: Home (hero "G.D.S." and his welcome, "We Repair
  The Big 3 And Much More...", "News & Technical Info", "Light Duty Diesel Shop"
  with his trust strip, "Service and trade accounts", a call-us block with both
  numbers, his own photos), About (his company profile and mission, word for
  word), Contact intro, Shop intro, Journal heading. Template quote removed per
  [023]. Published.

Checks: site-lint 395/395; silica-catalog 1380/1380 + new 6; blueprints 47/47;
`check-blueprint-journal` OK; api-rest site-check 23/23; tsc 0 for all.

## Still to do in this run

Book (act 7) and Wholesale (act 5) still carry template words; Check lists them.

## Seen, not settled

- Picking a layer in the Layers panel does not scroll the canvas to it.
- The Layers panel names bound text by its sample (Contact's "(555) 123-4567")
  while the canvas shows his real number ([047]).

## Rating effect

Editor › Check: a new rule to score. Site: the homepage is his.
