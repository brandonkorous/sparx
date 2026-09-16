# 485 — British pounds in an American console

**Status:** fixed
**Severity:** minor
**Found by:** Devi setting a quantity price with Fairfield Trims
**Surface:** six places in each console
**Filed:** 2026-09-09

## What was wrong

The Quantity prices card explains itself with an example:

> "£4.10 each, or £3.60 if you take fifty."

Directly underneath it, on the same card, in her own currency:

> $4.10 each below the first step

Two currencies, one card, four inches apart. Her books are in dollars, her
supplier is priced in dollars, and the sentence teaching her what the feature is
for is priced in pounds.

## Everywhere it appeared

| where                                   | what it said                                                          |
| --------------------------------------- | --------------------------------------------------------------------- |
| `inventory/supplier-performance-panels` | "£4.10 each, or £3.60 if you take fifty."                             |
| `inventory/performance`                 | a table heading reading **Earned per £**                              |
| `inventory/po-approval-rule-detail`     | the rule's DEFAULT NAME, `Orders over £1,000` — saved into the record |
| `inventory/po-approval-rule-detail`     | the same as the field's placeholder, and twice more in a warning      |
| `inventory/source-detail`               | "…when it means £12.50."                                              |
| `lib/tour/app-tours/people`             | "spent over £500"                                                     |

The spending-limit one is the worst of them: it is not a caption, it is the
default VALUE. A shop that accepts the suggestion has a rule named in a currency
it does not use, printed to a buyer whose order it holds.

## The fix

Dollars in all six, in both consoles. **Earned per £** became **Earned per $1**,
which also says what the ratio is. Comments in the source that use £ for an
example were left alone — nobody reads those but us.

## Proven

The Quantity prices card now reads "$4.10 each, or $3.60 if you take fifty."
above "$4.10 each below the first step".
