# 705 — "That didn't save", every time, for everything, for ever

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 246
**Surface:** mypiggles + sparx — every pane
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen, plus a new check proved red
**Blocked on:** —

## What happened

Devi pressed **Check now** on the stock check. The status strip answered:

> ● Saved just now

Nothing of hers was saved. She ran a check.

Pulling that thread found the bigger half. `WriteMeta.writing` exists so a failed
write can name itself, is documented down to why it matters, and is read by
`write-failure-reporter.tsx`:

```ts
title: meta.writing ? `Couldn't save ${meta.writing}` : "That didn't save",
```

```
mutations in the piggles console                 712
mutations in the sparx console                   699
mutations that have ever set `writing`             0
```

Zero. In both. The named branch had **never run once**, so every failed write in
either console has always said the same nine words, and the generic fallback
looked like the design rather than like the thing that happens when nobody filled
the field in. [[feedback_screen_over_a_function_nobody_calls]]

## Why it matters

Two separate wrongs, and the second is the sharp one.

**The toast names nothing.** A failed write toast stays until dismissed, by
design, because the screen still shows the change as though it landed. It arrives
while she is three panes away and says "That didn't save" about an unnamed
something.

**The Saved clock lies.** 31 of those mutations do not save anything of hers at
all — re-running the stock check, recomputing reorder points, previewing a file,
re-scoring pages. The status strip moved its clock for every one of them. That
clock is documented, in its own source, as the answer to one question:

> This is the one place people look to check their work is safe, so it must never
> report a save that is not theirs.

A check she runs after a save that silently failed answers it **yes**.
[[feedback_a_promise_in_copy_is_a_contract]]

`housekeeping` was the wrong flag for these: it also silences the failure, and she
asked for these, so their failure is hers to hear. There was no third thing to
say.

## What was changed

`WriteMeta.running` — a verb phrase in her words, meaning "this RAN something,
it did not save anything of hers". Two consequences, both of them the point:

- the Saved clock does not move
- the failure reads `Couldn't ${running}` rather than `Couldn't save …`

```
"Couldn't check your stock"
"Couldn't work your reorder points out again"
"Couldn't read that file"
```

Set on all 31. The title logic moved out of the reporter into
`writeFailureTitle(meta)` so it could be tested at all.

## Guarded

`scripts/check-running-meta.mjs`, wired into `pnpm check:running-meta` and
`.githooks/pre-push`. The rule is per-MUTATION-BLOCK, not per file: a surface
file holds a dozen hooks and most are ordinary saves, so a file-level rule goes
green the moment any one of them is named.
[[feedback_structural_checks_go_blind]]

Proved red three ways:

1. **It found four sites the hand-written list had missed** — `/v1/search/reindex`
   and `/v1/crm/scoring/recompute`, in both consoles.
2. **Its first draft went green over its own worked example.** The verb-suffix
   regex did not match `/v1/inventory/integrity/reconciliation`, the mutation the
   whole thing was written for. A rule that cannot catch the case that motivated
   it is not a rule yet. Two job-nouns joined the verbs; actions went 27 → 31.
3. Moving the scan roots fails loudly instead of printing a tick over no work.

```
check-running-meta: 2367 files, 1411 mutations, 31 of them actions, across 2 consoles.
```

Deliberately **not** a rule that every mutation must set `writing`. 1,411 of them
do not, each needs a human sentence, and a check nobody can make green is a check
somebody turns off. That sweep is real and unstarted; the denominator above is
its size.

## Confirmed

Pressed **Check now** on a reloaded pane. The run landed (76 levels, 09:27:10 on
the database). The status strip read `● Online` and nothing else.
