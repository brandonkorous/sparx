# 721 — Type DE for Germany

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 253
**Surface:** mypiggles + sparx workbench — every address form in both consoles
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: the Locations address reads "United States" from a list, and typing "germ" finds Germany
**Blocked on:** —

## What happened

Opened **Fulfillment Center** under Locations to read what is on it. Under the
address, where it asks for the country, there was a two-character box and this
sentence:

> The two-letter country code: GB for the United Kingdom, US for the United
> States, DE for Germany.

She makes clothes. That line asks her to learn a filing system before she can
write down where her own stock is.

## Why it matters

`lib/geo.ts` has said so in its own header since it was written:

> The wire format everywhere is ISO codes ("US", "US-CA") because that is what
> the schemas validate and what carriers and tax engines speak. **A shop owner
> should never SEE a code**, though, so this module is the one place that turns
> a code into a real name.

It already exported `countryOptions()`, described in its own comment as "the
shape the Select `items` prop wants". **Two screens read it** — shipping zones
and tax zones. Every other address form asked her to type.
[[feedback_a_fix_leaves_its_neighbour_behind]]

**MEASURED 2026-09-19:** 7 address forms per console, 14 in total, each a hand
typed country code. Five of them said "Two-letter country code" underneath. One
said nothing at all.

**And the drift is already in the data.** The scheduling address gave no
guidance, so:

```
scheduling_locations   country = "United States"   1 row
customer_addresses     country = "US"             88 rows
inventory_warehouses   country = "US"             72 rows
inventory_suppliers    country = "US"              9 rows
```

"United States" is not a country code. No shipping zone, no tax zone and no
carrier will ever match it, and nothing anywhere said so. The one place that
could turn a name into a code was the module nobody was reading.
[[feedback_never_present_absence_as_measurement]]

## What was done

**`lib/geo.ts`** — moved out of `surfaces/commerce/`, where being a commerce
file is the whole reason its rule reached two screens. It is a console-wide
thing now, beside `lib/timezones.ts`.

**`components/country-field.tsx`** — new, in both consoles. Every country by
name, handing back the code. Two details it has to get right:

1. **An existing value that is not a code is KEPT**, offered as its own option
   and marked. A picker that dropped "United States" would change her data by
   being opened. [[feedback_honor_the_users_choice]]
2. **A way back to blank** when the field is optional, so the picker can do
   everything the box could.

**All 14 fields converted.** Locations, customer addresses, suppliers, business
details, the partner profile, bootcamps and the scheduling place, in both
consoles.

**The sentences that taught the codes are gone.** The customer address error
used to read "Use the two-letter country code, like US or GB" in red under a box
she had no way of filling in correctly without knowing the rule; it now reads
"Choose the country." The Locations warning said "a street address, a town or
city, and a two-letter country code are needed"; it now says "a country".

**`scripts/check-country-picker.mjs`** — new, wired into
`pnpm check:country-picker` and pre-push. A field labelled Country must not be a
text box. It prints the denominator.

## Files

- `piggles|sparx/apps/workbench/lib/geo.ts` — moved from `surfaces/commerce/`
- `piggles|sparx/apps/workbench/components/country-field.tsx` — new
- 7 surfaces per console, plus the 4 commerce importers the move touched
- `scripts/check-country-picker.mjs` — new, wired into pre-push

## Proof

Put a typed `<Input>` back under a Country label: the check exits 1 naming the
file and the line. Restored: `18 Country fields in the two consoles, and every
one of them is a list of country names.`

On screen, Locations: the field reads **United States**; opening it lists
countries by name with United States ticked; typing `germ` moves to **Germany**
and picking it turns the amber warning on, because the street address is still
blank. Picking United States again clears it, and the stored value is still
`US`. 999 piggles tests and 873 sparx tests pass; both typechecks and ESLint
clean.
