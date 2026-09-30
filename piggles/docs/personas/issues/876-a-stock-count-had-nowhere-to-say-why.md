# 876 — A stock count had nowhere to say why a number was different

**Status:** fixed
**Severity:** **major** — a count is the one screen whose job is to disagree
with the system, and applying it rewrites the stock numbers and writes a
movement for every correction. The figures therefore survive perfectly and the
REASON is thrown away. Every line Juniper Row has ever counted came out
different, and not one of them could carry a word about it
**Found by:** P03 · act 311, opening Stock by data weight
**Surface:** mypiggles › Stock › Stock counts › a count, in both consoles
**Filed:** 2026-09-29
**Fixed:** 2026-09-29
**Confirmed by:** 16 tests, every rule proved red on a plausible wrong version

## Measured

```
count lines on the platform                 130
of those, counted                            63
of those, DIFFERENT from what was expected   63   (all of them)
of those, carrying a note                     0

Devi's own                                  124 lines, 62 counted, 62 different, 0 notes
```

Sixty-three for sixty-three. Not "rarely different" and not "rarely
explained": **always different, never explained, because it could not be.**

Her one applied count reads, on screen, as sixty-two rows of

```
The Ash Overshirt · ASH-OVERSHIRT      We think 0    Counted 6    +6
```

and the list summarises it as **"62 items · 372 units corrected"**. Three hundred
and seventy-two units of stock moved on her say-so with no record of why.

## The chain

`inventory_count_lines` has carried a `note` column since the table was created.
Everything behind the console is finished:

- `EnterCountsInput` accepts `note` per entry, capped at 2000.
- `enterCounts` writes it: `...(e.note !== undefined ? { note: e.note } : {})`.
- `getInventoryCount` reads it back on **every** line: `note: l.note`.
- The console's own `useEnterCounts` forwards it:
  `...(entry.note !== undefined ? { note: entry.note } : {})`, and `CountEntry`
  declares it.

And then the caller:

```ts
const saveEntries = () =>
  enter.mutateAsync(
    changed.map(({ line, value }) => ({ lineId: line.id, countedQuantity: value }))
  );
```

**Every layer was built and the last one never passed it.** No box collected one
either: the row is Item, We think, Counted, Difference, Remove.
[[feedback_screen_over_a_function_nobody_calls]]

## What it costs

The number is the cheap half. "Counted 4 where we thought 6" is two units, and
two units is not a finding. WHY it is two units is three completely different
jobs:

- **Four went to the Saturday market** is a sale that never got rung up.
- **Two were damaged** is a supplier or a handling problem.
- **A whole box was at the back** is a receiving problem.

Same correction, same movement row, same figure in every report. The count is
the only moment anybody knows which, and it was the one moment with nowhere to
write it down. A month later the movement history says `-2 · count` and the
person who knew has forgotten.

## Who gets asked

Not every line. A box under all 124 lines of a full count is a wall nobody
reads, and it demands an explanation from lines that have nothing to explain.
The rule is its own tested file, `count-why.ts`, byte-identical in both consoles:

```ts
export function askWhy(facts: WhyFacts): boolean {
  if (facts.hasWords) return true;
  if (facts.counted === null) return false;
  return facts.difference !== 0;
}
```

- **Nothing counted yet** — nothing to explain, and no quantity for the server to
  hang a note on.
- **It matched** — nothing to explain.
- **Everything else** — including the two kinds of unknown difference: an item
  found on the shelf that was not on the list, and every line of a BLIND count
  while it is open, because a blind count withholds the expected number from the
  person counting.
- **It already holds words** — first, and unconditionally. Somebody types "four
  went to the market", then realises they miscounted and corrects 8 back to 12.
  Without this line the box disappears mid-sentence and takes the sentence with
  it.

### A branch that could not go red

The rule first carried a fourth line, `if (facts.blind) return true`. Deleting it
left all ten tests green, because a blind count's difference is null on every
line by construction, so `difference !== 0` already returns true for all of them.
It was not a rule, it was a comment that ran, and it was deleted rather than
propped up with a fixture that could not occur.
[[feedback_a_test_that_cannot_go_red]]

`blind` still decides the WORDS, which is a real difference: the counter is not
allowed to see the expected number, so they cannot be asked why it differs.

## What it says

Once under the table heading, not as a label over every box — a full count is a
hundred lines, and a hundred repetitions of four words is wallpaper:

```
Where a number does not match, say why. Only your team sees these, and they
stay on the count after your stock is corrected.
```

On a blind count the first sentence becomes _"Note anything worth knowing as you
go."_ Both promises in the second half were checked before they were written:
`note` on a count line is read by the two consoles and nothing else — no email,
no invoice, no customer page — and the lines are kept when a count is applied.
[[feedback_a_promise_in_copy_is_a_contract]]

The box's own label exists for a screen reader and names the item
(`Why ASH-OVERSHIRT is different`), because the same four words read out a
hundred times identifies nothing. The grey example inside it is a real sentence,
`Four went to the Saturday market. Two were damaged.`, because an abstract
prompt gets an abstract answer.

## Three states, not two

`countNoteWrite` in `@wizeworks/inventory` is the twin of `checkout-note.ts` in
`@wizeworks/commerce` (issue 874), and exists for the same reason: collapsing
two of the three states is invisible, compiles, and breaks something quietly.

```ts
export function countNoteWrite(sent: string | null | undefined): { note?: string | null } {
  if (sent === undefined) return {};
  if (sent === null) return { note: null };
  return { note: sent.trim() || null };
}
```

- **absent** — a bulk import, the scan-to-count flow, an older console. Not
  talking about notes, so leave what is stored alone. This is also what a plain
  quantity correction sends, so fixing a number never wipes the words beside it.
- **empty** — somebody deleted the words. That clears the note, and it is stored
  as NULL rather than `''`, so counting the filled notes on this table keeps
  meaning what it says.
- **text** — stored trimmed.

`CountEntryInput.note` moved from `.optional()` to `.nullish()` so a caller can
also say null outright.

## Proved

**16 tests** across the two new files, and every rule in them was proved red by
breaking the thing it guards:

```
drop the hasWords guard              →  "never takes away a box that is holding words"
drop the uncounted guard             →  "asks nothing of a line nobody has counted yet"
skip an unknown difference           →  2 fail: the unexpected item and the blind count
one label for blind and sighted      →  "never mentions a difference on a blind count"
falsy test instead of undefined      →  2 fail: the emptied box and the explicit null
drop the trim                        →  2 fail: whitespace, and the edges
```

**Checks:** typecheck 0 on both workbenches, `@wizeworks/inventory`,
`@wizeworks/commerce-schemas` and api-rest. Tests: piggles 163 files / 1522,
sparx 133 / 1221, inventory 13 / 159. ESLint and prettier clean. Guards green
including `check:console-parity`, `check:counted-in-words`, `check:counts-known`,
`check:count-ink`, `check:column-floor` and `check:inventory-api`.
`count-why.ts` is byte-identical in both consoles.

**Driven end to end on her own screen.**

On the open blind count CNT-000005: adding a line and typing 4 made the box
appear with the blind wording, Save reported **Counts saved**, and
`inventory_count_lines.note` held the sentence — **the first note ever written on
a count line on this platform**. Emptying it to three spaces and saving stored
**NULL**, not `'   '`. Finishing the count printed the words under the item on
the review screen beside **2 units short**, and applying it left them there under
the correction **-2**, which is the promise in the copy.

On a new sighted count CNT-000006, two lines both expecting 6: counting the first
as 6 gave **Matches** and **no box**; counting the second as 3 gave **3 units
short** and the box, with the sighted placeholder. Typing words into it and then
correcting the count back to 6 left the badge reading **Matches** and the words
still there, which is the `hasWords` rule on a real screen.

At 360px, set on the pane rather than by resizing anything, the box fits the item
column and wraps. The table itself already scrolled sideways at that width before
this change and still does: the give-cell floor is 224px and the Counted box is
96px, so the row cannot fit 360 whatever is in it. Recorded, not fixed here.

## Files

- `{piggles,sparx}/apps/workbench/surfaces/inventory/count-why.ts` (new, identical)
- `piggles/apps/workbench/surfaces/inventory/count-why.test.ts` (new)
- `piggles/apps/workbench/surfaces/inventory/{count-lines,count-session}.tsx`,
  `{count-actions,counts-data}.ts`
- `sparx/apps/workbench/surfaces/inventory/{count-detail.tsx,counts-data.ts}`
- `wizeworks/packages/inventory/src/services/count-note.ts` (new) + its test
- `wizeworks/packages/inventory/src/services/inventory-counts.ts`
- `wizeworks/packages/commerce-schemas/src/inventory.ts`

## The thing to remember

**The layer that collects is the one that gets left.** A column, a schema field,
a service write, a read-back and a client mutation were all built for this note,
correctly, and the only thing missing was the twenty lines that ask a person for
it. Five layers of evidence that the feature exists, and the feature does not.

The measurement that finds this shape is the same one that found 874:
**how many rows in this column are filled, and what would fill one?** The second
half is the half that matters. `note` had a writer in the service, a reader in
the API and a carrier in the client, and still nothing on earth could fill it.
