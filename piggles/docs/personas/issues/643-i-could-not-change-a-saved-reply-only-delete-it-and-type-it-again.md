# 643 — I could not change a saved reply, only delete it and type it again

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 222
**Surface:** mypiggles › Messages › Setting it up › Quick replies
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 222 (her own opening hours, changed and saved on screen)

## What happened

Messages › **Quick replies**. Eight saved replies, seven of them written by the
platform the day my chat box came on, and one of them says:

> **Business hours** `/hours`
> Our team is here Monday to Friday, 9am to 5pm. If we miss you, leave your
> email and we'll follow up as soon as we're back.

Those are not my hours. My studio answers on Tuesday to Saturday. I need to
change nine words in a sentence my customers are being sent.

**Every row on this screen had exactly one button: a red bin.** No pencil, no
link on the name, nothing to click on the row itself. The only way to fix nine
words was to delete the whole reply and type a new one, remembering the shortcut
`/hours` and remembering to set it back to all my sites, with the reply missing
from my team's inbox in between.

Measured 2026-09-18:

|                                              |         |
| :------------------------------------------- | ------: |
| saved quick replies on this platform         | **102** |
| ever changed since the day they were written |   **0** |

Zero is not "nobody wanted to". Nothing could change one.

## The code that seeds them says the opposite

`quick-reply-service.ts`, above the seven defaults:

> Generic, industry-agnostic copy **the tenant edits or replaces**.

That was the plan. Only the "replaces" half was ever built.

## The neighbour that has had a pencil all along

Customers › **Saved paragraphs** is the same idea one module over: reusable text
with a shortcut, kept by the person who knows the fact. It has an edit pencil,
and its own note says exactly why:

> a paragraph is usually a FACT about the business — **the opening hours, the
> returns policy, the lead time** — and whoever knows that fact should be able to
> fix it in one place.

Three of the seven replies seeded here are called **Business hours**, **Returns**
and **Shipping times**. The reasoning was written down, applied next door, and
not carried across. [[feedback_a_fix_leaves_its_neighbour_behind]]

## The fix

A **PATCH `/v1/chat/quick-replies/:id`**, and a pencil on every row that loads
the reply into the form already on the pane.

**One form, not a second one.** This pane deliberately has no create modal, and
its own header says why: a modal is invisible to the unsaved-work guard, so a
half-written reply would close without asking. An edit modal would have been the
same mistake twice. Pressing the pencil renames the form to **Change "Business
hours"**, fills the boxes, swaps **Add quick reply** for **Save changes** beside
a **Cancel**, and rings the row it came from in the app's own color so the two
halves of the screen are joined.

**The shortcut is shown as a fact, not offered as a box** — the same rule the
saved-paragraphs screen states. It is what a team types without thinking, so
re-pointing `/hours` breaks the habit everywhere at once while the old word
quietly returns nothing. Half an exception, though, and the half matters: a quick
reply's shortcut is optional, so a reply can be sitting there without one, and
there no habit exists to break. **Giving a reply its first shortcut is allowed;
changing one already in use is refused.** Without that, adding a word to an
existing reply would mean deleting and retyping, which is this issue again.

**Which sites offer it stays where it is unless she moves it.** An omitted site
on a PATCH means "leave it", never "stamp the one I am looking at" — otherwise
fixing a typo would drag a reply shared across all seven of her businesses back
to one of them.

**A save that changes nothing says so.** Pressing Save on a reply she only read
answers **"Nothing to change — 'Anything else' already says exactly that"** and
writes nothing, so `updatedAt` keeps meaning "when the wording last moved". That
is the rule the review queue learnt the hard way in
[640](640-it-said-it-published-a-review-that-was-already-published.md).

## Confirming it

Driven as Devi:

1. Pressed the pencil on **Business hours**. The form became **Change "Business
   hours"** with her words in it, `/hours` shown as a fact with the reason
   underneath, and **All my sites** already selected.
2. Replaced the message with her real hours and pressed **Save changes**.
   Toast: **"Business hours" saved.**
3. Read back from the database: exactly one of her eight rows now has
   `created_at <> updated_at`, and its shortcut and its site are untouched.
4. Pressed the pencil on **Anything else** and pressed Save without typing.
   Toast: **Nothing to change — "Anything else" already says exactly that.**
5. Held at 380px: the form stacks to one column, the shortcut becomes the badge
   and its sentence, and Cancel and Save changes stay side by side and reachable.

## Guard

`quick-reply-words.test.ts` in both consoles, **14 new tests** (21 in the file).
The rules:

```ts
it('finds nothing in a reply she only opened and read', …)
it('never reports the shortcut of a reply already in use', …)
it('does report the FIRST shortcut on a reply that had none', …)
it('leaves scope alone while it does not yet know which site it is on', …)
```

Proved red by removing the shortcut rule: **5 of 21** fail. Proved red again by
letting the site comparison run before the site id is known: **1 of 21** fails.

`quick-reply-update.test.ts` against real Postgres, **7 tests** through the
routes the console calls: the ordinary edit, the refused re-point, the first
shortcut, a clashing first shortcut, no re-stamp when nothing moved, the site
left alone on a later typo fix, and the module gate. Proved red by taking every
field unconditionally: the no-re-stamp test fails. Proved red again by dropping
the in-use refusal: the re-point test fails.
