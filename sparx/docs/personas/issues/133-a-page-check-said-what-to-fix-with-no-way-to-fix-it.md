# 133 — A page check said what to fix with no way to fix it

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9 (search titles and summaries for each page)
**Surface:** workbench › SEO › Site checks › a page check; the site's page cache
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Site checks scored every Gillett page low on "How long the title is" and "The page has a short summary". The About check said "Fix this first: A very short title wastes the best chance you have of being found." The pane had two buttons, Refresh and Copy a link. Nothing on it led to where a title is changed.

For a site page, that place is hard to find: in the editor, select "Page" in Layers, open the Settings tab, scroll to "Search & sharing" at the bottom. The editor cannot be opened onto it.

The Piggles console had fixed the same gap (its issue 392, `audit-fix-target.ts`). Sparx never got it: the parity check compares shared components and libraries, not screen folders.

Then a neighbor. Once saved, the new title stayed off the live site for up to five minutes. A page's search words are live the moment they are saved (only the body waits for Publish), but the site caches them, and only a publish cleared that cache.

## What should have happened

The check leads to the fix, and the fix shows on the site straight away.

## Why it matters

A non-technical owner reads advice they cannot act on and gives up on search. An owner who saves and sees no change thinks the save failed.

## The fix

- Workbench `surfaces/seo/audit-fix-target.ts` (ported from Piggles): "Edit this page / product / collection / article", in the hue of the module it opens, on the check's toolbar. A site page opens the editor on that page (`builder.studio`, `pageId`).
- Workbench `surfaces/seo/page-search-wording.tsx`: for a site page, "How it shows up in search" with Search title, Summary and Save, on the check itself. Same endpoint and rules as the editor's panel: `lengthHint`, `titleLengthHint`, `shownTitle` and `recordWordingFor` are now exported from `page-settings.tsx` and used by both. A page that shows every product says each product writes its own words. Unsaved edits register the leave guard. Saving re-scores the page.
- New event `builder.page.settings.changed` (`@wizeworks/events` types, `@wizeworks/builder` topics, Terraform topic map): `pageService.update` sends it after any change other than the body. The purge worker (`cache-revalidation-worker`) clears the site's page cache on it, as on a publish.

Tests, each proved red:

- `builder/src/services/page-settings-event.test.ts` (2): a search title save sends the event; a body-only save sends nothing. With the send disabled, 1 fails.
- The cache worker's own test asserts the new name maps to the builder scope (21 pass). `check:events` failed until the topic was added to Terraform: "1 event name(s) declared in code but NOT provisioned".

## Confirmed by

On screen, 2026-10-06, as Doty, on the About check: "Edit this page" (indigo) opened the editor on About. In "How it shows up in search" he typed a title and a 147-character summary; the status bar showed "1 unsaved change"; Save gave "Saved. Checking the page again." and the score went from 78 to 90, "Title and summary" 100%. The first save reached the live `<title>` only after the cache ran out (about five minutes). After the event: a second save at 00:44:01Z was on the live page at the next request.

## Rating effect

—
