# 645 — It asked me to write a message nobody can ever see

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 222
**Surface:** mypiggles › Messages › Setting it up › Chat settings
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 222 (all three states read back on screen)

## What happened

Messages › **Chat settings**, halfway down:

> **Away message**
> _We're away right now, but leave a message and we'll get back to you._
> Shown when you are outside your available hours, so people know what to expect.

Thirty lines further down, on the same screen:

> **Set specific hours** (off)
> Chat is always available. **There is no away state.**

Both of those were on screen at once. The second is true, which makes the first
a box asking me to write something nobody will ever read. And the words already
in it are not mine: they are the default the platform writes.
[[feedback_never_present_absence_as_measurement]]

Measured 2026-09-18:

|                             |        |
| :-------------------------- | -----: |
| shops with a chat box       | **14** |
| of those, with no hours set | **13** |

So thirteen shops in fourteen are looking at a field that cannot do anything, and
being told when it will.

**The sentence that reads the state is in the same file, thirty lines below the
one that does not.** [[feedback_a_fix_leaves_its_neighbour_behind]]

## The state neither sentence covered

Turning **Set specific hours** on gives seven day switches, all off. The
availability check answers:

```ts
const window = hours.days[String(dayIndex)];
if (!window) return false;
```

so **a shop that turns the switch on and stops there has closed its chat every
hour of the week.** Every visitor gets the away message; nobody can start a
conversation. The switch's own sentence said "Outside **these** hours the chat
shows your away message instead of a reply box" about hours that did not exist.

The day rows below were already honest — each reads "Closed: the away message
shows instead" — but the summary above them, and the box that the away message
lives in, both said something else.

## The fix

Three states, because there are three, in `availability-words.ts`:

| hours | days open | the away message box says                                                                                            |
| ----- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| off   | —         | "You have not set any, so **nobody ever sees this.** Turn on Set specific hours below to use it."                    |
| on    | none      | "Right now this is **all a visitor gets.** No day is switched on below, so the chat is away every hour of the week." |
| on    | some      | "Shown when you are outside your available hours, so people know what to expect."                                    |

and the same three under the switch itself, where the middle one reads "No day is
switched on yet, so the chat is away all week and every visitor gets your away
message. Switch on the days you answer."

The middle state also gets a **warning callout** above the day list, because it
is the one state on this screen where a shop believes it is open and is not. "No
hours at all" is a perfectly good way to run a chat box and gets no warning: it
gets a sentence saying the away message is idle.

## Confirming it

Driven as Devi, without saving, so her settings are untouched:

1. Hours off, as they were: **"Shown when you are outside your available hours.
   You have not set any, so nobody ever sees this. Turn on 'Set specific hours'
   below to use it."**
2. Switched hours on: the away box became **"Right now this is all a visitor
   gets. No day is switched on below, so the chat is away every hour of the
   week."**, the switch read **"away all week"**, and an amber **"Your chat is
   away all week"** appeared above the seven day rows.
3. Switched it back off: back to "Chat is always available", and the unsaved
   marker cleared. Nothing written.

## Guard

`availability-words.test.ts` in both consoles, **10 tests**. The rule that
matters:

```ts
it('never says the same thing in two different states', () => {
  const notes = [awayMessageNote(false, 0), awayMessageNote(true, 0), awayMessageNote(true, 2)];
  expect(new Set(notes).size).toBe(3);
});
```

Proved red by restoring the one fixed sentence and dropping the middle state:
**5 of 10** fail.
