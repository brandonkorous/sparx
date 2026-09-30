# 712 — Three characters that could take out every price

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 250
**Surface:** mypiggles + sparx — Stock › How stock is valued, and every money figure downstream
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: the field refuses it and Save goes grey
**Blocked on:** —

## What happened

**How stock is valued** has a Currency field. Three characters, free text,
`maxLength={3}`. The sentence under it says "A three-letter code: USD, GBP, EUR."

Nothing enforced the letters. The schema behind it was:

```ts
export const CurrencyCode = z.string().trim().length(3).transform(toUpperCase);
```

Length, and nothing else. So `123` saved cleanly. So would `$$$`.

## Why it matters

`Intl.NumberFormat({ style: 'currency', currency })` does not shrug at those. It
**throws**:

```
'USD'  ->  "$12.50"
'usd'  ->  "$12.50"          case does not matter to Intl
'ZZZ'  ->  "ZZZ 12.50"       not a currency, but it survives
'123'  ->  RangeError: Invalid currency code : 123
'$$$'  ->  RangeError: Invalid currency code : $$$
'   '  ->  RangeError: Invalid currency code :
```

And the delivery pane does this:

```
{formatCents(receipt.goodsValueCents, receipt.baseCurrency)}
```

So three characters typed into a settings screen take the delivery pane out — not
as a wrong number, as a **thrown render**. An error boundary where a delivery
should be.

**MEASURED 2026-09-19, across the packages and both consoles:**

|                                           |        |
| ----------------------------------------- | ------ |
| currency validators checking `.length(3)` | **27** |
| of those that also check LETTERS          | **3**  |
| `Intl` currency formatters                | **88** |
| of those fed from a variable              | **81** |
| of those inside a `try`                   | 13     |

A rule written down in three places and missing from twenty-four. The same shape
as every other defect this week.

## What was done

**The door.** All 24 validators now require three letters, with one message:

```ts
.regex(/^[A-Za-z]{3}$/, 'A currency code is three letters, like USD or GBP')
```

They repeat the rule rather than sharing a symbol, and that is recorded rather
than pretended: `partner-schemas`, `scheduling-schemas`, `staff`, `finance` and
`blueprints` do not depend on any package that could hold a shared `CurrencyCode`,
and adding one is a dependency, which is an install.

**The floor.** `lib/money-format.ts` in each console: one guarded formatter, one
cache, and every one of the 33 one-line money helpers now calls through it
instead of building its own. A code it cannot use degrades to `123 12.50` — the
number AND the raw code, deliberately **not** a silent fallback to dollars.
Printing `$12.50` for a currency nobody could read is inventing a fact; showing
the code is what lets somebody see what is wrong and go and fix it.
[[feedback_never_present_absence_as_measurement]]

**The field.** It says so before Save rather than after, because a server refusal
arrives as a toast on a screen she has already left. Red field, one sentence,
Save disabled.

## Files

- `wizeworks/packages/{commerce-schemas,crm-schemas,crm,commerce,field-schema,finance,partner-schemas,scheduling-schemas,staff,blueprints}` — 24 validators
- `wizeworks/services/api-rest/src/routes/{internal/operator-billing,v1/commerce/pricing,v1/inventory/reporting,v1/tenant-business}.ts`
- `piggles|sparx/apps/workbench/lib/money-format.ts` — new, plus its test
- 39 surface files routed through it
- `piggles|sparx/apps/workbench/surfaces/inventory/costing-settings.tsx`

## Proof

Typed `123` into the field on screen: it goes red, says _"Three letters, like USD
or GBP. Anything else and we cannot draw a price in it."_, and **Save is
disabled**. Typed `USD` back: clean. Nothing was written.

The test asserts both halves, including that a bare `Intl.NumberFormat` really
does still throw on those inputs — so if it ever stops, the module is not quietly
protecting against nothing. [[feedback_a_test_that_cannot_go_red]]
