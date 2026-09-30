# 707 — The spreadsheet she is emailed is written for a database

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 248
**Surface:** mypiggles + sparx — every inventory report, and the counting sheet
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen and in the bytes
**Blocked on:** —

## What happened

Devi set up a monthly report, called it "What the rail is worth this month", and
pressed **Send now**. The file that arrives:

```
total_units,total_allocated,total_available,total_cost_cents,total_retail_cents,non_owned_units,non_owned_value_cents,currency
498,12,486,193456,4106600,0,0,USD
```

She has **$1,934.56** of stock. The number she opened the file for is the one
thing it does not contain.

## Why it matters

```
reports in the registry                          19
header cells across them                        169
of those, with an underscore in                  95
of those, ending in _cents                       24
```

This console spends its entire vocabulary keeping a database word off the
screen. **"Free to sell", "On the shelf", "Not fit to sell", "Spoken for"** —
and then mails her `total_allocated`. [[feedback_non_technical_audience]]

`_cents` was worse than a name. The value was the stored integer, so every money
column in every report was out by a factor of a hundred for a person reading it,
with nothing on the row to say so. A column of `193456` is not a hard number to
read; it is the wrong number.

## What was changed

**Every header, in words.** 104 distinct headings, 169 cells, each a deliberate
label:

| was                          | is                                |
| ---------------------------- | --------------------------------- |
| `total_allocated`            | Units spoken for                  |
| `days_of_cover_with_inbound` | Days of cover with what is coming |
| `unattributed_units`         | Units with no sale attached       |
| `line_fill_rate_pct`         | Lines filled (%)                  |
| `abc_class`                  | Importance                        |
| `projected_stockout_at`      | Expected to run out               |

**Money reads as money.** A new `csvMoney` writes `1934.56`: two decimal places,
no symbol, no grouping separator. A spreadsheet reads that as a number and
`$1,934.56` as text, and a column of text cannot be summed. 24 columns, 24
conversions.

**The counting sheet too**, and that one had a contract to keep. It is the
artifact 10.6 promises will re-import, so its headings could not simply be
renamed: `on_hand` became **On the shelf** and the parser learned that spelling
in the same commit, as the FIRST alias for the field. `sku` → **Code**,
`warehouse` → **Location**, `unit_cost` → **Cost each**. Every old spelling is
still accepted, because a file a tenant exported last year must still go back in.

## Guarded

Two source-reading suites, because running a report needs a database and those
are the suites CI skips.

`report-csv-headings.test.ts` — no header may contain an underscore, end in
`cents`, or start lowercase, and it prints its own denominator so a refactor
that moves the registry fails rather than passing over nothing. It also asserts
the real bytes, from Devi's own figures:

```
Units on hand,Units spoken for,Units free to sell,Total cost,Total retail value,…
498,12,486,1934.56,41066.00,0,0.00,USD
```

Proved red by putting one header and one value back:

```
× 'valuation' writes its columns in words
    AssertionError: valuation has a column called "total_cost_cents", which is a database name
× sends money through csvMoney, every time
    AssertionError: expected 23 to be greater than or equal to 24
```

`adjustment-import-columns.test.ts` gained the round-trip guard the rename needed
and never had: **every heading the counting sheet writes must be a spelling the
parser reads back**. Proved red by removing one alias:

```
× reads the "On the shelf" column back in
    The counting sheet writes a "On the shelf" column and COLUMNS does not accept
    that spelling, so a sheet exported today no longer re-imports.
```

That check is the one that matters most here. The rename is right and it is
exactly the change that silently ends the round trip if the two lists are kept in
step by memory. [[feedback_a_promise_in_copy_is_a_contract]]
