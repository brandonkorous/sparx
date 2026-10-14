# 949 — Her archive could not be browsed by date

**Status:** fixed (act 6)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 6, building the archive her brief asks for
**Surface:** her public site, mypiggles › My Site › a page › Insert (both consoles), the public content API
**Filed:** 2026-10-08
**Fixed:** 2026-10-08
**Confirmed by:** P09 · act 6, `/archive` showing "2026 · 5 pieces" and October 2026 with all five, desktop and 360px
**Blocked on:** —

## What happened

Her brief: "Archive: browsable by date and section, and it must stay browsable at
200 pieces." Section was covered (Field, Table and Ledger pages, issue 946). Date was
not: the only list of her writing is newest first, 24 to a page, with "older" and
"newer". At 200 pieces a reader looking for something from last spring pages through
eight screens with no idea which one holds it. Nothing in Insert lists writing by
when.

## The fix

- **Archive by month** (Insert › Your writing): a row of years, each with how many
  pieces it holds; then the chosen year month by month, newest first, each piece as
  its date, its section and its headline, linked. One year at a time, so 200 pieces
  read as a few dozen lines. Each year has its own address (`/archive?year=2025`).
- Months fall on the business's own clock: a piece out at 00:30 on 1 October in
  London is in October.
- It lists every kind the site serves (articles, blog posts, any kind with an
  address), and leaves out anything a reader could not open.
- `GET /v1/public/content/archive` answers it, published and site-scoped. The block
  lines up with the page's sections and keeps its list to a reading width.
- The owner can delete it like any list she placed (it guards no transaction).

## Proof

- `archive.test.ts` (api-rest), 4: the business clock, years newest first, one year
  by month with section and address, other years and unopenable pieces left out.
  Grouping on the server's clock reddens 1.
- `site-chrome.test.ts`: the archive is on the list of blocks an owner may delete,
  with the reason.
- On screen, as Rosalind: a page **Archive** (Page top in her words, then Archive by
  month), published, linked from the footer after Journal, with its own search title
  and description. `/archive` reads "2026 · 5 pieces", then "October 2026" with her
  five pieces: "October 8 · Ledger · Price, weather, war: reading a commodity chart
  badly" and the rest. Checked at 360px.
- Check my site: "Nothing to fix across 18 pages."

## Still open

- Not exercised at 200 pieces: she has five. The read caps a year at 2,000.
