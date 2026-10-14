# 962 — "Import subscribers" found no import

**Status:** fixed (act 10)
**Severity:** minor
**Found by:** P09 · The Marrow Review · act 10
**Surface:** mypiggles › the Ctrl K box; Stock › Import from a spreadsheet (both consoles)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 10
**Blocked on:** —

## What happened

She typed **import subscribers**. The only answer was the saved group "Newsletter
Subscribers". She typed **import** alone. The first answer was **Import from a
spreadsheet**, which opened onto "Main Warehouse", "A stock count" and "shrinkage": the
stock import, on a journal. The tool for her list, "Move in from somewhere else", was
third.

## The fix

- `lib/surfaces/catalog/platform.ts`: "Move in" now answers to three more phrases:
  "import subscribers", "import my mailing list" and "move my newsletter list". "import my
  email list" was tried and dropped: it made "email my customers" open the import
  instead of campaigns.
- `lib/surfaces/catalog/inventory.ts`: the stock import is **Import stock from a
  spreadsheet**, and its toolbar label says the same.

## Proof

`launcher-owner-phrases.test.ts`: "import subscribers" and "import my mailing list" put
"Move in" first; without the words, both redden. Console launcher tests pass (piggles
106, sparx 113). On screen: "import subscribers" answers "Move in from somewhere else"
first.
