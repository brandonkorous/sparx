# 561 — The notice quoted words the column was too narrow to show

**Status:** fixed and proven
**Severity:** low
**Found by:** Devi, on Stock → Counting, in her ordinary three-pane layout
**Surface:** `piggles/apps/workbench/surfaces/inventory/counts-list-unpriced.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_copy_edit_breaks_identity_lookups]] · [[feedback_responsive_top2_rule]]

## What she saw

Above her four stock counts:

> Some counts below say **"No cost yet"**. They moved real stock. There is just
> nothing recorded about what it cost, so they cannot be given a value.
> **[ Put in what they cost ]**

No row below said "No cost yet". The row it means, CNT-000001, read:

> Main Warehouse
> CNT-000001
> 62 items · 372 units corrected, **no cost recorded**

So she is told to look for one phrase and the screen shows a different one.

## The cause

"No cost yet" is `differenceLabel()`, which fills the **Difference** column. That
column is `hidden @xl:table-cell`. In a three-pane layout the counts pane is
about 357px wide, so the column is not rendered at all, and the same fact falls
back to `differenceSentence()` — "no cost recorded" — folded under the count's
name.

Both phrasings are good copy and the fallback is deliberate. The defect is that
the notice **hardcoded one of them**.

Maximize the pane and the notice becomes true: the Difference column appears and
CNT-000001 says "No cost yet". So it is correct only in the layout she is least
often in.

The file's own comment stated the intent it was failing:

> _This is the way out, and it only appears when a row on screen is actually
> saying it._

The gate is right — `anyUnpriced(rows)` — it is the **sentence** that is wrong.

## The fix

Describe the fact, do not quote the column:

> Some counts below moved real stock and cannot be given a value. There is
> nothing recorded about what those items cost.

True at every width. The button is still the way out.

## Proven

Her screen at her normal pane width now reads the sentence above, with no
phrase to go hunting for. 401 piggles tests pass.
