# 056 — 101 product photos stayed on Shopify, and the site showed none of his photos

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 3
**Surface:** workbench › Move in (any products file with photos); the live site's product pictures
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** third import of his file: 653 products, 777 versions, 0 errors; database: 0 pictures still pointing at Shopify, 0 products holding a photo twice, 0 products without a photo; all 618 photo files present in the folder the API serves from; live site search "L5P" shows 19 products, every card with its photo (tab :3004, 2026-10-01)
**Blocked on:** —

## What happened

Four faults, found together after the first import:

1. **The site showed no product photos at all in dev.** The importer saved each
   photo under its own folder (`import-worker/.media-local`), while the API that
   serves photos to the site reads `api-rest/.media-tmp`. Every image request
   returned "not found". 517 files had to be copied across by hand to see them.
2. **101 photos were never copied.** The importer used the 320 KB limit meant
   for photos sent through an AI assistant message. A normal product photo is
   larger, so 101 of his photos were saved as a link to Shopify's servers
   instead. When he closes his Shopify store, those 101 products lose their
   photos.
3. **A second import could never fix that.** The importer found the old link by
   address and reused it, and reported it as copied.
4. **Two different photos with the same file name were treated as one.** A photo
   was "already here" by name alone, so two products with an `image.png` would
   both show the first product's photo.

## What should have happened

Every photo in his file is copied into sparx, so his catalog does not depend on
the store he is leaving. A re-run fixes what an earlier run could not do. Each
product shows its own photo.

## Where it lives

- `wizeworks/packages/media/src/storage.ts`: the local folder was relative to
  whichever service was running.
- `wizeworks/services/import-worker/src/processors/images.ts`: `ingestImage`.
- `wizeworks/packages/media/src/asset-service.ts`: one size limit for every caller.

## The fix

- **One folder.** `localMediaRoot()` finds the repo root (`pnpm-workspace.yaml`)
  and uses `wizeworks/services/api-rest/.media-tmp` for every service, unless
  `MEDIA_LOCAL_DIR` says otherwise. Test `packages/media/test/local-root.test.ts`
  (red when the root is relative again).
- **The right limit.** `UploadImageBytesInput.maxBytes` lets a server-side copy
  use `MAX_PROXIED_UPLOAD_BYTES` (20 MB). The MCP limit stays 320 KB for MCP.
- **Fetch first, then decide.** `ingestImage` downloads the photo, then reuses a
  copy only when the file name AND the exact size match. A link from an earlier
  run is swapped for the real copy on every product using it, and the link is
  retired. If the photo still cannot be fetched, the link stays and the row says
  so.
- **Once per run.** A per-run memory stops a photo shared by 40 products being
  downloaded 40 times.
- The gallery brings every photo in first, then reads what the product already
  holds, so a swapped link is not hung twice ([055]).
- Tests: `import-worker/src/processors/images.test.ts`, 4 cases (link replaced on
  every product; link kept when the photo is gone; a same-name different photo
  is not reused; the same photo is reused). Each proved red against the old
  `ingestImage`.

## Rating effect

Move in: Ease deduction removed. Site product cards: photos present.
