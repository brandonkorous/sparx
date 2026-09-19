# 655 — "Download what you have" handed her a web page

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 230
**Surface:** Stock — Import from a spreadsheet, Stock grid, How it is performing
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 230 (downloaded, counted, uploaded, applied, undone)

## What she did

Devi opened **Import from a spreadsheet** and did exactly what it told her to:

> Download what you have, count the shelves, and upload it back. The differences
> become stock movements you can trace and undo.

She pressed **Download what you have**. A file arrived:

```
template.html    146,452 bytes
```

Opened in a text editor:

```html
<!DOCTYPE html><html lang="en" class="inter_c15e96cb-module__0bjUvq__variable …
```

It was the Piggles console. The whole page, script tags and all, offered to a
shop owner as the list of her own stock to count.

## The cause

`DownloadButton` was an anchor:

```tsx
render={<a href={importTemplatePath(warehouseId)} download />}
//            └─ returns the bare string `/v1/inventory/imports/template`
```

Two failures, and both of them are silent.

**The origin.** api-rest's address is only known at RUNTIME — `lib/api/client.ts`
resolves it from `/api/token` precisely so one image can be promoted between
environments. A relative href cannot reach a runtime origin. So the browser
asked **localhost:3022**, the console itself, which has no `/v1` route, and Next
answered with the app shell. 200 OK. A file appeared in Downloads. Nothing threw.

**The token.** Even pointed at the right origin it would have 401'd, because an
`<a href>` carries no `Authorization` header and no `x-sparx-property-id`. The
browser would then have saved the refusal under the same filename.

## It was already written down

`lib/api/download.ts` has been in the tree the whole time, and its header says:

> A plain `<a download href>` can't carry the Authorization header, so — exactly
> like `openServerHtml` — we fetch with the token, then hand the bytes to
> `saveBlob`.

`DownloadButton` was written afterwards, as an anchor, with its own careful
comment prizing the fact that right-click → save-as would still work. It never
could. [[feedback_screen_over_a_function_nobody_calls]]

## How far it reached

**Eight call sites, two consoles, every download in the Stock module:**

| surface                   | button                      |
| :------------------------ | :-------------------------- |
| Import from a spreadsheet | Download what you have (×2) |
| Stock grid                | Export                      |
| How it is performing      | Spreadsheet                 |

Finance and Staff were unaffected, because their exports were hand-written as
authenticated `fetch` calls in their own data modules, each about forty lines,
each duplicating the other. They are the reason the right pattern was already
known and the reason nobody noticed Stock was not using it.

## Fixed

`DownloadButton` is a real button over `downloadServerFile`, so all eight call
sites are fixed at once and so is the ninth, written next month. `href` is now
`path`, because a prop called `href` on something that is not a link is how this
happened. Finance and Staff delegate to the same helper, which removes about
eighty lines of duplicated fetch-and-save and gives them the same refusal
handling.

The helper gained two things it should always have had: it reads
`Content-Disposition` for the file's real name, rather than saving under the
caller's fallback (the bug already documented in `exposed-headers.ts`, where two
months of an accounting export saved over each other), and it rebuilds a refusal
as a real `ApiError`, so a failed download says the server's own sentence in a
toast rather than being completely silent.

Driven on screen, the whole loop, in Devi's own account:

```
inventory-stock-count.csv    3,524 bytes    74 rows
sku,item,warehouse,on_hand,note
ASH-OVERSHIRT,The Ash Overshirt,MAIN,6,
```

Named by the server, not by the fallback. Three rows edited as a stock count,
uploaded, previewed (`74 rows read · 74 matched · 71 already correct · 0 to sort
out`), applied, and then undone. The ledger:

```
-2  Two went to the window display (imported from juniper-row-count.csv, row 3)
+2  Undo of import row 3
```

## Guard

`pnpm check:api-hrefs` — no `href` in either console may point at api-rest. It
catches the literal (`href="/v1/…"`) and, because that is the shape this defect
actually wore, it first reads both consoles for helpers whose body RETURNS an
api-rest path and then flags any href bound to one. It found six such helpers and
no offending href.

Proved red four ways:

1. the ACTUAL defect put back (`href={importTemplatePath(…)}`) → named
2. a literal `href="/v1/…"` → named
3. a comment that mentions a bad href must not count as one → still green
4. a scan root moves → exits 1 rather than passing over nothing
   [[feedback_structural_checks_go_blind]]

The comment stripper it needs is the same one `check:orphan-surfaces` needed, and
for the same reason, so it now lives in `scripts/lib/strip-comments.mjs` with the
two ways it has already gone wrong written above it.
[[feedback_codemod_diff_your_own_sweep]]

## Also: the column she was invited to fill went nowhere

The template Piggles hands out ends with a `note` column. The parser has always
recognised it under three spellings — `note`, `notes`, `comment`. And
`COLUMNS.note` was passed to `read()` exactly never, so the value was dropped at
parse time. Every movement said:

> Imported from juniper-row-count.csv, row 3

whatever had been written beside the count. On a stock-take that is the entire
point of the column: somebody counts a rail, finds two missing, writes down why,
and the one explanation anybody would ever want is typed, uploaded, parsed and
thrown away. [[feedback_fetched_but_never_rendered]]

The note is now carried on the plan row, shown in the preview under a **Why**
column (only when the file has notes — a column of dashes reads as something
missing), and written to the movement with her words FIRST:

> Two went to the window display (imported from juniper-row-count.csv, row 3)

Her words first because the stock history truncates that cell to about thirty
characters, deliberately and for good reasons (issue 558). "Two went to the
window di…" answers the question. "Imported from juniper-row…" does not.

Guarded by `adjustment-import-columns.test.ts`: every key in `COLUMNS` must be
passed to `read()` somewhere in the file. It reads the source rather than
exercising the parser, so a column added next year is covered the moment it is
added, and it asserts the list is not empty so it cannot pass over nothing.
Proved red by putting the defect back: 9 passed, 1 failed, naming `note`.

## Also: the choice that decides shrinkage was cut in half

**Record these as** is a native select, and at 360px its longest option

> A stock count: differences count as shrinkage

rendered as **"A stock count: differences count"** — clipped at the exact word
the sentence was written to reach. That control decides whether a difference
lands in the shrinkage report.

The consequence has moved out of the option and into a line under the select,
where it has the full width of the pane and cannot be clipped at all, matching
the Location field directly above it. The option is now just the name of the
choice. While rewriting it the copy was corrected against
`services/shrinkage.ts`: only a NEGATIVE recount is shrinkage, and a positive one
is reported beside it rather than netted off, which the old one-line label could
not have said.

## Files

- `piggles|sparx/apps/workbench/components/download-button.tsx`
- `piggles|sparx/apps/workbench/lib/api/download.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/{stock-import,stock-grid,performance}.tsx`, `reporting-data.ts`
- `piggles|sparx/apps/workbench/surfaces/finance/spend-data.ts`, `surfaces/staff/data.ts`
- `wizeworks/packages/inventory/src/services/adjustment-import.ts` (+ `adjustment-import-columns.test.ts`)
- `wizeworks/packages/commerce-schemas/src/reporting.ts`
- `scripts/check-api-hrefs.mjs` (new), `scripts/lib/strip-comments.mjs` (new), `scripts/check-orphan-surfaces.mjs`, `package.json`, `.githooks/pre-push`
