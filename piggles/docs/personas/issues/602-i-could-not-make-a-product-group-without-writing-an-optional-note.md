# 602 — I could not make a product group without writing an optional note

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 204
**Surface:** mypiggles › Sell › Postage and delivery
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 204 (seen on screen, both states)

## What happened

I make coats and I make small things, and they do not post the same way. Postage
and delivery already had a group for **Coats and heavy knits**, so I went to add
one for trims and buttons.

**Add a group.** Typed the name. Left **Note (optional)** empty, because it says
optional. Pressed **Create group**.

> **Could not save this group**
> Nothing was changed.

No field named. Nothing wrong on the form. I tried again and got the same thing.

It saves the moment you type something in the note. **The optional field is
required.**

## Why it matters

This is the first thing a shop does on this screen and it is the thing the
screen exists for. A person who hits this concludes the product is broken,
because from where she is sitting it is: the form is filled in correctly and the
save fails with no reason.

And the same wall is in the way of ever **clearing** a note once written.

## Where it lives

`commerce-schemas/src/shipping.ts`:

```ts
description: z.string().max(2000).optional(),
```

The console's house convention — 40-odd forms follow it — is that an empty text
box sends **`null`**, not an empty string and not nothing. `.optional()` accepts
`undefined` and rejects `null`, so the request never reached the service. Bare
422, no field, "Nothing was changed".

**The service already disagreed with its own schema.** One file over:

```ts
description: input.description ?? null,
// and on update:
...(input.description !== undefined ? { description: input.description ?? null } : {}),
```

That code says plainly that `undefined` means "leave it alone" and `null` means
"clear it". Only the schema line disagreed.

**Fixed:** `.optional()` → `.nullish()`. Strictly widening — every payload that
parsed before still parses, to the same value — and the service's own `?? null`
proves the column takes null, because that is what it already writes when the
field is absent.

## 105 more of them

Once I knew the shape I went looking, and the first scan was wrong in a way
worth writing down: joining on **field name** across a whole module turned up
173 hits, most of them a `notes` in one file matched to an `input.notes` in an
unrelated one. **A name is not a link.**

The real link is one function, one schema, one field:

```
service function  →  the schema it calls .parse() with  →  that field
```

Following that one: **106 fields**, across **26 files** in two packages, where a
service writes `input.X ?? null` into a column and its own schema refuses the
null. Each one is a form that cannot be left blank, or a value that cannot be
cleared, and neither can be seen without pressing Save.

All 105 remaining are widened. The codemod refused anything it could not match
exactly (`.optional()` once on the line, nothing already nullable, and the call
at the end of the chain) and printed every edit; the diff was read back, and the
only non-mechanical line in it is the comment above.

Verified after: **api-rest typechecks, commerce 221 tests, crm 528 tests, both
consoles 562 / 464.**

## Guard

**`scripts/check-nullable-inputs.mjs`**, wired as `pnpm check:nullable-inputs`
and into the pre-push guard beside the other structural checks.

Nothing else can catch this class. It typechecks — the console's type says
`string | null`, the schema's says `string | undefined`, and the two never meet
in TypeScript because the wire is between them. It lints. Every unit test passes,
because a test builds a valid object rather than the one a blank form sends. It
appears only when somebody leaves a field empty and presses Save.

Proven red twice:

```
✗ 2 field(s) a service writes null into that its own schema refuses:
  CreateShippingProfileInput.description  … createProfile()
  UpdateShippingProfileInput.description  … updateProfile()
```

by putting the original bug back — and it names both the create and the update
path, which is the pair a reader has to fix together.

And proven red **blind**, by pointing one scan root at a directory that does not
exist:

```
✗ scan root is missing: wizeworks/packages/commerce/src-MOVED
  A check that scans nothing prints green. Fix the path, do not delete the root.
```

plus floors on the file and schema counts, so a tree move that empties a root
fails instead of passing.

## The second defect on the same screen

**A product group no region prices cannot be delivered, and looked exactly like
one that could.**

A delivery option belongs to a (region, group) pair. The region half of this
surface has always known that: it carries a rate count and wears a
"No delivery options" badge when it is zero. The group half never had the count
— so the one screen that can CREATE the broken state said nothing at all about
it, and a shopper with one of those products in their basket is offered no way
to receive it.

`rateCount` now comes back on a group, as it always has on a region, and the
group says so in three different ways depending on which situation it is in:

| situation                       | tone    | what it says                                         |
| ------------------------------- | ------- | ---------------------------------------------------- |
| the DEFAULT group, no price     | danger  | nothing in the shop can be delivered                 |
| a group with products, no price | danger  | those N products cannot be delivered                 |
| an empty group, no price        | warning | nothing is affected yet; anything filed here will be |
| any group with a price          | —       | nothing                                              |

Seen live on the group I created: badge **No delivery options**, and under it

> No region has a delivery option for this group yet. Nothing is filed under it,
> so nothing is affected, but anything you file here will have no way to be
> delivered until a region prices it.

Guarded by `shipping-group-words.test.ts`, 7 tests per console.

## The sweep left a third party behind

Widening 106 schema fields changed what `z.infer` produces, and the consoles
carry HAND-WRITTEN mirrors of some of those schemas — an interface whose comment
says "the exact CreateDiscountInput shape" and which had to be widened with it.
Three fields on `DiscountInput` had not been (`description`, `valuePercent`,
`totalUsageLimit`), so `parseDiscountInput` could no longer return its own parse
result.

tsc caught it, in both consoles, which is the right outcome — but it is worth
recording that `check:nullable-inputs` cannot see this class. It compares a
SERVICE write to the schema it parses with; a mirror declared in a console is a
third copy that neither side knows about. Typecheck is the guard there, and it
only works if it is run after the schemas change.

## Still open

The error named no field, and the 422 did carry one.

`apiErrorMessage` drops a schema validation body on purpose, with a good reason:
Zod's own sentence is "Request validation failed", which explains nothing and
reads like the owner's fault. But it drops the FIELD PATH with it, and the path
is the half that would have saved me — "the server would not accept the Note"
is a different afternoon from "nothing was changed".

Not fixed here, and the reason is a real one rather than a shrug: the path is
`description`, and the box is labelled "Note". Printing the column name at a
business owner is the jargon this console exists not to do, and mapping paths to
labels is a piece of work across 55 surfaces that pass a title and a fallback
through `<SaveFailure>`. With the 106 causes now gone this 422 should be rare,
which is the right order to do the two in.

Worth noting for whoever picks it up: the mapping belongs in ONE place, the way
`messageBeyondTitle` dropped a repeated title for all 55 at once rather than by
rewording 55 strings.
