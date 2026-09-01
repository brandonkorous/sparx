# 346 — Her own studio called her business something else

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · opening her About page in the studio to build it out
**Surface:** mypiggles › My Site › Page (the canvas header and footer)
**Fixed:** 2026-08-30
**Confirmed by:** proved red against the real function, then green

## What happened

Opening her About page in the studio, the header across the top of the canvas read:

> **Built for the work** Shop How it's made Journal About Contact

and the footer under it read **Built for the work** as well. A second or two later
both settled to **Juniper Row**.

Her shop is not called Built for the work. Nothing is.

## Where the sentence came from

`SAMPLE_TITLES[0]` in the canvas's placeholder data — the filler that stands in for a
bound heading so a product card reads like a product card rather than like a ref.

`site.identity.name` is a text field whose key reads as a title, so the generic filler
gave it a sample HEADLINE. Until the chrome read resolved, the canvas announced the
business in another brand's voice, in the two places on the page that say whose site
this is.

## Why it mattered

**A placeholder standing in for a name has to be recognisable AS a placeholder.** A
sentence in some other brand's voice is not: an owner has no way to tell it from
something she typed, and the one thing she cannot check it against is the header,
because the header is where it is showing.

The file this lives in already carries the same lesson, written up the last time it
happened, about a starter Contact page that went on drawing an invented
`(555) 123-4567` after the owner had saved her real number:

> She had no way to tell those apart.

And the canvas hook's own header states the rule this broke:

> a header whose logo is the business's real one and whose name is a placeholder is
> worse than either alone.

## The fix, in two halves, because there are two moments

**The name was never missing.** `useSitePreview` — the fuller chrome read — is keyed
on the tenant and site SLUGS, and those arrive from two earlier reads that carry the
NAMES alongside them. The answer is in hand strictly before the query that was waiting
on it can even start.

1. **`useCanvasPreview` now supplies what the shell already knows.** The site's own
   name wins over the tenant's, matching the order `useSitePreview` itself resolves in
   (docs/49) — one owner can run two shops and the canvas is showing one of them. Every
   other field is `null` on purpose: null is not empty, so a tagline, a logo or a phone
   line keeps saying what its author typed until the real value lands. That is a strict
   improvement on the placeholder sentence and the empty-URL image the synthetic root
   supplied for those fields.

   `ActiveProperty` did not declare `name`, though `/v1/properties` returns it and
   `SiteInfo` says so. Declared, with a note saying why.

2. **The synthetic placeholder no longer uses a sample headline for a name.** Before
   anything at all is known the canvas says **Brand** — deliberately the same word the
   chrome read already falls back to on failure, so there is ONE name for "we do not
   know yet" rather than two. This is the half that closes the first paint, which no
   amount of earlier data can reach.

The memo deps were widened to match: `tenant.data` and `property.data` are what the
fallback is built from, so a memo that ignored them would have held the placeholder
until something else happened to change.

## Confirmed by

Proved RED before green, against the real function rather than a copy of it:

```
× says Brand, not another brand voice, before anything is known
  → expected 'Built for the work' to be 'Brand'
```

Then green, with the rest of the identity still synthetic and the real chrome still
winning once it arrives. Typecheck and eslint clean.

## What this run could NOT do, stated rather than skipped

**The console app has no test seat.** `@piggles/console` declares no `test` script and
no vitest, and neither does `@piggles/web` or `@piggles/account` — apps are not unit
tested in this repo, packages are. So the run above was ad hoc and the file was
removed; nothing pins this fix, and the next edit to `preview-data.ts` can undo it in
silence.

Adding vitest to an app would add a dependency and break a house convention, which is
not this run's call to make. **Recorded for Brandon**: either the pure half of
`preview-data.ts` moves into a package that is tested, or the piggles apps get a test
seat. Until one of those happens, `lib/studio/` is a few hundred lines of real product
logic with no test that runs.

## Rating effect

Against `P03 console — Juniper Row`, the page editor.
