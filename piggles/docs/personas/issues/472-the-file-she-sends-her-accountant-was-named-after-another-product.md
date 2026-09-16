# 472 — The file she sends her accountant was named after another product

**Status:** fixed
**Severity:** major
**Found by:** the real filename becoming visible for the first time, after [469](469-every-warning-a-download-carried-had-never-been-shown.md)
**Surface:** `finance.accounting` (both consoles) · `@wizeworks/finance` export
**Filed:** 2026-09-09

## What was wrong

```ts
filename: `sparx-expenses-${provider}-${isoDate(from)}-to-${isoDate(to)}.csv`;
```

Devi's export downloaded as **`sparx-expenses-csv-2026-08-01-to-2026-08-31.csv`**.

She has never heard of sparx. She uses Piggles. And this is not a screen she can
look away from — it is the one artifact in the whole product that **leaves it**:
she emails it to her bookkeeper, who files it, and now a third party has a
document naming a product that is not the one their client is paying for.

`check:piggles-nav` exists to stop sparx's words reaching a Piggles surface, and
it was green. It scans console sources. This string is in a shared package and
never renders on a screen — it renders in a Downloads folder, which is not a
place any check was looking.

The timesheet export in the very next module already had this right:
`hours-2026-09-01-to-2026-09-09.csv`. No product name, named for what it holds
and the period it covers.

## The secondary silliness

`-csv-` in the middle is the provider slug for the generic "Spreadsheet / your
accountant" layout, so the name read `expenses-csv-….csv`. The layout belongs in
the name only when it IS one, because two exports of the same month for different
packages must not collide.

## The fix

```ts
filename: `expenses-${provider === 'csv' ? '' : `${provider}-`}${isoDate(from)}-to-${isoDate(to)}.csv`;
```

- `expenses-2026-08-01-to-2026-08-31.csv` for the generic layout
- `expenses-quickbooks_online-2026-08-01-to-2026-08-31.csv` for a package

The comment above it says the two reasons there is no product name: the file
leaves the product, and two consoles under two brands download it.

## Proven

The download toast, which shows the server's filename now that
`content-disposition` is readable, named
`expenses-2026-08-01-to-2026-08-31.csv`. The integration test asserting the old
name was updated to assert the new one, with the reason attached.
