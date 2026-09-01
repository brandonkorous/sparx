# 363 — A ready-made design deleted every page on the site it was added to

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · reading the install path behind [361]'s fix, then proving it on a site I made
**Surface:** mypiggles › My Site › Ready-made sites › one design › Add it to a site
**Filed:** 2026-09-01
**Fixed:** 2026-09-01
**Confirmed by:** two installs onto one site, and a count of what survived

## What happened

Devi browses **Ready-made sites**, opens one, and reads:

> **What this adds to your site**
> Everything comes in as drafts you can change — **nothing here replaces what you
> already have.**

She picks a site and presses the button. A dialog:

> **Add "News Feed" to Juniper Row?**
> This adds the design's pages and a matching look to Juniper Row — all as drafts
> only you can see. **Your existing pages and products are left exactly as they
> are**, and nothing goes live until you publish it.

Both sentences are false. Adding a design **deletes every page on the site it is
added to** and puts the design's pages there instead, along with its header, footer
and look.

The site picker defaulted to **Juniper Row** — her live primary site, 22 pages, a
year of work — so the two clicks that destroy it are the two clicks the screen
invites, under a promise that nothing will be lost.

## Proving it

Not by reading code. I made a sixth site of Devi's, **Juniper Row Sample Sale**, so
that everything at risk was something I had created:

| step                      | what the screen said                             | pages on that site after |
| ------------------------- | ------------------------------------------------ | ------------------------ |
| new site, nothing on it   | —                                                | 0                        |
| add **News Feed**         | "your existing pages … left exactly as they are" | 9, all News Feed's       |
| add **Longform Literary** | "your existing pages … left exactly as they are" | 9, all Longform's        |

Both installs still say **installed**, and both still record the nine page ids they
created:

```
blueprint_key             recorded  still on the site
sparx-longform-literary   9         9
sparx-news-feed           9         0
```

Nine pages recorded, **zero of them still exist.** The console believes two designs
are on that site; one of them has nothing left.

## Why it happened

`installSiteSlice` calls `siteService.installSite`, which syncs with
`allowReplace: true`:

```ts
// packages/builder/src/services/site-service.ts
// `allowReplace` is set on purpose: an install intentionally swaps the whole site,
// which is exactly the wholesale replacement `sync`'s clobber guard exists to stop
// on the editor path. This is the sanctioned caller.
await sync(ctx, { pages: … }, { allowReplace: true });
```

and `pagesToDelete` then returns **every stored page absent from the incoming
roster**:

```ts
if (allowReplace) {
  const inRoster = new Set(roster);
  return storedSilicaIds.filter((id) => !inRoster.has(id));
}
```

An install mints a fresh id per page, so no stored page is ever in the roster, so the
answer is always "all of them". `syncTx` deletes exactly that list.

**The platform is not wrong here.** A design IS a whole site — the console's own name
for it is "Ready-made sites" — and swapping the site is what installing one means.
`sync`'s clobber guard exists precisely to refuse this write from any other caller;
the installer is the one sanctioned exception. What was wrong is that the screen
offering it said the opposite, twice, and coloured the button as an addition.

### And it cannot be undone

The site keeps restorable snapshots, so this looked recoverable. It is not:

> Restore semantics are deliberately NON-DESTRUCTIVE: it brings back the versioned
> content of pages that still exist, and touches nothing else — **it never deletes a
> page you have since added, nor resurrects one you deleted.**
> — `draft-version-service`

That is the right rule for its own job and it means the deleted pages are gone. A
warning that offers a recovery which is not there would be worse than none, so the
new copy says there is no undo.

## What should have happened

The screen should say what it does, sized to the site chosen, and colour the control
accordingly. Products, articles, customers and orders genuinely are untouched — only
`builder_page` rows are ever deleted — so the warning has to say that too, or it
reads as "you may lose everything" and nobody can act on it.

## The fix

**A site can now be told apart from an empty one.** `GET /v1/properties` carries
`pageCount`, from one grouped count rather than a count per row. Absent on the single
-site read, never defaulted to 0 — "not counted" and "empty" are different answers,
and confusing them is the whole bug.

**One sentence, in one place, sized to the chosen site.** `installImpact()` in
`blueprints-words.ts`:

- **no pages** — "Juniper Row Press has no pages yet, so this design gives it its
  first ones. They arrive as drafts only you can see, and nothing is live until you
  publish it."
- **pages** — "A design is a whole site, not a set of pages added to one. Juniper Row
  has 22 pages now, and adding this design replaces all 22 of its pages, along with
  its header, footer and look. That cannot be undone. Everything else stays as it is:
  your products, articles, customers and orders are not touched."
- **not counted yet** — the same warning without a number. Never the reassuring half.

**Three places now read from it**, and they change live as the site picker changes:

1. the sentence under the site picker (was: "your other sites are not touched", which
   is true and is not the thing worth knowing);
2. a `danger` alert above the button — "Adding this replaces the 22 pages on Juniper
   Row. To try a design without losing this one, add it to a different site";
3. the button itself: **"Replace Juniper Row with 'Immersive Photo'"** in `danger`,
   rather than "Add … to …" in the app's own hue.

**The confirm asks the real question.** "Replace the 22 pages on Juniper Row?" with
**Replace the pages**, in `danger`. On an empty site it is still "Add … ?" / "Add it"
in the app hue, because there it was always true.

**The two sentences that lied are gone.** "What this adds to your site" now reads
"Everything comes in as drafts you can change, and nothing is live until you publish
it" — what is true of every install, whichever site it lands on. The file header's
"Adding is additive … leaves your pages and products alone" is replaced by what
actually happens.

`blueprint-detail.tsx` went to 255 lines with the count threaded through, so the
target-site derivations moved to `blueprint-detail-state.ts` (`useBlueprintTarget`):
which site, what is on it, whether this design is installed there, whether an update
exists, which apps are off. Layout in one file, facts in the other. 210 + 114.

## Still open

- ~~There is no safe way to try a design.~~ **Built.** The picker carries **A new
  site**: one name field, the address shown as she types, and the button then makes
  the site and puts the design in it. Doing that immediately found [365] — adding the
  same design to a second site of one business had never worked.
- **A failed swap has no floor.** The install row is created before the pages are
  written; if the write dies partway the old pages are already gone. Not observed —
  raised as a question, not a defect.
