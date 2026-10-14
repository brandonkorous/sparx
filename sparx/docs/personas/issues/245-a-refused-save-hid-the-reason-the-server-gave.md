# 245 — A refused save hid the reason the server gave, and said "try again"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · confirming issue 242 (Stock › Send something back, as Doty)
**Surface:** every save the server refuses for a business rule that names a field, in both consoles; first seen on Stock › Send something back
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** sparx as Doty and Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

Doty put together a return to Alliant Power: 2 × AP0002 (G2.8 injector seal kit),
arrived damaged, their return number RMA-77310. They left "Paid each" blank, as the form
says to: "Leave the cost blank and we will use what you paid." They pressed "Put the
return together".

The toast said: "Could not save that return. Nothing was changed. Please try again. The
problem is with Lines."

The server had said exactly what was wrong: "Nothing on record says what this item
cost, so the credit to expect cannot be worked out." Gillett has no cost on record for
AP0002, so there is nothing to "use what you paid" from. Trying again can never work.
Typing what was paid would have.

The screen threw the server's sentence away. The shared helper `apiErrorMessage`
(`lib/api-error.ts`, both consoles) drops the server's message whenever it thinks the
SCHEMA layer is talking about itself, and it decides that by "the error has per-field
details". Its own comment says "a service never does". That is wrong: every service
error mapper in `api-rest/src/app.ts` (CRM, site builder, builder, commerce, inventory,
email) passes the service's `details` through, and the inventory service names
`field: 'lines'` here. So any business rule that points at a field lost its reason and
showed the caller's "try again" instead.

The server's own detail line also read "recording a return worth £0", in pounds, for a
business in Utah, with the item's database id in it.

## What should have happened

The toast says the server's sentence, and the sentence tells Doty what to do: enter what
was paid for it.

## How to reproduce

1. Stock › Send something back. Supplier Alliant Power, from Warehouse (Concord Park).
2. Add AP0002 (no cost on record). Leave "Paid each" blank.
3. Put the return together.

## Why it matters

"Please try again" over a rule that will refuse every retry is a dead end. The owner
cannot know the fix is one box away. It is the same shape as issue 241: the server
answered, and the screen told a different story.

## Where it lives

- `sparx/apps/workbench/lib/api-error.ts` and `piggles/apps/workbench/lib/api-error.ts`:
  `schemaReportingOnItself`.
- `wizeworks/packages/inventory/src/services/supplier-returns.ts`: the message.

## The fix

`lib/api-error.ts`, both consoles: `schemaReportingOnItself` now tells the schema layer
by WHO is speaking. Zod always says "Request validation failed."; Fastify's own schema
check sends ajv entries that each carry a `keyword`. Anything else is a service
explaining a rule, and its sentence is shown, even when it names a field.

`inventory/src/services/supplier-returns.ts`: the sentence now ends with the fix ("Enter
what you paid for each one."), and the field note no longer says "£0" or carries the
item's database id.

Tests: `lib/api-error.test.ts` in both consoles gained two cases. "Shows a SERVICE
sentence that names a field" was red in both, and is green. "Still hides Fastify's own
schema report" holds the other side. Inventory package: 523 pass.

## Confirmed by

- sparx, Doty: AP0002 with "Paid each" blank. The toast said "Could not save that return.
  Nothing on record says what this item cost, so the credit to expect cannot be worked
  out. Enter what you paid for each one." With $38.50 entered it saved as RTV-000001.
- Piggles, Rosalind: NB-DOT-A6 with no cost, same sentence; with $2.40 it saved.

## Rating effect

Ease on Send something back: the refusal now says what to type.
