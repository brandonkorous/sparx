# 834 — A migration named for a fix it did not make

**Status:** fixed
**Severity:** correctness (a refresh that refreshed the label and not the text)
**Found by:** P03 · Juniper Row · act 282
**Surface:** the database, the builder's Add palette, the ready-made AI instructions
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** counted before and after each migration, on the dev database

## What this act was meant to be

Brandon shut the dev stack down so five waiting migrations could be applied. One
of the five was already in. The other four went in and were counted, before and
after, against the rows each one claimed to change:

| Migration                                                 | Claimed                      | Before | After |
| --------------------------------------------------------- | ---------------------------- | -----: | ----: |
| `…517_stage_names_a_shop_owner_would_use`                 | starter pipeline stage names |    174 |     0 |
| `…517` (the pipeline's own name)                          | `Sales Pipeline` → `Sales`   |     29 |     0 |
| `…518_the_ready_made_reports_say_what_this_file_says`     | em dash in a built-in report |     36 |     1 |
| `…519_a_notice_that_names_the_wrong_brand…`               | `The <brand> team replied…`  |      5 |     0 |
| `…520_the_ready_made_instructions_stop_saying_storefront` | "storefront" in a prompt row |      8 |     6 |

Three of the five cleared to zero. **Two did not, and they are different
stories.**

## The one that is correct

The report row left behind is not a defect. `builtin_slug` is null, its name
ends in **"(copy)"**, `created_at ≠ updated_at`, and it has an owner. Somebody
duplicated a built-in report and edited it. It is their row now, and the gate
that skipped it is the gate working.

## The one that is a defect, and it is mine

`20270520000000_the_ready_made_instructions_stop_saying_storefront` refreshed
`name` and `description` on nine prompt keys and **never touched `body`**.

The name is the label on the row. **The body is the instruction.** It is the
text sent to the model, and the text shown in the editor the moment somebody
opens the row. So the heading was refreshed and the paragraph underneath it was
not:

|                                 | before `…520` | after `…520` |
| ------------------------------- | ------------: | -----------: |
| "storefront" in `description`   |             2 |        **0** |
| "storefront" in `body`          |             6 |        **6** |
| em dash in `name`/`description` |             0 |            0 |
| em dash in `body`               |            14 |       **14** |

The six were `support-persona`, whose first line read:

> You are the customer-support assistant for {{business_name}}, **embedded in
> its storefront chat.**

`default-prompts.ts` has said "answering in the chat on its site" for months.
The migration's own `RAISE NOTICE` reported 51 rows refreshed and was telling
the truth about the columns it had chosen.

[[feedback_a_fix_leaves_its_neighbour_behind]] — a fix applied to one of the
columns a row shows, with the sibling column left carrying the same wrong word.

`20270521000000_the_instruction_itself_still_said_storefront` does the bodies.
It uses `replace()` rather than an assignment, because `sample-support-persona`
interpolates the demo pack's label into its first line ("a florist & plants
business") and has no single literal to assign. Three phrases, counted first,
covering every stale row with none left over:

```
", embedded in its storefront chat."   6 rows
"genuinely helpful — never pushy"      8 rows
"No emoji spam — one or two at most."  6 rows
remaining em dash / "storefront"       0 rows
```

Afterwards, every one of the nine platform prompt keys matches its source file
exactly, on all three of `name`, `description` and `body`.

## And the writer went on writing the old words

`20270520` states in its own header that it is "a no-op on a fresh install
because the seed already writes the new text." That is true of
`default-prompts.ts`. It is **false of `sample-data/engine/ai.ts`**, which
seeds the four `sample-*` demo prompts and was never looked at:

| Key                          | What the migration wrote into every row        | What the seed still wrote         |
| ---------------------------- | ---------------------------------------------- | --------------------------------- |
| `sample-support-persona`     | How the chat assistant sounds                  | **Support assistant persona**     |
| `sample-product-description` | Turns a few notes into a finished description… | …polished, **benefit-led** copy   |
| `sample-win-back-email`      | A warm note to somebody who has not bought…    | **Re-engages a lapsed** customer… |

So every demo tenant created after that release would have had the old words
back. **A migration that fixes rows without fixing the writer buys one release
of quiet.** The seed matches now, and says in a comment why it has to.

## The Add palette had never been read by any copy guard

Chasing the same shape one level out: `platform_components` is the builder's Add
palette, 138 entries, and the description is what Devi reads when choosing what
to put on her page. **90 of those rows were stale** — 75 descriptions and 15
names still carrying an em dash their source file had dropped.

That half needed no migration. The platform seed is an idempotent upsert by key
that writes `description`, and the release's data stage runs it on every deploy,
so production self-heals. Dev had simply not been seeded since the sweep.
Running it cleared all 90.

**Which left one row the seed could not fix, because the source said it:**

> Account menu — The **storefront** sign-in / account **affordance**. Sign in /
> Sign up when signed out, an avatar dropdown…

Retired word, then a word from design school, in the first ten. So the 138 were
scanned properly:

| Word                                     | Entries | Verdict                                        |
| ---------------------------------------- | ------: | ---------------------------------------------- |
| `responsive`                             |       9 | jargon, and the sentence already explained it  |
| `semantic`                               |       3 | means nothing to a person choosing a section   |
| `CSS` / `no scripting` / `no JavaScript` |       4 | how it is built, not what it does              |
| `CTA`                                    |       2 | **the NAME in the palette**, not the body text |
| `storefront`                             |       1 | the retired word                               |
| `affordance`                             |       1 | jargon                                         |
| `bound to`                               |       1 | jargon                                         |
| `overflow`                               |       1 | jargon                                         |
| `variant`                                |       1 | jargon                                         |

22 entries rewritten, in both the source and the database. "CTA band" is
**Action band** now; its tags already carried `cta` and `call to action`, so
search still finds it. `stack` and `grid` were left: a stack of panels and a
grid of cards are ordinary English.

Before and after, on the same word list:

```
storefront 1 · affordance 1 · semantic 3 · CSS 2 · no scripting 2
CTA 2 · bound to 1 · overflow 1 · variant 1 · responsive 9      →  all 0
```

## The guard that promised to grow, and had not

Every one of the findings above lives OUTSIDE the console, and
`check:em-dashes` scans `piggles/apps/workbench` and nothing else. Its own
header has always said it "will grow to the seed packages." It had not.

So the guard reads them now: the Add palette, the demo business, the prompt
library, the built-in reports, the legal templates, the module presets, the
silica catalog and the email templates. **Nine shared trees, 292 files, 1,869
sentences** that no copy guard in the repo had ever looked at.

It found nothing today, because the sources had all been swept and it was the
ROWS that were stale. That is the point: this half stops the next one being
typed.

```
check:em-dashes — 12599 sentence(s) across 1713 file(s)
  the console   10730 sentence(s), 1421 file(s)
  the seeds      1869 sentence(s),  292 file(s)
```

Both halves' counts print separately, because a tree move in `wizeworks` would
otherwise leave the console's healthy numbers covering for a seed half that had
gone blind, and each half asserts its own denominator.
[[feedback_structural_checks_go_blind]]

**Proved red before it was believed**: an em dash planted in the Add palette's
`data_table` description and the guard named the file and the line.
[[feedback_a_test_that_cannot_go_red]]

## Files

- `wizeworks/packages/db/prisma/migrations/20270521000000_the_instruction_itself_still_said_storefront/migration.sql` (new)
- `wizeworks/packages/db/src/sample-data/engine/ai.ts`
- `wizeworks/packages/builder-schemas/src/catalog/{navigation,data-display,actions,commerce,email,feedback,marketing,content,layout}.ts`
- `piggles/scripts/check-em-dashes.mjs`

## Measured, not swept

3,546 rows across 71 text columns in the dev database still hold an em dash. The
scan that found them is worth keeping, but most of those rows are a TENANT's own
words, not the platform's: a product title, a note a rep typed, a review a
customer left. An em dash in somebody else's sentence is theirs. The platform's
own share was the four columns above, and they are done.

## The thing to remember

**A migration's name is a claim about a row, not about a column.** This one said
"the ready-made instructions stop saying storefront" and refreshed everything
about those instructions except the instruction. The check that caught it was
re-counting the same query after applying, which takes one minute and is the
only thing that would have.
