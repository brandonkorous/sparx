# 527 — The Record button went grey and would not say why

**Status:** fixed and proven
**Severity:** major
**Found by:** Devi, trying to write down $12.50 of buttons
**Surface:** `surfaces/finance/quick-cost.ts` (new), `surfaces/finance/spending-list.tsx`, both trees
**Filed:** 2026-09-15

## What she saw

The quick row on **Spending** is three boxes and a button. She filled in two of
them:

```
12.50   Horn buttons from the Saturday market   [Choose a category…]   [ Record ]
```

and went to press **Record**. It was grey. Nothing anywhere on the screen said
why.

```
buttonDisabled: true
title:          ""
aria-describedby: null
message on screen: none
```

## Why

The button needs four things to be true:

```ts
const canSave =
  amountCents !== null && amountCents > 0 && description.trim() !== '' && categoryId !== '';
```

and the row explained exactly one of them, in one circumstance:

```tsx
{
  amount.trim() !== '' && amountCents === null ? (
    <Text>That amount is not a number we can read. Try something like 42.50.</Text>
  ) : null;
}
```

So an amount of `0`, an empty description, and a category nobody picked all
produced the same thing: a dead control and silence. `canSave` knew which one it
was. It simply never said.

The category is the one that matters, because it is the one she cannot work out
by looking. An empty box looks empty. A dropdown reading "Choose a category…"
looks like an offer, not a requirement.

## What changed

One sentence, from one function, following `cms/webhook-draft`'s `draftProblem`
— the same shape, for the same reason it gives: one sentence so the line under
the row and the button it explains can never disagree.

```ts
export function quickCostProblem(draft: QuickCostDraft): string | null;
```

| state                     | what it says                                                         |
| ------------------------- | -------------------------------------------------------------------- |
| nobody has typed anything | nothing                                                              |
| amount is not a number    | That amount is not a number we can read. Try something like 42.50.   |
| amount is zero            | A cost has to be more than nothing. Put in what it actually came to. |
| a category is missing     | Add a category to record this.                                       |
| two things are missing    | Add what it was for and a category to record this.                   |
| all three are filled in   | nothing                                                              |

The disabled button carries `aria-describedby` to that line, so somebody
reaching it with a screen reader is told the same thing the screen shows.

**Silence on an untouched row is deliberate.** A pane that opens already telling
somebody off is worse than one that waits. "Touched" ignores the category on
purpose: a saved cost clears the amount and the description and **keeps** the
category, because a run of receipts is usually a run of the same kind of thing —
so counting that leftover as a start would nag after every successful save.

## Proven

Ten guards in `quick-cost.test.ts`, both trees. Each asserts the whole sentence
rather than "is not null", because a wrong sentence is the defect being fixed
and not a smaller version of it. **All ten go red**, five ways:

| break                                       | reddens |
| ------------------------------------------- | ------- |
| the untouched-row gate is removed           | 3       |
| the unreadable amount is not answered first | 2       |
| the zero case is removed                    | 1       |
| the category is not named                   | 3       |
| a complete row still gets a sentence        | 1       |

One guard exists because the first draft of another was wrong: naming all three
missing things is **unreachable**, since it needs the amount and the description
both empty, which is exactly an untouched row and answers null. The sentence is
one or two things, never three, and a test now says so.

## Proven on her screen

With $12.50 and "Horn buttons from the Saturday market" typed and no category:

```
message:  "Add a category to record this."
button:   disabled, aria-describedby → quick-cost-problem
```

Choosing **Parts & materials**:

```
message:  null
button:   enabled
```

Pressing it saved the cost, cleared the amount and the description, kept the
category, and said nothing further. The advice names a control that exists, and
doing what it says works.
