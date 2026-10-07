# 130 — Site pages could not be found from search

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 9 (finding the About page to change its words)
**Surface:** workbench › Search everything; `@wizeworks/commerce` universal projectors; `@wizeworks/builder` page and site services; `@wizeworks/links` routes; `DELETE /v1/properties/:id`
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Doty typed "About" into "Search everything" with the About page open in the editor behind the box. The box answered "Nothing in your records matches". The same for "Each product", "Wholesale" and every other page of his site.

The search code said why in its own header: "CMS and Site Builder are still outstanding." Articles and policy pages had since been added. Site pages never were: no search entry, no signal on save, and no link from a result to the editor.

## What should have happened

A page is found by its name, its address or its search-engine title, and the result opens the editor on that page.

## Why it matters

The box promises to search everything, and it says "Nothing in your records matches" without a caveat. An owner who cannot find their own About page reads that as the page being gone.

## The fix

- `commerce/src/universal-projection.ts`: a `builder_page` entry. Title is the page name. The subtitle says where it sits and on which site: "/about · Gillett Diesel Service", "Every page under /products/ · Gillett Diesel Service" for the page that shows every product (`pageAddressWords`). Keywords: the address, the search title, the site name. Status: published or draft. Address: `/builder?pageId=<page>&site=<site>`.
- `links/src/routes.ts`: `/builder` is the home of `builder_page`, under the heading "Site pages".
- `builder/src/services/page-search.ts`: `withPageSearch` runs a write, then signals every page the site held before or holds after. A removed page is signalled too, and its empty projection removes its entry. Wrapped: `create`, `update`, `remove`, `publish` in `page-service.ts`; `sync` (the editor's save, and through it the MCP page tools), `reset`, `publishPage`, `publish`, `installSite`, `addPage` in `site-service.ts`. The three reads that create starter pages (`load`, `listOrSeed`, `ensureHome`) signal what they create.
- `api-rest/src/routes/v1/properties.ts`: deleting a site reads its page ids before the cascade and removes each from search.
- Workbench `components/launcher-entries.ts`: a page on another site switches the window to that site first (with the unsaved-work question), then opens the page. Opened in place, the editor would show the current site's pages and the owner would edit the wrong business. Piggles has no site editor, so its box drops these results.

Tests, each proved red:

- `commerce-indexer/test/integration/site-page-projection.test.ts` (database, 5): listed for a rebuild; name, address, search title and site; the every-product wording; draft status; gone once deleted. With the projector out of the list, 5 of 5 fail.
- `builder/src/services/page-search.test.ts` (4): removing a page signals the site's pages including the removed one; every named writer is wrapped; the seeding reads signal. With `remove` unwrapped, 2 fail.
- `links/src/site-page-link.test.ts` (3): the route, the editor opened on the page with its site, and no page opened that the address does not name. Without the route's `entity`, 3 fail.
- `api-rest/test/integration/site-delete-removes-page-search.test.ts` (database): deleting a site signals a delete for each of its pages. With the loop emptied, it fails.
- `scripts/check-search-entities.mjs` read the new projector as unrouted and unsignalled until both were added: "2 of 32 cannot be found or opened". Now "32 projectors, all routed; 32 signalled on write".

## Confirmed by

On screen, 2026-10-06, as Doty, after `ops:reindex-search` for Gillett: all 12 pages are in the index. "Search everything" › "About" shows "Site pages › About, /about · Gillett Diesel Service"; clicking it opens the editor on the About page. Without a rebuild: Doty added a "Locations" page and saved; search held "Locations, /locations · Gillett Diesel Service, draft" a moment later, and "published" after Publish.

## Rating effect

—

## Deploy note

Existing pages reach search only through a rebuild. Run `pnpm --filter @wizeworks/api-rest ops:reindex-search -- --apply` for every tenant after release.
