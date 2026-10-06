# 023 — Every new site carried a made-up customer quote

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 1 (the customer side)
**Surface:** first-party starter designs (marketplace-catalog) · the live site
**Filed:** 2026-10-01
**Fixed:** 2026-10-01 (in the catalog; existing installs see note below)
**Confirmed by:** re-ran P01 act 2: deleted the quote section from his own homepage in the editor and published; the live homepage has no "Priya Nair" (0 matches). New installs: the catalog bundles carry no `blockquote` (checked)
**Blocked on:** —

## What happened

Doty's freshly published homepage, examples off, carried a customer testimonial:

> "We went from an idea to open for business in a single afternoon. Everything we
> needed was already here." — **Priya Nair**, Founder, independent shop

with a stock photograph of a real woman as her avatar. Nobody by that name ever
said it about Gillett Diesel, or about anyone.

## What should have happened

A new site carries no third-party praise the owner did not collect. The examples
switch says "Nothing arrives that is not yours".

## Why it matters

A fabricated review on a real business's website, with a real stranger's face
on it. That is a false endorsement in the owner's name, and it shipped on every
site built from the starter: the golden `sparx` starter, its 20 themed copies
(Garage among them) and the Piggles starter.

## Where it lives

`marketplace-catalog/blueprints/sparx/site.json` (captured from the Template
property), home page section 6. `gen-sparx-themed.ts` and
`gen-piggles-showcase.ts` copy it verbatim into 21 more bundles.

## The fix

- Removed the section from the golden `site.json` (73 lines, nothing else).
- Regenerated the 20 themed copies and `piggles-starter` from it.
- Versions bumped so installed tenants are offered the update (docs/55):
  `sparx` 1.6.1 → 1.6.2, themed copies 1.5.1 → 1.5.2, `piggles-starter`
  1.3.1 → 1.3.2. All 22 checked by hand against HEAD.
- Read back the regenerated diff: beyond the quote, each copy picked up the
  platform's own footer repair (`upgradeFrameChrome` adds the social-links core,
  as the generator documents) and a new summary sentence. The generator's summary
  had been edited to "The complete starter: a faceted shop, … a wholesale page:
  in the Garage look", two colons; it now reads "A complete starter in the Garage
  look, tuned for vehicle service, repair, and parts: a faceted shop, a journal, a
  booking page, and a wholesale page."
- No other bundle ships a `blockquote` (0 of 191). Ten other designs name invented
  team members on their team pages; that is the owner's own copy to replace, not a
  third party's praise, and is left.
- The Template property in production still has the section; the next capture
  would bring it back. Remove it there before re-capturing.

## Not yet done

- The dev catalog rows (`marketplace_blueprints`) still hold the old definitions
  until the catalog is re-registered (`pnpm --filter @wizeworks/api-rest
marketplace:self-register`, a shared-database write: asking Brandon). Production
  gets it from the release's data stage.
- Doty's own installed site: removed by him in act 2 (done, see [046]).

Checks: blueprint sweep 9/9 over every bundle; `check-blueprint-journal` OK.

## Rating effect

—
