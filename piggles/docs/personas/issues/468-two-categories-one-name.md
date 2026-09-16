# 468 — Two categories with the same name, and no way to tell them apart

**Status:** fixed
**Severity:** major
**Found by:** Devi adding "Packaging & gift wrap" to Spending categories, twice
**Surface:** `finance.categories` (both consoles) · `POST/PATCH /v1/finance/categories`
**Filed:** 2026-09-09

## What was wrong

Devi added a category her boutique needs and the seeded set has no word for:
**Packaging & gift wrap**, filed as cost of the work.

Then she added it again. The server answered **201 Created**, the toast said
_"Packaging & gift wrap added"_, and she now had two.

The second one landed in **Running costs**, because the kind dropdown resets to
its default and she had not touched it. So the same name sat on both sides of
the gross-profit line.

On the screen where the choice is actually made:

```
Choose a category...
Packaging & gift wrap      ← cost of the work
Packaging & gift wrap      ← a running cost
Parts & materials
Subcontractors
…
```

Two identical lines, no group headings, nothing to choose between them. And this
screen's own closing paragraph says what that costs:

> Filing a cost in the wrong group does not change your bottom line — but it does
> change whether a job looks worth doing.

## Why nothing stopped it

The table has a unique index. It is on `(tenant_id, slug)`.

A tenant-invented category has **no slug**, and that is correct and deliberate —
`createCategory` says why:

> _"Tenant-invented categories carry no slug: the slug namespace belongs to the
> seeded set that derivers address, and letting a tenant mint 'wages' would let
> them collide with it."_

Postgres treats NULLs as distinct in a unique index, so that constraint says
nothing whatsoever about invented rows. The NAME was guarded by nothing: not the
database, not `createCategory`, not `updateCategory`.

This module guards everything else. A seeded category cannot be deleted. A
category with spend behind it cannot be deleted. Changing a category's kind
raises a warning explaining that past profit figures will move. Every one of
those has a typed error with a sentence an owner can act on. Uniqueness was the
one that was never written, and the reason it went unnoticed is that the index
right beside it looks like it covers this.

Renaming was worse than creating: nothing stopped her renaming an invented
category to **Rent**, leaving two rows called Rent, only one of which a deriver
finds by slug.

## The fix

One guard, used by both writers, inside the caller's transaction so it cannot
race a second create:

```ts
async function assertNameFree(tx, tenantId, name, exceptId) { … }
```

Case- and space-insensitive, because "rent" and "Rent " are the same word to the
person typing them and would render as two rows nobody can tell apart. It stores
the trimmed name for the same reason.

It checks **archived** rows too — an archived category still labels every cost
already filed under it — and that gives the error two forms, because the two
causes have different remedies:

| clashes with    | what she is told                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a live category | _"You already have a category called "Rent". Two categories with the same name cannot be told apart when you file a cost, so give this one a different name."_ |
| an archived one | _"…but it is archived. Switch on "Include archived" and bring that one back, rather than making a second one with the same name."_                             |

Telling somebody "you already have one" about a row that is not on their screen
sends them hunting for something they cannot see.

`CATEGORY_NAME_TAKEN` is a **409**, beside the two category conflicts that were
already 409s.

## Proven

Typed lowercase `rent` into "Add a category" and got the sentence back, naming
the existing category with ITS capitalization so she knows which one to look
for. The form stayed open with her text in it.

| breaking                                  | reddens                                                  |
| ----------------------------------------- | -------------------------------------------------------- |
| removing the guard from `createCategory`  | 4                                                        |
| removing the guard from `updateCategory`  | 1 — the rename-onto-an-existing-name case                |
| dropping the `.trim()` on the stored name | 1 — a padded name would render as a second identical row |

## Noted, not filed

The category picker on the Spending screen is a flat list with no kind headings.
With duplicates refused it is no longer ambiguous, so this is a design
improvement rather than a defect — but grouping it by "Cost of the work / Wages /
Running costs" would put the one fact that matters next to the choice that
depends on it.

## Also checked, and fine

- The Spending headline reads `N costs` off the loaded page while the total
  beside it covers the whole filter — but it says **"loaded so far"** when there
  is more, so the two scopes are admitted rather than blurred.
- The "Include archived" switch works. Two earlier clicks of mine missed it, and
  that was my aim, not the control.
