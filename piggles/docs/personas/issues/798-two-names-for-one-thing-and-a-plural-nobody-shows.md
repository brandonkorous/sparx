# 798 — Two names for one thing, and a plural nobody shows

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 280
**Surface:** mypiggles — `commerce.product-types.list`, `commerce.product-types.detail`
**Filed:** 2026-09-24
**Blocked on:** —

## What happened

Piggles calls this screen **Kinds of product**. The launcher says so, the pane
title says so, the empty state says "No kinds of product yet", and a failed load
says "Could not load your kinds of product".

Then you are inside it, and it calls the same thing a **type**:

```
toolbar        [ + New type ]
group          Your types
group          Built-in types
notice         This is a built-in type
form section   About this type
validation     Give this type a name.
footer         Delete this type
                 Removes the type and its attributes for good.
```

And the thing a kind of product carries is named twice over on one journey. On
the way in:

```
empty state   Define the extra details a kind of product carries (fabric and
              care for clothing, ingredients for food, specs for electronics)
create intro  Name it, then list the extra details it carries
```

Once you are there:

```
section       Attributes
empty         No attributes yet. Add the first one below.
menu          Add an attribute…
row           Untitled attribute
field         Attribute id
column        Attributes
list row      3 attributes
```

## Why

A brand rename that reached the chrome and stopped at the body. The pane titles
come from `lib/console/vocabulary.ts`, which renames the surface key, and the
toolbar label, the search label, the load-error title and the empty-state title
had been rewritten by hand — so the four loudest strings were right and every
sentence under them was still sparx's. That is the shape recorded as
[[feedback_a_fix_leaves_its_neighbour_behind]]: the rule applied to some of the
places that needed it.

The files are forked per console (`piggles/…/product-type-detail.tsx` is not the
same file as `sparx/…/product-type-detail.tsx`), so there was nothing stopping
the piggles copy from being finished.

## The third thing, which was worse

The form has a **Plural name** field, and its help line said:

```
What you call several: shown in menus. Optional.
```

`pluralName` is written, trimmed, sent, stored, and read back into the search
haystack on the list. Grepped across the whole console: **no screen draws it.**
Not a menu, not a heading, not a row. She types "Jackets" and goes looking for
where it appears, and it appears nowhere.

(The Icon field's "shown next to this in menus" WAS checked and is true — the
list row and the product form's kind picker both draw it. The plural was the
only false one.)

While there: the **Name** and **Plural name** placeholders were both the word
`Apparel`, side by side, so the pair demonstrated nothing about the difference
the second field exists for.

## What was done

**One name for one thing (Piggles only — sparx's own word is "product type"):**
every "type" in the body of those two panes is now "kind of product", and every
"attribute" is a "detail":

```
[ + New kind of product ]     Your kinds of product
This is a built-in kind of product
About this kind of product     Delete this kind of product
The details it carries         No details yet. Add the first one below.
Add a detail…                  Untitled detail       Detail name / Detail id
```

**The plural got a reader, in both consoles.** The details section now names
whose details they are, in her own plural:

```
The details it carries
The extra details every one of your Jackets holds. Drag to reorder, or use
the arrows.
```

It falls back to the singular she typed, then to "these products" on a blank
form. It never inflects a name she chose — that is what the plural field is
for, and inflecting a tenant's own word is what issue 794 took out of the
compatibility lists.

The help line no longer sends anyone hunting: **"What you call several of them.
Optional."**

**The placeholders became a pair that teaches:** `Jacket` and `Jackets`.

## Not done, and why

The **Id** field keeps its label. "Id" is the console-wide word for a machine
name — CMS content types use "Field id" in the same way — so changing it on one
pane would trade a local improvement for a console-wide inconsistency. It is a
vocabulary question for the whole console, not an act-280 fix, and it is noted
here so it is visible rather than quietly dropped.

## Files

- `piggles/apps/workbench/surfaces/commerce/product-types-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/product-type-detail.tsx`
