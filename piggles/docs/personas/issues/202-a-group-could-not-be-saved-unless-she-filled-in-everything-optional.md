# 202 — A group could not be saved unless she filled in everything optional

**Status:** fixed and confirmed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 5
**Surface:** mypiggles › Sell › Groups of products › any group
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, on screen and in the database

## What happened

Devi opened **New in**, wrote a description in her own words, ticked The Ash
Overshirt and the Linen Shirtdress, and pressed Save:

> **That didn't save**
> That didn't save. Check what you entered and try again.

And in the body of the pane:

> **Could not save this group**
> Could not save this group. Nothing was changed.

There is nothing to check. Every field she touched is valid: a name, a web
address, a description, two products. Pressing Save again produced the same two
sentences. The pane offered no way forward at all.

## What should have happened

It saves.

## Why it matters

This is the whole surface. A group that cannot be saved is a Groups screen that
does nothing, and act 5 is three groups. She would have tried twice, decided the
feature was broken, and gone back to the marketplace she is leaving — which is
exactly the month of broken software she said she cannot afford.

It is worse than a plain failure because the message **blames her**. "Check what
you entered" sends her back over four fields that are all correct, looking for a
mistake that is not there.

And it is not this shop or this group: **no tenant could save a group from this
pane**, ever, unless they happened to have filled in a banner image, a social
picture and both search-result fields first.

## Where it lives

The pane sends `null` for every optional field left blank. The schema accepts
`undefined` but not `null`:

```ts
// commerce-schemas/src/products.ts — shared by products, categories, collections
export const SeoFields = z.object({
  seoTitle: z.string().max(255).optional(), // ← null rejected
  seoDescription: z.string().max(512).optional(), // ← null rejected
  ogImageId: Uuid.optional(), // ← null rejected
});
```

The editor's draft is `heroMediaId: string | null` and `seoTitle: ''`, and the
write turns a blank into `null` on the way out. So the PATCH carries four nulls
in the ordinary case and the route answers **422**. Run against the real schema:

```
heroMediaId    Invalid input: expected string, received null
seoTitle       Invalid input: expected string, received null
seoDescription Invalid input: expected string, received null
ogImageId      Invalid input: expected string, received null
```

The message she saw is a second, separate thing: `apiErrorMessage` deliberately
suppresses `VALIDATION_ERROR`, because the schema layer describing itself
("Request validation failed") is worse than a plain sentence. That judgment is
right and stays — but it meant the actual reason never reached anybody, which is
why this survived to be found by clicking rather than by a test.

## The fix

`null` has to mean something, because **a banner she has set must be removable**.
The service already implements exactly that distinction — every field is written
only `if (input.x !== undefined)`, and all four columns are nullable — so
`undefined` means "leave it alone" and `null` means "clear it". Only the schema
disagreed.

Every clearable field is now `.nullable().optional()`, which is already the
convention in five other schema files in the same package (`bundles`, `costing`,
`fitment`, `inventory`, `procurement`) and on `parentId` two lines away:

- `SeoFields` — `seoTitle`, `seoDescription`, `ogImageId`, so products and
  categories are fixed by the same change
- `CreateCollectionInput` — `description`, `heroMediaId`
- `CreateCategoryInput` — `description`, `iconMediaId`, `heroMediaId`

Three tests were added that fail if any of them regresses, including one that
checks a null SURVIVES parsing rather than being stripped — stripping it would
quietly turn "remove the banner" into "leave it alone" — and one that checks a
wrong TYPE is still refused, so nullable did not become anything-goes.
452 tests pass.

## What it looked like once fixed

Same group, same two products, same description. **Saved just now**, the unsaved
dot gone. The database agrees:

```
 name   | featured | description                                    | live_products
 New in | t        | The two new pieces this season. Both are made… |             2
```

## The near-miss worth recording

Nothing was lost either time it failed. The pane said "Nothing was changed" and
that was true — reloading brought back the old description, unharmed. A save that
fails is allowed; a save that fails and takes her work with it would have been a
second issue.

## Rating effect

`Sell › Groups of products` in [rating.md](../rating.md), and it un-blocks act 5.
