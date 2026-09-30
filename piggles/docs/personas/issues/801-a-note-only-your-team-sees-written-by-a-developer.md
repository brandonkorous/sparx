# 801 — "A note only your team sees", written by a developer

**Status:** fixed and applied
**Severity:** low
**Found by:** P03 · Juniper Row · act 280
**Surface:** mypiggles + sparx workbench — `commerce.fitment.domain.detail`
**Filed:** 2026-09-24
**Applied:** 2026-09-24, by Brandon, with `prisma migrate deploy`

## What happened

On Devi's own compatibility list, under a field the console labels _"Optional.
Only your team sees this"_:

```
Note
Clothing fitment — a single Size axis (alpha + numeric), no sub-levels.
```

Four words her team does not use, in a sentence her team is supposed to have
written. "Fitment" is the word this screen was renamed **What fits what** to
avoid.

## Why

Issue 607 found exactly this sentence in act 205 and fixed it — in the
**catalog**. The fourteen ready-made lists were rewritten out of developer
shorthand, a guard was added, and the issue closed with "Still open: Nothing
from this issue."

The catalog is the source the installer COPIES FROM. Every list already
installed kept the sentence it was stamped with. Nothing backfilled them, and
nothing looked.

Measured, not assumed:

```sql
SELECT count(*) FILTER (WHERE description ILIKE '%fitment%') AS says_fitment,
       count(*) AS total
FROM commerce_fitment_domains;

 says_fitment | total
--------------+-------
            4 |     4
```

**Every fitment list in the database.** All four, across every tenant. And on
Devi's, `created_at = updated_at` — she has never saved it, so the sentence is
the installer's, not hers.

This is the same shape as [[feedback_a_fix_leaves_its_neighbour_behind]], with
the neighbour being DATA rather than a second call site, and the same shape as
[[feedback_data_is_a_deploy_stage]]: content fixed in source that never reached
a row.

## What was done

`wizeworks/packages/db/prisma/migrations/20270516000000_a_note_only_your_team_sees/`
refreshes the note from the catalog, for all fourteen lists.

Two things make it safe to run on a live database:

- **Matched by slug, not by the old sentence.** That sentence has had more than
  one spelling — the em-dash pass changed it again after 607 — so matching the
  text would miss rows.
- **Guarded by `created_at = updated_at`.** A list anyone has SAVED since it was
  installed keeps whatever they wrote. This only refreshes what a machine put
  there and nobody has touched, which is the test
  [[project_defaults_written_by_a_machine]] asks for.

It is idempotent (`IS DISTINCT FROM`), and a no-op on a fresh install because
the installer already writes the new sentence.

## Proof

Run as a read-only SELECT against the local database, with the migration's own
WHERE clause:

```
 rows_it_would_touch
---------------------
                   4

     slug      |            now_says            |                would_say
---------------+--------------------------------+------------------------------------------
 vehicle       | Automotive fitment — Make → Mo | For parts that only fit certain cars and
 vehicle       | Automotive fitment — Make → Mo | For parts that only fit certain cars and
 apparel-sizes | Clothing fitment — a single Si | For clothing sold by size. One plain lis
 apparel-sizes | Clothing fitment — a single Si | For clothing sold by size. One plain lis
```

Four rows, four hits, no false matches. `check:migration-order` and
`check:migration-drops` both pass with it added.

## Applied

Brandon stopped the dev stack on 2026-09-24 and the migration went in through
`prisma migrate deploy`. All four lists read in plain words now, and all four
still report `created_at = updated_at`, so the refresh did not pretend anybody
had edited them and a second run is still a no-op:

```
     slug      |                             note                              | untouched
---------------+---------------------------------------------------------------+-----------
 apparel-sizes | For clothing sold by size. One plain list of sizes, with lette | t
 apparel-sizes | For clothing sold by size. One plain list of sizes, with lette | t
 vehicle       | For parts that only fit certain cars and trucks. A shopper pic | t
 vehicle       | For parts that only fit certain cars and trucks. A shopper pic | t
```

## Confirmed by

Opened as Devi on Juniper Row, 2026-09-25, on her own Apparel sizes list. Under
the box labelled _"Optional. Only your team sees this"_:

> For clothing sold by size. One plain list of sizes, with letters and numbers
> together, and nothing underneath them.

Not a psql read: the pane, the field, her list.

## Files

- `wizeworks/packages/db/prisma/migrations/20270516000000_a_note_only_your_team_sees/migration.sql` (new)
