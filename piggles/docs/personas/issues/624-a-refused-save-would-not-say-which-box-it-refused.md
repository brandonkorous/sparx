# 624 — A refused save would not say which box it refused

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 208
**Surface:** mypiggles › every screen that saves anything (83 call sites)
**Filed:** 2026-09-17
**Fixed:** 2026-09-17

## What happened

Every write in this console reports a refusal through one helper,
`apiErrorMessage`. When the schema layer is the one refusing, it answers with the
caller's own plain sentence and nothing else:

> **Could not save this account.** Nothing was changed.

Twenty boxes on the form, and not one of them named. The only way forward is to
change something, press Save, and see whether the same sentence comes back.

## Why it happened

The helper is right to drop the schema's own sentence — "Request validation
failed." explains nothing and reads like the owner's fault. Its comment then says
so, and says where the useful part is:

> the useful part is in `details`, keyed by field path

And nothing anywhere read it. Measured 2026-09-17:

|                               | piggles | sparx |
| :---------------------------- | ------: | ----: |
| `apiErrorMessage` call sites  |      83 |    86 |
| places reading the field list |   **0** | **0** |

The server had already sent the one fact that narrows twenty suspects to one, on
the same response, and the console threw it away
([[feedback_fetched_but_never_rendered]]). This is the recurring shape again: the
thinking was done and written down in the comment, and never applied to the
neighbor ([[feedback_a_fix_leaves_its_neighbour_behind]]).

## The fix

New `refused-fields.ts` in both consoles, and one branch in `apiErrorMessage`:

> **Could not save this account.** Nothing was changed. **The problem is with
> Physical address.**

- **It names the box, not the reason.** None of the 142 route files that parse a
  request body attaches its own wording, so every message on that response is
  Zod's default: "Invalid input: expected string, received undefined", "Too
  small: expected string to have >=1 characters", "Invalid uuid". Repeating those
  puts the fault back on the owner in a vocabulary she has no use for, which is
  the exact thing the helper exists to stop. The field is a different kind of
  fact: it is a place on her screen.

- **It counts rows from one.** `items.2.quantity` reads **Quantity (item 3)**,
  because that is how the rows are numbered on the screen.

- **It says nothing when there is nothing to point at.** A rule that refuses the
  whole request carries an empty path, and a refusal of a whole row
  (`items.2`) names no box inside it. Both return null and the plain sentence
  stands alone, rather than sending her to a box that is fine
  ([[feedback_never_present_absence_as_measurement]]).

- **Three, then a count.** Four or more refused fields read "Title, Price, Weight
  and 2 more", so the toast stays a sentence.

It reads both shapes the server sends: Zod's `{ path, field }` and Fastify's own
`{ instancePath: '/items/0/unitPrice' }` JSON pointer.

## Guard

`refused-fields.test.ts` (**16**) plus **4** added to `api-error.test.ts`, in each
console. **23 pass** per console.

The one that is a rule rather than an example:

```ts
it('leaves the reason out, whatever the reason was', …)
// asserts the output matches none of /expected|received|Invalid input|characters|uuid/i
```

Two more pin the cases where saying nothing is the right answer, so a later
"helpful" default goes red.

Proven red by making `refusedWhat` return null: **6 of 23** fail.

## Still open

**A humanized path is not always the on-screen label.** `physicalAddress` reads
"Physical address" where the Email settings screen labels the same box "Mailing
address". For most fields (price, weight, title, quantity, sku) the two match
exactly, and where they drift the owner is still pointed at the right part of the
form instead of at nothing. A per-field label map would be thousands of entries
and would rot; closing this properly means the server naming its own fields,
which is a schema change rather than a console one.
