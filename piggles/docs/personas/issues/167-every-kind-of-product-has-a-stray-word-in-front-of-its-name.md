# 167 — Every kind of product has a stray word in front of its name

**Status:** open
**Severity:** minor
**Found by:** P03 · Juniper Row · act 2
**Surface:** mypiggles › Sell › Kinds of product — and the kind picker on every product
**Filed:** 2026-08-23
**Fixed:** — (source fixed; the rows need the pipeline)
**Confirmed by:** —
**Blocked on:** pipeline — the seven rows are platform data, so a migration has to apply

## What happened

Devi went looking for somewhere to set up size and color once, before typing a
catalogue. **Sell → Kinds of product** looked promising. What it listed was:

| On screen                            | Meant to be               |
| ------------------------------------ | ------------------------- |
| **shirt** Apparel                    | 👕 Apparel                |
| **wrench** Auto Part                 | 🔧 Auto Part              |
| **sparkles** Beauty & Personal Care  | 💄 Beauty & Personal Care |
| **cpu** Electronics                  | 💻 Electronics            |
| **utensils-crossed** Food & Beverage | 🍽️ Food & Beverage        |
| **tag** General                      | 🏷️ General                |
| **lamp** Home & Objects              | 💡 Home & Objects         |

Seven rows, each wearing the NAME of the icon it was supposed to show. It is not
only this screen: the same value is printed in the **kind** drop-down on every
product's Details tab, which is where a person actually meets it.

## What should have happened

A symbol, or nothing. The field's own description on the type editor says what it
expects — "A small symbol shown next to this type in menus, such as an emoji." A
word is neither.

## How to reproduce

Every time, any tenant.

1. Console → **Sell** → **Kinds of product**.
2. Read the Built-in types table.

Or from the database:

```sql
select key, name, icon from commerce_product_types
 where tenant_id = '00000000-0000-0000-0000-000000000000';
```

## Why it matters

Cosmetic, and it is worth saying so plainly rather than inflating it — nothing is
wrong with the data, nothing reaches a customer, and a person can still pick a
kind. But "utensils-crossed Food & Beverage" is the kind of thing that makes a
careful owner distrust the rest of the screen, and Devi is the most careful owner
in this roster. It also reads as a rendering fault rather than a value, which
sends somebody looking for a bug that is not there.

## Where it lives

The seed, not the render. The console prints the field as text on purpose —
[product-types-list.tsx:288](../../../apps/workbench/surfaces/commerce/product-types-list.tsx)
and
[product-attributes.tsx:223](../../../apps/workbench/surfaces/commerce/product-attributes.tsx)
— which is right for an emoji.

What is wrong is what was put in it:
[wizeworks/packages/commerce-schemas/src/product-types/builtins/](../../../../wizeworks/packages/commerce-schemas/src/product-types/builtins/)
carries `icon: 'shirt'` and six like it, and migration
`20270206000000_product_types_attributes` seeded those same strings into the
platform-tenant rows every business reads.

## The fix

**The source.** Seven `icon:` values in `builtins/*.ts` are now emoji, and
`builtins/index.ts` says outright that the field is a symbol rather than the name
of one, so the next person does not repeat it.

**The rows.** Authored as
[20270406000000_built_in_product_kinds_wear_a_symbol](../../../../wizeworks/packages/db/prisma/migrations/20270406000000_built_in_product_kinds_wear_a_symbol/migration.sql),
**not run** — migrations go through the pipeline. It is scoped to the platform
tenant, to `is_built_in`, and to the exact old value, so a business that opened
one of these and kept its own copy is left alone.

## Confirmed by

Not yet, and it cannot be from this screen: the rows only change when the
pipeline applies the migration. What IS established is that the source and the
migration agree — both carry the same seven symbols, checked side by side — and
that `commerce-schemas` typechecks clean with them.

The screen re-check belongs to whoever runs the next release, or to the persona
run that opens Kinds of product after it.

## Rating effect

Counted against `Sell › Kinds of product` in [rating.md](../rating.md).
