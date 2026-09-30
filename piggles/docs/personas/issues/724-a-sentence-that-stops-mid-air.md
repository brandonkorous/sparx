# 724 — A sentence that stops mid-air

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 255
**Surface:** mypiggles + sparx workbench — Paying for what sold, and 59 scrolling columns across both consoles
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: both explanations read to the end, and the column has a scrollbar
**Blocked on:** —

## What happened

Opened **Paying for what sold** under Stock. Two sections, both empty, both with
an explanation under the picture. They read:

> Either you hold no consigned stock, or every sale from it has already been
> settled with its

> A settlement closes a stretch of time against one owner: everything of theirs
> that sold, at the cost agreed when it arrived, with a

Both stop mid-sentence. No ellipsis, no fade, nothing to click. The words are
simply gone.

## Why it matters

There was **no scrollbar anywhere on the pane**, so there was nothing to
suggest the rest existed. MEASURED live: the first card is 429px tall and its
content needs 555. The outer column's `scrollHeight` equals its own height, so
by every measurement the browser takes, the pane fits.

`PANE_SHELL_SCROLL` in `components/pane-toolbar.tsx` has carried the whole
explanation in its own header since issue 505:

> `[&>*]:shrink-0` is the whole reason this exists, and leaving it off does not
> look like a bug, it looks like a shorter form. PANE_SHELL is a flex column,
> and silica's `.card` sets `overflow: hidden`, which makes `min-height: auto`
> resolve to 0: a card is then free to shrink below its own content and clip the
> remainder, with no scrollbar of its own to get it back.
>
> A counting schedule in a 908px pane was hiding 459px of itself that way.

That is written about the pane SHELL, and it is applied to the pane shell.
**MEASURED 2026-09-19: 59 INNER scroll columns in the two consoles were the same
shape without it.** [[feedback_a_fix_leaves_its_neighbour_behind]]

## Why only one pane showed it

The squash needs content taller than the column. Fourteen other panes drawn by
files with an unguarded column were checked live and all read to the end today.
This one bites because both its sections hold a full-size empty state, picture
and all, and two of those do not fit in one pane.

So this is a latent fault with one live symptom, not fifty-nine broken screens.
The fix is to stop it being latent.

## What was done

**55 columns guarded**, both consoles, one class each: a column that scrolls
must not squash its children, because that is what scrolling is for.

**4 left alone**, and the reason is in the check: on the mailbox and phone-system
lists the column's own direct child carries `flex-1` and is deliberately filling
it. Telling that child not to shrink argues with the instruction the file
already gave. They are named in the guard rather than detected, so a fifth is a
decision somebody makes on purpose.

**`scripts/check-scroll-squash.mjs`** — new, wired into
`pnpm check:scroll-squash` and pre-push. It prints the denominator.

The sweep's own rule for skipping was read off the DIRECT children, not any
descendant: a first pass that looked at grandchildren flagged ten columns as
risky and eight of them were nothing of the sort.

## Files

- 51 surfaces across both consoles — one class each
- `scripts/check-scroll-squash.mjs` — new, wired into pre-push

## Proof

Take the class off the consignment column: the check exits 1 naming the file and
the line. Restored: `59 scrolling columns in the two consoles, and every one of
them keeps its children their own height.`

On screen: both sentences now read to the end ("…settled with its **owner**",
"…with a **document to pay against**"), the column has a scrollbar, and the
live probe for unreachable text returns nothing. Transfer detail, the pack
bench and a purchase order were re-checked after the sweep and render
unchanged. 999 piggles tests and 873 sparx tests pass; both typechecks and
ESLint clean.
