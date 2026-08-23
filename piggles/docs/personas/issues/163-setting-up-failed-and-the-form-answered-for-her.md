# 163 — Setting up failed, and then the form answered for her

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 1
**Surface:** getpiggles › Set up your business
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** the same three answers, resubmitted — below

## What happened

Devi filled in the two questions: **Juniper Row**, **Clothing & accessories**,
and ticked _I need a website_, _I sell things_, _I deal with customers_. The
panel beside the form counted up to 13 apps as she went. She pressed **Take me
in**, waited, and got:

> We saved your details but could not finish setting things up. Please try again.

Then she read the form underneath it. It said:

| Field         | What she had entered   | What it said afterwards |
| ------------- | ---------------------- | ----------------------- |
| Business name | Juniper Row            | **Devi's workspace**    |
| Kind          | Clothing & accessories | **Food & drink**        |
| What you do   | three ticked           | **none ticked**         |

The panel beside it still said **13 apps** with Partners lit up — so the screen
was disagreeing with itself, one half showing her answers and the other showing
answers nobody gave.

"Please try again" is the instruction on the screen. Following it, exactly as
written, sets up a womenswear label as a **food and drink** business under the
name **Devi's workspace**.

## What should have happened

A failed attempt leaves her answers alone. She presses the button again and the
same three answers are sent again — that is the whole meaning of "try again", and
the action is documented as safe to repeat.

If anything, the answers were the one part that DID work: the tenant row already
reads `Juniper Row` and `railGroups: [web, sell, people]`. The screen threw away
a copy of something the database had already accepted.

## How to reproduce

Every time, whenever furnishing fails for any reason.

1. Sign up and reach **Set up your business**.
2. Enter `Juniper Row`, pick **Clothing & accessories**, tick three boxes.
3. Press **Take me in** with the furnishing step failing.
4. Read the form. Name, trade and ticks are all somebody else's answers.

## Why it matters

The trade is the most consequential answer on the screen — it picks the sample
catalogue, the tax and shipping presets, the categories, the size charts. Getting
it silently swapped from clothing to food is not a cosmetic reset; it is the
screen filling in a different business and inviting her to confirm it.

"Food & drink" in particular is not even a blank. The empty option is disabled,
so a browser resetting the control lands on the first one that is selectable —
which is the top of the list. An accidental answer that looks like a deliberate
one is the worst of the possible failure states.

## Where it lives

[piggles/apps/account/components/onboarding.tsx](../../../apps/account/components/onboarding.tsx)

React resets a form's DOM after every `<form action>` completes, failures
included. It then re-applies only the props that **changed** since the previous
render — and after a failed attempt nothing changed, because the component's own
state was never touched. So:

- `businessName` is uncontrolled with `defaultValue={suggestedName}`, and
  `suggestedName` is still the placeholder the page loaded with.
- `trade` is controlled, holds `apparel`, and React writes nothing because
  `apparel === apparel`. The DOM keeps what the reset left: the first
  non-disabled `<option>`.
- The checkboxes go the same way, which is why `picked` still counted 13 apps in
  the panel while every box on screen was clear.

Being controlled is not enough on its own. React only writes what differs.

## The fix

The answers move out of reach of the reset, into
[onboarding/use-answers.ts](../../../apps/account/components/onboarding/use-answers.ts),
and each question block is keyed on an attempt counter that the hook bumps
whenever an attempt comes back with an error. A key re-mounts, and a re-mount
writes every value rather than only the changed ones — which is the part being
controlled could not do on its own.

The name became controlled too. It was uncontrolled on `defaultValue`, which is
what let it fall back to a placeholder the tenant had already stopped using.

RULE #0.5 came with the edit: `Onboarding` was a 106-line function, so it split
into the hook above, a
[business-fields.tsx](../../../apps/account/components/onboarding/business-fields.tsx)
for the two fields, and a 97-line frame — joining `choices.tsx` and
`look-picker.tsx`, which were already their own files for the same reason.

**Not fixed, because it is not broken:** the message itself. "We saved your
details but could not finish setting things up" is true, says which half
survived, and the retry it asks for is genuinely idempotent.

## Confirmed by

Re-ran act 1 as Devi with furnishing still failing — which is what made this
provable today. Typed `Juniper Row`, picked **Clothing & accessories**, ticked
the same three, pressed **Take me in**, and read the screen after the same red
message came back:

| Field         | After the failed attempt |
| ------------- | ------------------------ |
| Business name | Juniper Row              |
| Kind          | Clothing & accessories   |
| What you do   | the same three, ticked   |
| The panel     | 13 apps                  |

Every answer where she left it, and the panel agreeing with the boxes instead of
contradicting them. Pressing the button again now retries what she actually
entered.

## Note on why furnishing failed

Not this defect, and not a product fault: `PIGGLES_API_REST_URL` points at
`localhost:3100`, and in this dev stack port 3100 is answering as an unrelated
Next app called **Jotacular**, so api-rest never started there. The account app
POSTs the furnish request, gets an HTML 404 back, and reports it honestly.

The same missing service is why the **look picker** was not on the screen at all:
`listBlueprints` returns an empty list on any non-2xx and the shelf renders
nothing — deliberately, so a picker that cannot load never blocks a signup.

Recorded here because it is what exposed this defect. Raised with Brandon
separately; the run cannot get past act 1 until api-rest has its port back.
