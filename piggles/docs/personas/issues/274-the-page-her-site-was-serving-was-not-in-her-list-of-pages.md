# 274 — The page her site was serving was not in her list of pages

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — reading her sitemap, then her Journal
**Surface:** mypiggles › My Site › Page, the page editor's status line, and
`/v1/sitemap.xml`
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

`juniperrow.com/blog` is Devi's Journal. It is live, it lists her three
articles, and it opens like this:

> **Journal**
> News, notes, and what we have been working on.

She did not write that sentence. She could not change it either: her list of
pages had eleven rows and none of them was the Journal. Naming a new page
"Journal" did not help — that built a second, blank page at `/journal`, because
the address she needed was already answered by something the console did not
know existed.

And her sitemap listed all three articles and **not the page that lists them**.

## The mechanism

The storefront falls back to the code starter **per slug**
([lib/silica.ts](../../../../wizeworks/apps/site/lib/silica.ts) —
`getPublishedSilicaPage` → `starterPageDtoForSlug`), so every starter address is
LIVE whether or not the property has a page there. That is a good rule: it is
what makes a brand-new site a real site on day one.

What was missing is the other half. `listOrSeed` writes the starter set only when
the page table is **empty**, so any path that creates pages FIRST leaves the
difference serving and unreachable. Her blueprint installed ten pages and no
Journal; the chrome it installed links `/blog`; the storefront duly served the
platform's Journal there, for three months, in her name.

Eleven addresses were in that state on her site: `/blog`, `/book`, `/cart`,
`/search`, `/products`, `/collections`, `/category` and the four account pages.
Live to every visitor, absent from the one screen an owner opens to change them.

**The same reasoning was already written down, for one page.** `ensureHomeTx`
exists because "any path that creates pages FIRST … would otherwise leave the
property permanently home-less", and `ensureRecordPagesTx` exists to backfill
record templates onto properties that predate them. Ordinary pages had neither.

## The fix

**`ensureStarterPagesTx`** — the ordinary-page twin of `ensureRecordPagesTx`, in
[page-service.ts](../../../../wizeworks/packages/builder/src/services/page-service.ts).
On a list read it gives the property a row for every starter address it holds
none for, carrying the starter body so the page opens on what visitors already
see rather than on a blank canvas to rebuild from. Appended at the end, so no
existing page moves. Idempotent.

The decision is a pure function, `missingStarterPages`, exported and tested the
way `recordPagePlan` is. It compares **by address, not by stored slug**: a
blueprint writes `about` and the starter writes `/about`, so matching the raw
string would have minted a second About page beside the real one on the next
list read — and again, and again, since each new row spells it the other way.

**The status had to stop lying too**, or the eleven new rows would have arrived
saying "Not live yet" about pages the whole world could read — [270] again, one
screen over. `BuilderPageSummaryDto` and `PageDocument` now carry `live`,
computed by
[page-liveness.ts](../../../../wizeworks/packages/builder/src/services/page-liveness.ts):
published, OR a record address, OR a starter address for this tenant's modules.
The list badge reads it instead of `isTemplate`, and the editor's status line
gained the case it was missing:

```
before   Saved, but never published — your visitors can’t see this page yet.
after    Saved. Visitors still see the standard design until you publish.
```

**The sitemap lists them.** `starterAddresses` in
[sitemap-urls.ts](../../../../wizeworks/services/api-rest/src/lib/sitemap-urls.ts)
adds every starter address the site serves and no published page covers — minus
any whose author ticked "keep this out of search", which is read from every row
now rather than only from published ones, because the tick is about the ADDRESS
and the starter is what answers there.

An index with nothing behind it is still left out. Juniper Row has every module
switched on, so without that rule her sitemap gained `/book` — a clothing label
offering Google a page reading "No services are bookable yet".

## What it is not

It will bring back a page someone deleted on purpose, and that is honest rather
than a bug: deleting the row never took the address down. `/shop` is served by
the starter the moment its page is gone. A list that shows the page again is the
first screen to tell the truth about it — the alternative, which is what shipped
until today, is a page that is live and invisible.

## Her site

Her Journal is hers. She opened it from the list, replaced the standfirst, saved
and published:

> **Journal**
> Notes on cloth, fit, and looking after what you already own. Written here in
> the studio.

That was the last page on her site still wearing the platform's words.

## Confirmed

Twenty-two rows in her page list, eleven of them new, every one badged
**Live · standard design** and every one opening on the design its address is
serving. `/blog` is in her sitemap. `@wizeworks/builder` (10 new tests, 145
total), `@wizeworks/api-rest` (8 new tests, 406 total) and the four packages
touched all typecheck.

## Related

Same family as [273] — a page the console could not see. That one was a
blueprint's install artifacts going missing; this one is structural, and it is
why [273] looked like a one-off when it was not.

[[feedback_absent_behaves_like_fine]] — a page with no row renders exactly like a
page with one. Nothing on either screen was wrong; the two screens were
describing different sites.

[[feedback_never_present_absence_as_measurement]] — "Not live yet" over a page
the world is reading.

## Rating effect

My Site › Page and the page editor, in [rating.md](../rating.md). Recorded in the
run log of [03-juniper-row.md](../03-juniper-row.md).
