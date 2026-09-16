# 517 — Get Found listed every check twice, in two different vocabularies

**Status:** fixed and proven
**Severity:** major
**Found by:** pressing "Rescan the site" on Devi's Get Found screen and reading the result
**Surface:** Get Found → Things worth fixing (both consoles; the roll-up is one API)
**Filed:** 2026-09-15

## What Devi saw

Thirteen checks, listed as twenty-six rows, half of them in the old technical
vocabulary and half in the plain-English wording that replaced it:

```
Failing   Title length                33 of 37 pages to fix
Failing   How long the title is       52 of 93 pages to fix
Failing   Heading structure            2 of 3  pages to fix
Failing   One main heading             3 of 6  pages to fix
Failing   One main heading            35 of 93 pages to fix
Warning   Image alt text               5 of 6  pages to fix
Warning   Every picture is described   4 of 93 pages to fix
```

Four different denominators on one screen. A business owner reads that as her
site having six separate heading problems and no idea which number is true.

## The cause

A scorecard is a **snapshot**. It stores the checks with the wording they had on
the day that page was scored, and a page is only re-scored when it is saved or
when someone runs a scan. So a site normally holds cards written by several
versions of the rules at once. Measured on Devi's account:

```
heading-h1 | Heading structure                       |   4
heading-h1 | One main heading                        | 133
title-length | Title length                          |   4
title-length | How long the title is                 | 133
… every one of the thirteen checks, twice
```

Same `id`, same `category`, different words. And the roll-up grouped on all
three:

```sql
GROUP BY 1, 2, 3   -- id, label, category
```

So a reworded check became two checks. The denominator on each row was never the
site's page count; it was **the share of pages that happen to carry that
wording**.

This is not an em-dash finding. The labels were reworded in the earlier
plain-English pass and the screen had been double-listing ever since. It only
became obvious after a rescan put 133 fresh cards next to 4 old ones.

## The fix

`id` is the check's real identity and has never changed. Group on it alone, and
take the words and the category from the **most recently scored card**, which is
the wording the product uses today:

```sql
SELECT
  chk->>'id' AS id,
  (array_agg(chk->>'label'    ORDER BY a.computed_at DESC))[1] AS label,
  (array_agg(chk->>'category' ORDER BY a.computed_at DESC))[1] AS category,
  …
GROUP BY 1
```

One endpoint, so both consoles are fixed by it.

## Proven

On Devi's real screen, before and after, with no other change:

|        | rows | wording            | denominator     |
| ------ | ---- | ------------------ | --------------- |
| before | 26   | mixed              | 3 / 6 / 37 / 93 |
| after  | 13   | plain English only | 96 on every row |

The test seeds one check id under two labels with two different `computedAt`
dates and asserts one row, the newer label, and both pages counted. Restoring
`GROUP BY 1, 2, 3` turns it red with `expected [ … ] to have a length of 1 but
got 2`.

## Noted, not changed

"Rescan the site" is capped at 500 entities per kind. Nothing on Devi's account
is near that, and the cap is deliberate, but a large catalog would need more than
one press and the screen does not say so.
