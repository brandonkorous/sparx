# 730 — Type USD for dollars

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 259
**Surface:** mypiggles + sparx workbench — the nine Currency fields in each console
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: the price sheet's Currency reads "US Dollar (USD)"
**Blocked on:** —

## What happened

Opening the trade price sheet to read the copy rewritten in
[723](723-the-other-half-of-the-rename.md). Under the note, the Currency field
said:

> **Currency**
> USD
> _The currency every price on this list is set in._

A code. The same thing [721](721-type-de-for-germany.md) was filed about, in a
different column.

## Why it matters

`lib/geo.ts` fixed the country half of this and its header says why: **a shop
owner should never SEE a code.** Money had no such module.

**MEASURED 2026-09-19: nine Currency fields per console, doing four different
things.**

| what it was                          | where                                                                |
| ------------------------------------ | -------------------------------------------------------------------- |
| a list of NAMES, "US dollars"        | Gift cards                                                           |
| a list of BOTH, "US Dollar (USD)"    | Selling settings                                                     |
| a list of CODES, "USD"               | Special prices, Bookings                                             |
| an empty BOX, three letters, no list | How stock is valued, a supplier, a deal, a thing you track, a course |

So **"US Dollar" was already written down twice, in two different spellings**,
and five screens still asked her to know that dollars are USD.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## The box was worse than untidy

`lib/money-format.ts` exists because of one of those boxes. Its header:

> "How stock is valued" has a Currency field a business owner types into, three
> characters, no validation on the way out. … so three characters typed into a
> settings field took out every money figure on the screen, as a thrown render
> rather than a wrong number.

That fix is a FLOOR: it makes a bad code render as `123 12.50` instead of
crashing. It never stopped the bad code being typed, and nothing else did
either — the schema behind these fields is

```ts
export const Currency = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/);
```

three letters and nothing more. **ZZZ saves, syncs, and prints on an invoice
forever.** A list of names has no such state.
[[feedback_never_present_absence_as_measurement]]

## What was done

**`lib/currency.ts` is the one place that knows.** Same shape as `lib/geo.ts`:
the 162 ISO 4217 codes this platform can name, with names from the platform's
own `Intl.DisplayNames` rather than a hand-kept table, so they stay correct and
localise for free.

**The label carries the code, in brackets.** A country picker does not need one
because nobody writes an invoice in "DE", but a business owner reading a
supplier's paperwork sees USD on it and has to match the two up. Selling
settings had worked that out already; this is that spelling, everywhere.

**`components/currency-field.tsx`** is the control, beside `country-field.tsx`.
All **18 fields** across the two consoles use it.

**A stored value we cannot name is KEPT**, offered back marked
`ZZZ (not a currency we know)`. Opening a picker must not change her data.
[[feedback_honor_the_users_choice]]

**Two width caps went with them**: `max-w-40` on the price-sheet picker and
`max-w-32` on Bookings, both of which clip "United Arab Emirates Dirham (AED)".
The same fault as [720](720-a-width-we-chose-on-a-name-she-typed.md), on a list
that was too short to show it.

**The typed box's error line is gone and its Save guard stays.** Nothing can be
typed wrong now, but a value stored before today can still be unusable, so the
Save button is still held and the field now says what to do about it: "Pick a
currency from the list."

**A service keeps its currency lowercase**, which is that module's own shape.
The two call sites put the case back rather than the picker learning about it.

## Files

- `piggles|sparx/apps/workbench/lib/currency.ts` — new
- `piggles|sparx/apps/workbench/lib/currency.test.ts` — new, 5 tests
- `piggles|sparx/apps/workbench/components/currency-field.tsx` — new
- 9 surfaces per console
- `scripts/check-currency-picker.mjs` — new, wired into pre-push

## Proof

Take out the line that keeps an unnamed value: 1 of the 5 new tests fails.
Restored: 1,010 piggles tests and 880 sparx tests pass.

Put a typed box back on the supplier form: the check exits 1 naming the file and
the line. Restored: `18 Currency fields in the two consoles, and every one of
them is a list of currency names.`

On screen: the trade price sheet reads **Currency for these prices · US Dollar
(USD)**, full width, and the list opens on the selected row with every currency
named. Both typechecks and ESLint clean; all sixteen structural checks pass.
