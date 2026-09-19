# 550 — "Could not create this. Could not create this."

**Status:** fixed and proven
**Severity:** medium
**Found by:** Devi, writing up her autumn sample sale
**Surface:** `piggles|sparx/apps/workbench/components/save-failure.tsx` + `surfaces/cms/content-detail.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_one_outcome_two_causes]] · [[feedback_never_present_absence_as_measurement]]

## What she saw

She filled in the title and the description, missed the **Starts** box, and
pressed Create:

> **Could not create this**
> Could not create this. Nothing was saved.

The same sentence twice, naming nothing. Nothing marked on the form. The form is
long enough to need scrolling twice, so finding the box means reading every
label looking for the word "(required)" and checking each one.

The Starts box was not even empty-looking. A date box's year segment takes SIX
digits, so typing a date into it left `mm/dd/100320 02:06 --` sitting there — a
filled-looking box the browser reports as `value: ''` (the same control that
produced issue 535).

## The two things wrong

**The server knew which box.** It answers per-field `details` naming
`body.startAt`, and `apiErrorMessage` deliberately throws that away:

> _"The SCHEMA layer reporting on itself. … Shown to a business owner it explains
> nothing and reads like their fault, so the caller's fallback wins."_

That judgement is right. Discarding was the wrong conclusion from it: the
content type carries `label: 'Starts'` for that very key, so the answer could
have been said properly. And none of it needed the server at all — the schema is
in the editor's hand while she types.

**The refusal reads itself out twice.** `<SaveFailure>` takes a title in the
surface's own words and a message, and a fallback message is written to stand
alone, so it opens with the title's own words. 55 surfaces pass a title and a
fallback through that component.

## The fix

**`surfaces/cms/required-fields.ts`** — the required boxes still empty, named in
her words, checked BEFORE the request so she never waits on a round trip to be
told nothing. Empty means exactly what `pruneEmpty` strips, because that is what
the request carries; asking the same question twice in two places is how the two
come to disagree. So `0` and `false` are FILLED — a price of zero is a price,
and a check that called it empty would refuse to let her save a free thing.

Names every missing box rather than the first: being sent back one at a time is
its own small cruelty on a form this long.

**`components/save-failure-words.ts`** — `messageBeyondTitle` drops a leading
repeat of the title and keeps what follows, so the same refusal reads:

> **Could not create this**
> Title and Starts need filling in before this can be saved.

Matched on letters alone, so a trailing full stop, an em dash or a capital
cannot hide the repeat, and the remainder keeps its own punctuation. A message
that says something else entirely comes back whole — the server's own sentence
is the reason a description exists at all. Fixed in the component, so all 55
surfaces get it, including the fallback somebody writes next month.

## Proven

On her screen: "Could not create this / Title and Starts need filling in before
this can be saved."

8 guards on `messageBeyondTitle`, 11 on the required-fields rule. The first run
of the `messageBeyondTitle` guards caught a real fault in it: the letter-walk
counted the spaces that `letters()` puts in place of punctuation, so
`"That key could not be used: it's expired."` came back as `"pired."`.
