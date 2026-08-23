# 156 — Another product's name was sitting in her list of emails

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · standing check — the buyer's side (found while checking what the confirmation email says)
**Surface:** mypiggles › My Site › Email designs
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** see below

## What happened

Nia's list of emails, scrolled to the bottom:

> Welcome Welcome to {{site.name}}
> Welcome — day 3 A few places to start at {{site.name}}
> …
> **Welcome (sparx — Salon (Editorial))** Welcome to {{site.name}}

She has never heard of sparx. It is a different product, on a different brand,
sold by the same company — and its name is sitting in her account, in a list she
opens to write to her clients.

This is the same defect as 122, which was a blocker for the same reason: a
business owner should never see the name of a product she did not buy on a screen
inside the one she did.

## Why it happened

Two things, and the second is why it was invisible.

**Where the name comes from.** A blueprint install writes its own copies of the
platform's default emails. Both legitimately ship a "Welcome", so the installer
suffixes the incoming one with the blueprint's name, because "which one is this?"
really means "where did this come from?" (`emailService.uniqueName`). It reads
`blueprint.name` out of the installed bundle, and 169 of the catalog's 191
bundles had a `name` beginning `sparx — `.

**Why nobody caught it.** The bundles are GENERATED, and the generators are
already correct — `gen-sparx-salon-editorial.ts` declares `name: 'Salon
(Editorial)'`, and so does the manifest it emits (`sparx.json`). Only the emitted
`blueprint.ts` still carried the prefix. The artefacts were **stale against their
own generators**: somebody cleaned the name at the source and the bundles were
never regenerated, so the corrected name never reached the file the installer
actually reads.

`check:boundaries` would not have found it either. Its brand-literal rule (which
issue 128 records as absent) covers `wizeworks/**`, and the catalog is not under
`wizeworks/**`.

## The fix

The artefacts are brought into line with what their generators already say:

- **169 bundles** — `name: 'sparx — X'` → `name: 'X'`, plus the same prefix in
  each file's own header comment (189 files in total; 20 had a clean name and a
  prefixed comment).
- **Three generators** still emitting the brand were corrected so a regeneration
  cannot put it back: `gen-sparx-themed.ts` wrote the prefix into the header it
  emits, and all three harnesses declared `author: { displayName: 'sparx' }`
  where the manifests on disk (and the publisher row) say **WizeWorks**.
- **92 bundles were version-bumped** — the other 97 were already bumped in this
  tree — and each harness's `BUNDLE_VERSION` moved with them, so the catalog and
  its generators agree: portfolio-sites 1.2.0 → 1.2.1, template-sites 1.4.1 →
  1.4.2, themed clones 1.2.0 → 1.2.1.

The bump is what makes the correction reachable: a blueprint's content is copied
into a tenant's site at install, and the update machinery only offers a
correction when the catalog version differs from the installed one.

## Still open

**Nia's own row is not renamed.** It is her record now — installed on 2026-08-21,
hers to rename — and the update machinery is what offers her the corrected
bundle. Rewriting a row in her account from a migration is not this fix's
business. Anyone installing one of these bundles from now on gets the right name.

## Confirmed by

- `check:blueprint-versions` against `origin/main`: every changed bundle carries
  a bumped version.
- All 191 bundles have matching versions in `blueprint.ts` and `sparx.json`.
- No bundle payload name or file header begins with the brand any more, and no
  generator emits one.
