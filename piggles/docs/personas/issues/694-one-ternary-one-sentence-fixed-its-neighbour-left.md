# 694 — One ternary, one sentence fixed, its neighbour left

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 243
**Surface:** mypiggles + sparx — Making things › a run, the three confirm dialogs
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen — before and after quoted
**Blocked on:** —

## What happened

Devi pressed **Hold the parts** on a run with one part on it:

> **Hold the parts for ASM-000001?**
> The **1 parts** this needs **stop** being sellable, so nothing gets sold out
> from under the build. Nothing physically moves, and canceling gives **them**
> straight back.

Three words written for a crowd against a number that was one.

## Why this one is worth a file

The correct version was **two lines below it, in the other half of the same
ternary**:

```ts
description: isMaking
  ? `The ${String(data.lines.length)} parts this needs stop being sellable, …gives them straight back.`
  : `${plural(planned, 'unit', 'units')} of … ${planned === 1 ? 'stops' : 'stop'} being sellable …`,
```

The author knew the rule. They applied it to the branch they were looking at.

Issue 685 swept thirteen of these and missed this one, because that sweep was
keyed on `plural(` — and this sentence does not call `plural` at all. It
interpolates `String(data.lines.length)` and hardcodes the plural noun, so a
probe looking for the helper is structurally blind to the worst version of the
bug: the one where nobody reached for the helper in the first place.

[[feedback_a_fix_leaves_its_neighbour_behind]]

## The other two in the same file

`doComplete` used `plural()` for the noun and then put a crowd's verb after it,
with the interpolation in between hiding the disagreement:

```
1 unit of ASH-OVERSHIRT-L-INK go onto the shelf…      →  goes
1 unit of ASH-OVERSHIRT-L-INK come off the shelf…     →  comes
```

And the confirm BUTTON said **Hold them** for one part. Two words are still a
sentence.

## Confirmed

> **Hold the parts for ASM-000002?**
> **1 part** this needs **stops** being sellable, so nothing gets sold out from
> under the build. Nothing physically moves, and canceling gives **it** straight
> back.
>
> [ Not yet ] [ **Hold it** ]
