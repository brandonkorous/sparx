# 920 — Removing practice data left the design's booking rules behind

**Status:** fixed (act 325)
**Severity:** minor
**Found by:** P03 · Juniper Row · act 325, while fixing [085](085-her-price-list-had-two-of-everything-at-two-different-prices.md) for Halo & Hem
**Surface:** mypiggles › Bookings › Setting it up › Booking rules and Places
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** a database test with the real Salon (Editorial) design, proven red twice; a read-only measure of Halo & Hem
**Blocked on:** —

## What happened

A design's booking content is installed only as practice data (issue 098): its
places, its booking rules, its people and its services. Since act 325 the
services and people carry the practice mark, so "Remove practice data" takes
them away. The booking rules and the place do not: neither table has a column
to hold a mark, so they stay.

At Halo & Hem today:

| Booking rule       | Services using it |
| ------------------ | ----------------- |
| Standard           | 1                 |
| Salon cancellation | 6                 |
| Standard booking   | **0**             |
| Colour deposit     | 3                 |

"Standard booking" is the Salon (Editorial) design's example rule. Nothing uses
it, and it sits in her list of rules beside her own. On a business that installs
the design and then removes the practice data, both of the design's rules and
its place ("Maison Élan") are left with nothing on them.

## What should have happened

"Remove practice data" removes everything the practice load made, and says so
before it does.

## The fix

- **Find them without a column.** The design's install record keeps the ids of
  the rules and places it used (`result.scheduling.policies` and `.locations`).
  It also keeps ones it REUSED by name, such as the business's own "Main
  location", so only rows created after the install started count as the
  design's.
- **Remove only what nothing uses.** A rule no service or booking names; a place
  no service, person, booking or closure names. A rule the owner put her own
  service on is hers now, the same rule act 325 gave services and people.
- **Say so first.** Two counts beside Services and People and equipment in both
  consoles: Booking rules and Places, by the same rule.
- **Care with places.** A place can be a pickup point or carry opening hours for
  other apps; check every table that points at `scheduling_locations` before
  deleting one.

## What changed (same act)

Built as described above, in `engine/practice-bookings.ts`:

- `designExamples` reads every install that brought practice data and keeps
  the rules and places in its record that were created after the install
  began. A rule or place the design reused by name is older, and is never
  touched.
- `removableRuleWhere` and `removablePlaceWhere` keep anything a real service,
  person, booking or closure still uses. Clear decides which ones go BEFORE it
  deletes anything, by the same rule the count uses.
- Two new counts in both consoles, **Booking rules** and **Booking places**,
  named "Booking" so they do not read like the stock Locations that Remove
  keeps.
- On the way: the sentence a Remove confirmation is built from lowercased each
  label, so it said "1 products" and "ai prompts". Every label now has its own
  one and many forms, in both consoles.

## Proof

`sample-salon-design-one-menu.test.ts`, with the real design: the business
already has a rule named like the design's first one. Before Remove the screen
counts 1 booking rule and 1 booking place; after it, only her own rule is left
and no places. Red against the engine without this change (no count), and red
again with only the rule delete taken out. Measured read-only at Halo & Hem:
"Standard booking" was made by the design and nothing uses it, so Remove would
list and take it; "Colour deposit" was made by the design but 3 of her services
use it, so it stays. Sparx console count tests: 6, including the singular and
the capital "AI".

## Rating effect

Not scored. Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
