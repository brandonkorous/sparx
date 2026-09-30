# 702 — "Wanted 1, had 0", and no reason, on the pane called Things that do not add up

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 246
**Surface:** mypiggles + sparx — Stock › Things that do not add up
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen, plus a test proved red
**Blocked on:** —

## What happened

The refused-sale table has a column for what the customer wanted and a column
for what she had:

| Item              | What happened | Wanted | Had |
| ----------------- | ------------- | -----: | --: |
| The Ash Overshirt | Sale refused  |      1 |   0 |

That is the whole row. If there are five of the thing in her building and the
row says she had none, the honest reading is that Piggles has lost count — on
the one pane whose entire job is to tell her whether it has.

## Why it matters

Four terms decide what is free to sell:

```
on_hand - allocated - safety_buffer - unsellable_on_hand
```

Three of them are recorded on every incident, and the pane's own heading
promises them:

> Each one remembers what the system believed it had at that exact moment.

`onHandAtDecision`, `allocatedAtDecision` and `bufferAtDecision` were fetched by
`integrity-data.ts`, carried across the wire, typed in the console, and drawn by
**nothing**. [[feedback_fetched_but_never_rendered]]

The fourth term is the one that makes the row look like a bug. A quarantined or
damaged unit is counted in on-hand, because it genuinely is in the building, and
cannot be sold to anybody. So "5 in the building, 0 free to sell" is correct and
unexplainable at the same time.

This was made reachable by [691](691-the-screen-said-you-could-make-none-and-the-button-made-one-anyway.md).
Before that fix the reservation guard had three terms, so the subtraction always
came out even and no row could fail to add up. Fixing the guard is what made the
record incomplete. [[feedback_a_fix_leaves_its_neighbour_behind]]

```
incidents on the database                                       7
of those whose three stored terms fail to explain the fourth     0   (all pre-date the guard fix)
inventory levels with anything unsellable                        1 of 630
```

## What was changed

The cell now says where the rest went:

```
0
5 on the shelf: 5 not fit to sell
```

The fourth term is **derived, not stored**. It is exactly recoverable:

```
onHand - allocated - buffer - available  ===  unsellable
```

A fourth column would be a value that can only ever disagree with the other four
later; the subtraction cannot. On a row written before the guard had four terms
the residual is zero, which is the correct answer for it — that sale really was
decided without the quarantine shelf in the arithmetic.

`negative_on_hand` is excluded. Its `availableQuantity` means "what the level
held before the movement", not "what was free to sell", so the same subtraction
would invent a quantity. [[feedback_one_outcome_two_causes]]

The words are the ones the provenance pane and the build guard already use —
spoken for / not fit to sell / held back — so the four terms are named the same
way everywhere a person meets them.

## Guarded

`integrity-verdicts.test.ts`. Dropping the fourth term out of
`heldBackAtDecision` reddens three of its cases, including the one that adds the
named parts back up:

```
× names the quarantine shelf, which is the term nothing records
× lists all three holds in the order a person would check them
× adds up: the parts it names come back to the number it started from
    AssertionError: expected 15 to be 20
```

Restored: 14 passed. [[feedback_a_test_that_cannot_go_red]]
