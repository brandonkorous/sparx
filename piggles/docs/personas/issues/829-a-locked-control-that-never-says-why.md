# 829 — A locked control that never says why, and a ladder a viewer could edit

**Status:** fixed
**Severity:** correctness + copy
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles workbench — Campaigns, and one campaign
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi

## The last step is greyed out and nothing says why

A campaign's steps run from the first thing somebody does to the outcome you
want. The last one is special: exactly one step converts, it is always last, and
the server refuses a ladder shaped any other way. `stage-row.tsx` says all of
that, in its own comments, to whoever reads the file.

On the screen, the last row simply had three dead controls: its dropdown locked,
its move buttons locked, its delete button greyed. Devi's reading of a greyed
delete button is not "this is the outcome and must stay last" — it is "this is
broken", or "I am not allowed to, and nobody has said why".

It now says so, in the row:

> This is the outcome you are counting towards, so it stays at the bottom and
> cannot be removed. You can still rename it.

The last clause matters as much as the first. Two of the four controls on that
row still work, and a person who reads "locked" as "all of it is locked" will
not try the one that would have done what they wanted.

## A dropdown with a label only a screen reader could hear

Beside the step's name field sat a `<Select>` carrying `aria-label="What this
step counts"` and no visible label at all — against a neighbour with a proper
`<FieldLabel>`. So a screen reader was told what the control was for, and the
person looking at the screen was not. It is the inverse of the usual
accessibility gap and it is still a gap.

It has a visible **What it counts** label now, in a real `<Field>`, like every
other control in this console. Same fix on the report's period picker, which had
`aria-label="Report period"` and now says **Covering**.

## A hint that offers a thing this console cannot make

Under the page field on a "visited a page" step:

> Leave this empty to count visits to the campaign's landing page.

A campaign's landing page is `funnels.entryPageId`. **Nothing in either console
sets it.** It is settable over the API and by nothing a person can click, so for
every campaign Devi will ever make here, it is null — and leaving that field
empty counts nobody, which is a different sentence from the one she read.

The pane already knew. `campaign-draft.ts` blocks the **Turn it on** button with
_"Say which page counts as …"_ in exactly this case. So one part of the pane told
her to leave a field empty and another refused to let her run the campaign
because she had. [[feedback_a_promise_in_copy_is_a_contract]]

The hint is now told whether the campaign has a page of its own, and says the
true thing either way:

> The address of the page on your site, starting with a slash — /spring-sale, or
> just / for your home page. This campaign has no page of its own, so a step with
> nothing here counts nobody.

## A viewer could rewrite the whole ladder

`StageLadderEditor` takes `disabled` and passed it to exactly one thing: the
**Add a step** button. `StageRow` had no `disabled` prop at all.

So somebody whose role is below editor could rename every step, change what each
one counts, reorder them and delete them — the whole ladder — and only find out
at the Save button, which was correctly disabled the entire time. Then the
leave-guard would ask them to confirm discarding work that was never theirs to
do.

`disabled` now reaches the input, the dropdown and all three buttons.

## An error that took the whole pane down with it

Campaigns did this:

```tsx
if (funnels.isError) {
  return (
    <div className={PANE_SHELL}>
      <PaneLoadError … />
    </div>
  );
}
```

`pane-load-error.tsx` names that exact shape in its own header as the thing never
to do: an early return drops the toolbar, the search, the filters and **New
campaign** along with the list. None of those is broken when a read fails, and
changing a filter re-runs the query, which is a second way out that this took
away. The failure branches inside the content region now, and the toolbar's count
says **Could not be read** rather than a confident zero.

The report panel had the opposite problem and the same root: on a failed read it
printed one sentence and **no retry**, the only dead end on the pane. It gets the
house shapes: `PaneWaiting` while it works, `PaneLoadError` with a retry when it
cannot.

## "Try different words" to somebody who typed no words

The no-match state said:

> No campaigns match that
> Try different words, or show every campaign again.

Two causes, one piece of advice. Press the **Running** chip with an empty search
box and the screen tells you to change words you never typed. It now names
whichever one is hiding them, in the chip's own words, and carries the button
that undoes it:

> You have campaigns, but none of them is showing under Running.
> [ Show every campaign ]

[[feedback_one_outcome_two_causes]]

## The bar said nothing

Campaigns had an empty status slot, so the one fact anybody wants before reading
a list — how many are there — could only be got by counting rows. It says
**1 campaign**, and **0 of 1 campaign** when a filter is hiding some, because the
filtered number alone would claim the others do not exist.

## Files

- `piggles/apps/workbench/surfaces/funnels/{campaigns,campaign,campaign-setup,campaign-report,stage-editor,stage-row}.tsx`

## The thing to remember

**A disabled control is a sentence the screen has decided not to finish.** Every
one of them is the product of a rule somebody wrote down — here, in the file's
own comments, three times over. The rule is right. Keeping it off the screen is
what makes a working product look broken.
