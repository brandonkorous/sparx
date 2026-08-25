# 201 — The Groups screen called them collections, thirty times

**Status:** fixed, awaiting re-proof on screen
**Severity:** copy
**Found by:** P03 · Juniper Row · act 5
**Surface:** mypiggles › Sell › Groups of products (list and detail)
**Filed:** 2026-08-25
**Fixed:** 2026-08-25

## What happened

The navigation calls it **Groups of products**. Everything inside it calls it a
collection:

> Search collections… · Add a collection · No collections yet · A collection is a
> themed group of products you show together · Pick the products that belong in
> this collection · Feature this collection · A picture your theme can show
> across the top of the collection's page · One or two sentences on what someone
> finds in this collection · A collection's kind is fixed once it is created ·
> Deleting removes this collection from your website · **Delete this collection**

Thirty-odd instances across eight files, plus two sentences pointing at "the
**Fitment** screen", which is called **What fits what**.

## What should have happened

The screen uses the word its own name uses.

## Why it matters

"Collections" is not an incidental leak. It is one of the seven words
[piggles/CLAUDE.md](../../../CLAUDE.md) RULE #3 names explicitly:

> Never make a user understand CMS, CRM, headless, MDI, RBAC, **collections**,
> price books, or GraphQL outside an explicitly advanced or developer context.

Renaming the nav entry and leaving the screen in the old vocabulary is the worst
of both: she is sent somewhere called Groups of products and then has to work out
for herself that a "collection" is the same thing, which is a translation step
the rename existed to remove. And the delete button — the one control where being
sure what you are pressing matters most — was the loudest instance of it.

Two sentences also sent her to a screen that does not exist under that name. She
would have searched "Fitment" and found nothing, which is
[199](199-she-searched-for-collections-and-was-told-nothing-matches.md) again from
the other end.

## Where it lives

Eight files under
[surfaces/commerce](../../../apps/workbench/surfaces/commerce): `collections-list`,
`collection-detail`, `collection-editor`, `collection-detail-basics`,
`collection-detail-extras`, `collection-detail-members`, `collection-products`,
`collection-rules`.

One line already said "at the top of the **group**", so the pass had been started
and abandoned — which is how the rest kept reading as deliberate.

## The fix

Every user-facing string rewritten to "group", including the pane title
(**New group** / the group's own name), the leave-guard sentences, the save
button (**Create the group**), and the delete block. Two more corrections came
with it:

- **"themes can show featured collections on the home page"** → "Your site can
  show the ones you feature on its home page." A theme is jargon in the same way.
- **"the Fitment screen"** → "the What fits what screen", twice.

The literal web address stays as it is — `yoursite.com/collections/new-in` is
the real URL a shopper will see, and hiding it would be worse than showing it.

Identifiers, types and query keys were left alone: `CollectionDetail`,
`commerce.collection.detail` and the API route are the platform's names for the
thing and no shop owner reads them.

### Three design faults fixed in passing

Touching the files brings [piggles/CLAUDE.md](../../../CLAUDE.md) RULE #0.5 and
root RULE #4 with them:

1. **`color="neutral"` in four places.** The Hand-picked badge rendered grey
   beside a blue Automatic one, so the two kinds of group did not read as two
   kinds — Hand-picked is now `module`. The **Standard** pill beside a `warning`
   **Featured** one is gone entirely: a badge is state ON a thing, and "not
   featured" is the absence of state, so it reads as plain words. The archived
   **Retired** tag went `warning` (it is worth noticing before you put a retired
   product in a group). The two icon-only remove buttons dropped their `color`
   altogether — a colorless control is the right control for a plain affordance.
2. **`collections-list.tsx` was 302 lines** and is now 223 plus a
   `collections-list-table.tsx` of 137.
3. **`collection-rules.tsx` was 528 lines** and is now four files, none over 195:
   the editor, `-fields.ts` (what a person can ask for, in their words), `-row.tsx`
   (one condition), `-value.tsx` (what to type for it).

## Rating effect

`Sell › Groups of products` in [rating.md](../rating.md).
