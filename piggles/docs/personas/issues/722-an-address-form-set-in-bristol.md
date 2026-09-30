# 722 — An address form set in Bristol

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 253
**Surface:** mypiggles + sparx workbench — Locations, and the Bookings place form
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: the Locations address shows "123 Main St" and "+1 555 010 0000"
**Blocked on:** —

## What happened

Found beside [721](721-type-de-for-germany.md), on the same screen. Devi's
business is in Columbus, Ohio. Her Locations address form showed her, in grey,
what to type:

| field           | the example      |
| --------------- | ---------------- |
| Street address  | 14 Mill Lane     |
| Town or city    | Bristol          |
| County, state…  | Somerset         |
| Postcode or ZIP | BS1 4RW          |
| Country         | GB               |
| Phone           | +44 117 496 0000 |

Six fields, one coherent address, and it is in England. The Bookings place form
does the same thing: "14 High Street", "High Street shop", and a map pin
pre-filled with `51.5072` / `-0.1276`, which is **London**.

## Why it matters

It is not a big thing on its own. It is a small, constant signal that the
product was built somewhere else and she is a guest in it. The memory rule is
one line: [[feedback_american_spelling]] — "we are in america".

It is also the only form in the console that does it. Every other address form
already used US examples:

| form                | country example        |
| ------------------- | ---------------------- |
| Business details    | US                     |
| Customer addresses  | US, `123 Main St`      |
| Suppliers           | US, `1 Trade Park Way` |
| Partner profile     | US                     |
| Bootcamps           | US                     |
| **Locations**       | **GB**                 |
| **Bookings places** | none, `14 High Street` |

So the rule was already settled and two files had not been told.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## What was done

The house pattern is ONE example on the street line and nothing on city, region
or postcode, because the labels carry those. Both files now follow it:

- `14 Mill Lane` and `14 High Street` → **`123 Main St`**, matching the customer
  address form exactly.
- `Bristol`, `Somerset` and `BS1 4RW` → removed. "Postcode or ZIP" already says
  what the field is, and any single example is wrong for most of the world.
- `+44 117 496 0000` → **`+1 555 010 0000`**, in the reserved range, matching the
  console's other phone example.
- The London map pin → `40.7128` / `-74.0060`.
- `High Street shop` → `Main Street shop`.

The country box itself became a picker in [721](721-type-de-for-germany.md), so
`GB` is gone with it.

## Files

- `piggles/apps/workbench/surfaces/inventory/location-address.tsx`
- `sparx/apps/workbench/surfaces/inventory/location-detail.tsx`
- `piggles/apps/workbench/surfaces/scheduling/location-address.tsx`
- `piggles/apps/workbench/surfaces/scheduling/location-form.tsx`
- `sparx/apps/workbench/surfaces/scheduling/location-detail.tsx`

## Proof

Grepping both consoles for `High Street`, `Mill Lane`, `Bristol`, `Somerset`,
`BS1 ` and `+44 ` now returns nothing outside the note in
`country-field.tsx` that quotes the old copy. On screen: Street address reads
`123 Main St`, Phone reads `+1 555 010 0000`, and the postcode box is empty with
its label doing the work.
