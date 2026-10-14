# 974 — The content list printed the wrong address

**Status:** fixed (standing checks)
**Severity:** minor
**Found by:** P09 · The Marrow Review · standing checks
**Surface:** mypiggles › Content (both consoles)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · standing checks
**Blocked on:** —

## What happened

Under each title the list printed an address:
**/a-correction-to-the-last-mill-on-the-nene**. Her articles live at **/articles/...**.
Typed into a browser, the address in her own list is "not found".

## The fix

`entryHref` (moved to `surfaces/cms/routable.ts`, both consoles) gives the address the
piece's own Web address box shows. The list prints it, and prints nothing for a kind
her site shows nowhere. The Link box (971) uses the same rule.

## Proof

`entry-href.test.ts`, both consoles. On screen: "/articles/the-last-mill-on-the-nene",
"/cookie-policy" for a page, "/blog/..." for a blog post.
