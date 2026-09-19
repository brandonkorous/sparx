# 560 — "Every one of the 1 recorded change, added together"

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, on the pane that exists to make a stock figure trustworthy
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/provenance.tsx` and 4 more
**Filed:** 2026-09-16
**Family:** [[feedback_a_fix_leaves_its_neighbour_behind]] · [[feedback_never_present_absence_as_measurement]]

## What she saw

Stock → any row → the shield icon → **Where this number came from**. Linen
Shirtdress, size L indigo:

> ✅ **This number adds up**
> Every one of the **1 recorded change** to this item here, **added together**,
> comes to exactly 6. Nothing has moved that was not written down.

and four inches below it, about the same item:

> **What changed it**
> **The most recent 1 of 1 recorded change**, newest first. The running total is
> what the number was immediately after **each one**.

"Every one of the 1." "Added together" over one thing. "Each one" over one
thing. "The most recent 1 of 1."

This is the pane whose entire job is the trust argument for every stock figure
in the product. A sentence that reads like a machine wrote it argues the other
way.

## Measured

|                                                             |              |
| ----------------------------------------------------------- | ------------ |
| Juniper Row stock rows with exactly **one** recorded change | **54 of 74** |
| Stock levels platform-wide with exactly one                 | 74           |
| Stock levels platform-wide with **none**                    | 5            |
| Most movements on any level, anywhere                       | **5**        |
| Movements the pane asks for                                 | **20**       |

So the broken sentence is the **majority case** on her shop, not an edge.

"The most recent N of M" was worse than awkward. The pane asks for 20 and no
stock level on the platform has more than 5, so nothing has ever been left out.
The sentence implied a truncation that **has never once happened**, on every
row, on every tenant.

The five levels with no movement at all got the green tick and:

> ✅ **This number adds up**
> Every one of the **0 recorded changes** … comes to exactly 0. Nothing has
> moved that was not written down.

A verified-looking claim over an empty ledger, which is
[[feedback_never_present_absence_as_measurement]] exactly. `RecentChanges`, in
the same file, **already had the right sentence for zero** — "Nothing has ever
moved this item here. The number is zero because it has never been anything
else." The banner four inches above it did not, which is
[[feedback_a_fix_leaves_its_neighbour_behind]].

## The cause

```tsx
Every one of the {plural(data.movementCount, 'recorded change', 'recorded changes')} to
this item here, added together, comes to exactly {NUMBER.format(data.onHand)}.
```

`plural()` is correct. It makes the NOUN agree and it cannot do anything about
the rest of the sentence, so a plural-only sentence around it reads fine in the
source and only breaks on the screen.

## Every one of them, not just the two she saw

Swept both consoles for a `plural()` call wrapped in a phrase that only works at
two or more. **Six sites**, five of them in both consoles:

| screen                                     | at a count of 1                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| Where this number came from, banner        | "Every one of the 1 recorded change … added together"                      |
| Where this number came from, changes table | "The most recent 1 of 1 recorded change … after each one"                  |
| Import from a file, **undo confirm**       | "Every one of the 1 change it made will be reversed"                       |
| A lot's individual units                   | "1 unit in this batch: where **each one** is now, and which **have** left" |
| Report schedules, paused notice            | "**Each one** failed four times in a row"                                  |
| Site check, unused styling names (sparx)   | "1 styling name … **produce** nothing at all"                              |

The undo confirm is the one that matters most after the provenance pane: it is
the sentence on a **destructive** dialog, the last place a count may disagree
with its own words.

The paused-reports notice was wrong at **both** ends. Its title already used
`plural(n, 'report has', 'reports have')` and was right at one, but the sentence
under it said "Each one failed … Open **it** … switch **it** back on" — singular
pronouns in the plural branch.

## The fix

The two provenance sentences move into `provenance-copy.ts`, a pure module with
three branches each, so the sentence has a test. Zero gets its own words **and
its own tone**: an `info` alert, not a green tick, because there is nothing to
have checked.

The other four branch on the count in place.

## The guard

The disease is not six sentences. It is that `plural()` fixes the noun and lets
the author forget the rest of the sentence agrees too. So the rule is asserted
in `provenance-copy.test.ts`: **a plural-only phrase has to sit inside something
that knows the count.**

It scans every `.ts`/`.tsx` under `surfaces/` for `added together`, `each one`,
`every one of the`, `between them`, `all of them`, `each of them`,
`, newest first` within 260 characters of a `plural(` call, and passes only when
a `=== 1` / `!== 1` / `> 1` / `>= 2` / `< 2` / `<= 1` branch is in the same
window. Comments are blanked in place — same length **and same newlines**, or
the offender is reported a hundred lines off — because this file's own header
quotes the broken sentence.

## Proven

Her screen, both panes open at once:

> ✅ **This number adds up**
> **The one change ever recorded against this item here** comes to exactly 6.
>
> **What changed it**
> **The one change ever recorded against this item here.** The running total is
> what the number was immediately after **it**.

and beside it, the three-movement item, unchanged:

> Every one of the 3 recorded changes … added together, comes to exactly 58.
>
> **All 3 recorded changes**, newest first. … immediately after each one.

8 guards added per console. The scan was **proven red** by restoring the
original banner: it reported `provenance.tsx:85 — added together, every one of
the`, and line 85 is where the restored text sat. Before any sentence was fixed
it reported **5 offenders on 5 different screens** in piggles.

401 piggles tests pass, 313 sparx tests pass, both consoles typecheck.
