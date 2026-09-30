# 871 — Her console did not know the sixth answer

**Status:** fixed
**Severity:** **major** — the commission calculation returns six outcomes. This
console's type listed five, so the sixth fell through the switch to the default
and told her **"That sale could not be found"** about a sale on the screen in
front of her, with a named person credited to it. The outcome it could not name
is the one with the most confusing cause and the least obvious remedy
**Found by:** P03 · act 308, comparing the two consoles shape by shape after
issue 865
**Surface:** mypiggles › Selling › an order › Sold by, and the same section on a
deal
**Filed:** 2026-09-29
**Fixed:** 2026-09-29
**Confirmed by:** 12 tests, proved red by putting the fall-through back

## Found by method, not by clicking

Issue 865 was a fix made in one console and never carried to the other. That is
a class of bug, not an incident, so I went looking for the rest of it: for every
exported shape declared in both consoles, compare the field names.

```
shape names in piggles                1,304
shape names in sparx                  1,218
paired and compared                   1,219
  with a differing field set             44
```

Most of the 44 are brand differences that should stay (piggles sells deposits
and order-ahead; sparx does not). **Three had sparx ahead of this console**, and
one of those is this.

The method validated itself on the way: `OrderQuery` is **absent** from the list,
because 865's `countedOnly` is fixed. The comparison finds exactly the shape that
bug lived in.

## The two consoles, side by side

```ts
// piggles
outcome: 'recorded' | 'no-attribution' | 'no-rate' | 'not-payable' | 'unknown-sale';

// sparx
outcome:
  | 'recorded'
  | 'no-attribution'
  | 'no-rate'
  | 'rate-not-in-force'      // ← and two fields explaining it
  | 'not-payable'
  | 'unknown-sale';
rateStartsOn?: string;
earnedOn?: string;
```

And the consequence, in this console's own `outcomeMessage`:

```ts
switch (result.outcome) {
  case 'recorded': …
  case 'no-rate': …
  case 'not-payable': …
  case 'no-attribution': …
  default:
    return 'That sale could not be found.';   // ← where the sixth landed
}
```

## The server sends it, on both paths

`whyNoRate` in `wizeworks/packages/staff/src/commission-calc.ts`, reached from
the order path and the deal path alike:

```ts
if (!earliest || earliest.effectiveFrom <= earnedOn) {
  return { outcome: 'no-rate', staffMemberId };
}
return {
  outcome: 'rate-not-in-force',
  staffMemberId,
  rateStartsOn: earliest.effectiveFrom.toISOString().slice(0, 10),
  earnedOn: earnedOn.toISOString().slice(0, 10),
};
```

This is not a capability one brand has and the other does not. It is one answer,
computed by shared code, that one console could not read.

## The comment that says why the two are separate

Written above `CommissionOutcome` in that same file:

> `no-rate` and `rate-not-in-force` are deliberately two outcomes, not one. They
> look identical from inside the calculation — no rate came back — and they are
> **fixed in opposite ways**, so collapsing them produces advice that is worse
> than silence. Found by clicking it: a salesperson was put on 7.5% commission
> today, an order paid a fortnight ago was credited to her, and the screen said
> "they are not on commission — set a commission rate on their pay record." She
> was on commission. The rate simply started after the sale, and the owner was
> being sent to do the exact thing they had just done.

Somebody found that by clicking, split the outcome, wrote down the harm, and
fixed the console they were standing in. [[feedback_one_outcome_two_causes]]

This console then did something worse than the bug the comment describes: rather
than the wrong advice, it denied the sale exists.

## What it says now

```
before   That sale could not be found.

after    Credited to Priya Raman. Their commission starts 16 Sep 2026 and this
         order was paid 4 Sep 2026, so it earned nothing. To count it, remove
         that rate on their pay record and add it again from an earlier date.
```

Both dates, because the comparison IS the message and neither date means
anything alone. And the remedy is spelled out because **the obvious one does not
work**: pay rates may not overlap, so adding an earlier rate is refused outright.
An owner told merely to "backdate it" hits that wall instead.
[[feedback_one_outcome_two_causes]]

## Measured, and stated honestly

```
staff_pay_rates with basis='commission' AND commission_percent > 0
  platform-wide                 1   (WizeWorks LLC, effective 2026-01-01)
  Devi's own                    0
```

**Nobody has hit this yet**, and that is because almost nobody has set up
commission, not because the path is unreachable. It is reached the first time any
owner sets a commission rate today and recalculates an older sale, which is
exactly the sequence the comment above describes as how it was found.

That is a different thing from the email open counts I declined to draw in issue
868: there, nothing writes the value, so rendering it would invent a measurement.
Here the server computes and returns the answer, and the console mishandles it.
[[feedback_never_present_absence_as_measurement]]

## Proved

**12 tests**, proved red by removing the sixth case so it falls through again:

```
drop `case 'rate-not-in-force'`  →  4 of 12 fail
```

Two tests deliberately stayed green under that break, and the reason is worth
keeping: "says something different from no-rate" and "never claims they are not
on commission" both pass when the message is "That sale could not be found",
because a fall-through and a collapse are **different bugs**. Both are possible,
so both tests earn their place, and only the four catch this one.
[[feedback_a_test_that_cannot_go_red]]

The sentences moved out of the `.tsx` into a sibling `.ts` so they could be
tested at all, with the two formatters passed in as arguments rather than
imported — which keeps the tested module free of the money and date helpers and
lets a test read a sentence's shape without asserting anybody's locale.

**Sparx's sentence is byte-identical after the move**, checked by diffing the
extracted string against the file it came from, so the console that already
worked is unchanged by the refactor.

**Checks:** typecheck 0 on both workbenches. Tests: piggles workbench 151 files
/ 1441, sparx 117 / 1114. All ten guards OK. ESLint and prettier clean.

## Files

- `piggles/apps/workbench/surfaces/staff/data.ts` (the sixth outcome and its two dates)
- `{piggles,sparx}/apps/workbench/surfaces/commerce/sold-by-message.ts` (new, the sentences)
- `piggles/apps/workbench/surfaces/commerce/sold-by-message.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/commerce/sold-by-section.tsx`

ESLint found the leftover of the move in both consoles: the `CommissionOutcome`
type import became unused once the function left. Removed.

## The thing to remember

**A union is a contract, and a `default` branch is where a broken one goes to
hide.** Adding a member server-side is source-compatible with every client that
does not know it, so nothing fails to compile, no test goes red, and the only
symptom is a sentence that was written for a different situation. A `switch` over
a wire union wants an exhaustive check, or a default that says "I do not know
what happened" rather than confidently naming a cause.

And the reason this was findable: **the same fix, made twice in two consoles, is
a class of bug worth a measurement rather than a memory.** 44 divergences across
1,219 shared shapes, and three of them have this console behind the other one.

## The other two, and what remains

- **`ObservedSource.label` / `LeadSourceRow.label`** (CRM lead sources) exist in
  sparx and not here. Not folded in: `label` is a generic enough name that my
  usage measurement could not tell a real capability from a coincidence (a bare
  word grep returned 444 files), so it needs looking at rather than mirroring on
  faith.
- **The remaining 43** are mostly brand differences that must stay. They belong
  in an exception list on `check:console-parity` with a stated reason each, which
  is the next piece of work: the guard compares `components/**`, `lib/**`, routes
  and dependencies today, and does not compare shapes at all.
- **An honest limit of the method:** it compares field NAMES, so it caught this
  only because the sixth outcome came with two new fields. A union member added
  without new fields would slip straight through.
