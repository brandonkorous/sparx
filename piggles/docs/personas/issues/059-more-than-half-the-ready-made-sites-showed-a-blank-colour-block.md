# 059 — More than half the ready-made sites showed a blank colour block instead of the site

**Status:** fixed
**Severity:** **major** (the picture IS how a non-technical owner picks a template; 96 of 191 had none)
**Found by:** P01 · Thistle & Rye · standing checks — browsing My Site › Ready-made sites
**Surface:** mypiggles › My Site › **Ready-made sites** (and the marketplace detail hero)
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · the gallery, re-browsed — see **Confirmed by**

## What happened

Marisol went looking for a different look. The gallery says **170 designs**, and the
cards are pictures of the sites: Brand Newsroom shows a dark cover-art homepage, Civic
Portal shows a city hall with a services grid, Glossy Fashion shows an editorial spread.

Then the service templates. **Maple Grove Dental** is a flat teal rectangle with the
business name on it. **Vesper**, the fine-dining one, is a flat mustard rectangle. So is
every barber, plumber, vet, salon, yoga studio, therapist, café and restaurant — **96 of
191 templates**, each a solid block of its brand colour carrying a wordmark, a tagline,
an uppercase kicker reading `● BOOK ONLINE`, and one coral button that says
**"Book an appointment"** — on the restaurants too.

They are not broken screenshots. They are not screenshots at all.

## What should have happened

The card is a picture of the site. That is the whole promise of a gallery: you look, and
you pick the one that looks like your business. Ninety-five of them keep that promise.

## How to reproduce

1. Sign in, **My Site › Ready-made sites**.
2. Scroll to any service business — dentist, barber, plumber, vet, café.
3. Every card is a single flat colour with text on it. Compare with Civic Portal or
   Glossy Fashion two rows up.

Every time — it is committed art, not a render.

## Why it matters

The audience is a **non-technical business owner** who chooses by looking. A gallery
where half the cards are blank does not read as "no picture available" — it reads as
"these templates are the empty ones". The best-fitting template for a bakery, a dentist
or a plumber is invisible next to a retail template that merely photographed well.

It also says the wrong thing about the ones it does show: a fine-dining restaurant whose
card offers **"Book an appointment"** is describing a hair salon.

## Where it lives

A four-link chain, each link hiding the one before it:

1. **`marketplace-catalog/_gen/service-sites/preview.ts`** and its sibling
   **`template-sites/preview.ts`** wrote their Tailwind entry to `<repo>/apps/site/`.
   That directory **moved to `wizeworks/apps/site`**. `apps/` still exists (it holds
   `admin`), so the path looked plausible and threw `ENOENT` only at write time.
2. That throw lands **after** `· wrote bundle` and `· safeParseBlueprint → VALID`, so a
   generator run printed two successes and then died. It looked like it worked.
3. So `.preview/preview-<key>.html` was never produced — and
   **`bundle-media.mjs`**, which shoots the real home page at 1280×900 and whose own
   header calls itself _"the fourth build oracle, and the one that was missing"_, had
   nothing to shoot.
4. Which is why **`media-service.mjs`** exists at all: a synthetic card, built from the
   bundle's colours and fonts, so that the publish check (`blueprint-bundles.ts` refuses
   a bundle with no `media/preview.png`) would pass. Its own header says it — _"the
   installed site is the real thing, this is just the catalog card."_

And underneath all of that: **90 of the 96 service generators never called the preview
step in the first place.** Only the seven restaurants did. So even with the path fixed,
nine tenths of the family would still have had no preview to shoot.

This is [[feedback_structural_checks_go_blind]] with no check involved — a hardcoded
path, one tree move, and a whole pipeline that silently produced nothing. The same file
records the previous occurrence: `@tailwindcss/cli` left with `packages/site-ui` and
"took every template's preview step with it".

## The fix

Four changes, each at the point where the failure propagates:

- **`service-sites/preview.ts`, `template-sites/preview.ts`** — the entry path resolves
  to `wizeworks/apps/site` and is **asserted**, with an error that names the directory
  and says which relative imports move with it. A moved directory now says so instead of
  throwing ENOENT halfway through a generate.
- **`service-sites/harness.ts`** — `emitServiceBundle` now renders the preview itself
  (dynamic import, because `preview.ts` imports the harness). **A step a generator can
  forget is a step most generators will forget**; the seven that remembered had their
  duplicate call removed.
- **`bundle-media.mjs`** — accepts a bundle key _or_ a bare slug and finds the preview
  under either spelling. The two writers disagreed (`preview-<slug>.html` vs
  `preview-<key>.html`), which is a second reason the halves never met. It also gained a
  `stale` mode for re-shooting bundles that already have a card, and it **no longer
  overwrites an existing `media/icon.png`** — writing one only when a bundle has none, so
  re-shooting a preview can never quietly restyle 96 icons as a side effect.
- **96 previews re-shot** from the real render.

`media-service.mjs`'s synthetic card is left in the tree, unused by this path. It is the
fallback that should only ever be reached by a bundle with no renderable home page.

### One thing deliberately NOT done

The generators **re-mint every node id on each run**, so regenerating a bundle is a
~300-line diff of fresh UUIDs — and the committed bundles have drifted from their
generators (`name: 'sparx — Café'` regenerates as `'Café'`; `author: 'WizeWorks'` as
`'sparx'`). So the sweep regenerated to get the preview HTML and then **reverted every
payload**; only `media/preview.png` is committed. Whether the generators should be
deterministic, and which side of that drift is right, is Brandon's call — noted rather
than silently resolved by a 30,000-line diff.

## Confirmed by

Re-shot and looked at. `sparx-restaurant-cafe/media/preview.png` was a 35KB mustard
block; it is now a 1280×900 render of Kettle & Crumb — the real navbar (Menu · Reserve ·
About · Visit, Sign in, **Book a table**), the photographic hero with the brand card over
it, both calls to action, and the first content band beneath. 96 of 96 shot, no skips, no
broken images reported.

## Rating effect

`My Site › Ready-made sites` — the gallery is now uniformly pictures of sites.
