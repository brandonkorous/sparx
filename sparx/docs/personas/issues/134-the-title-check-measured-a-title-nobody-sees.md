# 134 — The title check measured a title nobody sees

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9 (search title for About)
**Surface:** SEO page check (`@wizeworks/seo-audit`, api-rest `seo-audit.ts`); the title boxes in the editor and on the check; the site's `<title>`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty typed a 54-character search title for About. The box said "54 characters" and the check said the length was good. The live site served:

`About Gillett Diesel: Bluffdale diesel shop since 1986 · Gillett Diesel Service`

79 characters. The site adds " · <business name>" to every page title except the home page, unless the title already names the business. A search engine cuts a title at about 60 characters, so Doty's own words were cut, while both the box and the check told him it was fine.

## What should have happened

The box and the check count the title as search shows it, and say why it is longer than what was typed.

## Why it matters

Three places judged one title three ways. The owner follows the advice exactly and still gets a cut-off title.

## The fix

- `builder-schemas/src/served-title.ts`: the site's title rule (`namesTheSite`, `metadataTitle`, `socialTitle`) moved here from the site, plus `servedTitle(title, siteName, { home })`. The site's `lib/page-title.ts` re-exports it, so the site serves by the same rule the others measure by.
- `seo-audit`: `AuditableEntity.servedTitle`; the length check measures it and stores "79 characters as search shows it". The advice then says: "Search shows your title with your business name added after it, and a long title gets cut off. Shorten it, or write your business name into the title yourself and nothing is added."
- api-rest `seo-audit.ts`: a site page is measured under its own site's name (home page as written, using `pageService.isHomeRow`); a product, collection or CMS page under the primary site's name.
- Workbench `page-settings.tsx`: `titleLengthHint` and `shownTitle`, used by the editor's panel (hint and search-result preview) and the check's title box: "79 characters as search shows it, with “ · Gillett Diesel Service” added: the end may be cut off. Shorten it, or write your business name into it yourself and nothing is added."

Tests, each proved red:

- `builder-schemas/src/served-title.test.ts` (3): name added; nothing added when the title names the business; home page as written. With the home rule removed, 1 fails.
- `seo-audit/src/served-title.test.ts` (3): 79 as served fails with the business-name advice; 54 passes when nothing is added; a title long as typed keeps the plain advice. With the served title ignored, 1 fails.
- The site's `lib/page-title.test.ts` (10) passes through the re-export.

## Confirmed by

On screen, 2026-10-06, as Doty, on the About check: score 82, "Fix this first: Search shows your title with your business name added after it…", and under the box "79 characters as search shows it, with “ · Gillett Diesel Service” added…". He typed "About Gillett Diesel Service, Bluffdale, Utah since 1986": "56 characters", nothing added. Saved: 90, Excellent. The live page's `<title>` is exactly that.

## Rating effect

—
