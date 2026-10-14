# 986 — Publish everything shipped the pages she never opened unrepaired

**Status:** confirmed
**Severity:** major
**Found by:** P09 · The Marrow Review · act 10, proving issue 950 on screen
**Surface:** mypiggles › My Site › Publish (and the same publish in sparx)
**Filed:** 2026-10-11
**Fixed:** 2026-10-11
**Confirmed by:** P09 on screen, 2026-10-11
**Blocked on:** nothing

## What happened

Issue 950 moved her page headings onto the same edge as her header. The repair
runs on a page's draft when the page is OPENED in the editor. Rosalind went to
Publish to put it live. The screen said:

- **"1 page has changes that visitors are not seeing yet. Each author
  /authors/:slug"**

Every one of her catalog pages was behind: Home, Contributors, Subscribe and
Archive among them. The screen named one page she had edited days ago.

Then she opened Archive, and its draft healed. Had she pressed **Publish
everything** then, Archive would have gone live repaired and every page she had
not opened would have gone live exactly as before, with the heading still 24px
left of her header's name. The button says "everything". It shipped the
drafts as they stood.

The same is true of every repair that lives in the page heal: the sold-out
notice (684), the form routed nowhere (350), the lazy product hero (345). Each
reaches a live site only for the pages its owner happens to open first.

## Why

`healPageTx` and `healFrameTx` (`wizeworks/packages/builder/src/services/site-service.ts`)
run in `load` and `loadPage`, the reads the editor makes. `publishWrite`,
`publishPageWrite` and `publishFrame` copied `silicaDraftTree` to the published
column without them. `publishState`, which writes the count on the Publish
screen, compared draft with published only, so a page whose draft and live
copy agreed, both stale, counted as nothing waiting.

## The fix

In `site-service.ts`:

- `publishWrite` heals every page (`healPagesTx`) and every layout
  (`healFramesTx`) before it copies them, and writes the healed draft back,
  exactly as opening each page would. Publishing is the owner's own act, so the
  platform still never changes a live site she did not publish.
- `publishPageWrite` and `publishFrame` heal the one page or frame they publish.
- `publishState` counts a page as waiting when publishing would repair it
  (`awaitsRepair`), and the frame when publishing would repair it
  (`frameAwaitsRepair`). The screen now names every page a publish will change.

## Proof

- `site-service-publish-heal.test.ts`, 4 cases, driving the real `publish` and
  `publishState` over a page stamped the old way and never opened: the published
  tree is the repaired one; the draft is written repaired too; the page is
  counted and named as waiting; a page already right counts nothing.
- Red: copying drafts without the heal, and counting draft against published
  only, fail 3 of the 4. Restored, 4 of 4. The builder's services suite passes,
  195 tests. Lint, format and the builder typecheck are clean.
- On screen: the Publish screen went from "1 page has changes" to "7 pages have
  changes", naming Home, Shop, Each product, Contributors, Each author,
  Subscribe and Archive. After Publish everything it read "Everything you have
  saved is live", so a repaired page does not keep counting as waiting. On the
  live site the header, page heading and footer start on one edge (issue 950).
- The first press of Publish everything failed with "Your site could not be
  published": api-rest answered 503 while it restarted for this change. The
  next press worked.
