# 241 — A new record type could not be saved without a detail

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · pane ratings (checking a record type's list after issue 240, in Piggles as The Marrow Review)
**Surface:** Customers › Record types › New record type (and saving any record type with no extra details), sparx console and Piggles
**Filed:** 2026-10-13
**Fixed:** 2026-10-13
**Confirmed by:** Piggles as The Marrow Review, 2026-10-13
**Blocked on:** —

## What happened

Rosalind (The Marrow Review, owner) made a new record type: "Review copy". The form
filled in "Review copies" by itself. Under "The details you track" it said "Nothing extra
yet. Whatever you keep on a sticky note or a spare column in a spreadsheet belongs here."
She pressed Save.

The toast said: "Could not save that. Something went wrong reaching the server. Nothing
has been changed. The problem is with Fields."

The server was reached. It refused the save because the list of details was empty. The
shared field rule (`FieldSchema` in `@wizeworks/field-schema`) needs at least one field,
which is right for a CMS content type and wrong for a record type: the create service
already defaults to an empty list, the form says none is fine, and a record of a type
with no details has its own "no details on it yet" state.

The same rule refuses any record type saved with no extra details, so a business that
removes the last extra detail from Customers or Deals cannot save that either.

## What should have happened

A record type saves with no details, and details are added later.

## How to reproduce

1. Customers › Record types › New record type.
2. Type a name. Add no details. Save.

## Why it matters

Making the first record type is the whole promise of the screen, and it fails on the
first try with a message about the connection, which sends the owner off to check her
internet.

## Where it lives

- `wizeworks/packages/crm-schemas/src/object-defs.ts`: `CreateObjectDefInput` and
  `UpdateObjectDefInput` take `propertySchema: FieldSchema.optional()`, and
  `FieldSchema` is `fields: z.array(FieldDefSchema).min(1)`.
- The message: the form's fallback sentence ("Something went wrong reaching the
  server") is shown for a refusal the server sent. Noted for the wider wording check.

## The fix

One rule, in the one place both consoles, the API and MCP read it from.
`crm-schemas/src/object-defs.ts` now has its own `RecordTypeDetails`
(`fields: z.array(FieldDefSchema)`, no minimum), and `CreateObjectDefInput` and
`UpdateObjectDefInput` take it in place of the shared `FieldSchema`. The CMS content
type keeps `FieldSchema` and its minimum of one, because a content type with no fields
has nothing to write.

Test: `crm-schemas/src/record-type-no-details.test.ts`. It was red on the old rule (2 of 3
failed: create and update with an empty list) and is green now. crm-schemas: 105 pass.
crm: 887 pass.

## Confirmed by

Piggles, The Marrow Review, after the dev restart. Customers › Record types › New record
type. Typed "Review copy", added no details, pressed Save. The status line said "Saved just now",
and a "Review copies" pane opened on the saved type. The database row: key `reviewcopy`, label
"Review copy", plural "Review copies", `property_schema` `{"fields": []}`.

Saving it opened a second tab and left the filled "new" form open. That is a separate
defect, filed as issue 242.

## Rating effect

Record types (new): Ease was capped at 3 (the first save failed). It now saves first time.
