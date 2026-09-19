# 633 — The word checker could not read a sentence with a value in it

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 214 (while fixing [632](632-my-footer-social-column-was-a-grey-box-saying-live-region.md))
**Surface:** `piggles/scripts/check-plain-words.mjs`, and Pulse
**Filed:** 2026-09-17
**Fixed:** 2026-09-17

## What happened

632 found a screen-reader term printed on the builder canvas. The obvious
question afterwards was why `check:plain-words` — the guard whose whole job is
words a shop owner should not have to learn — had never said anything.

Two reasons, and the second is much larger than the first.

## Why it happened

### 1. It was not looking at that tree

Three scan roots: `surfaces`, `components`, `lib/console`. The console has seven
more directories of code a person reads.

|                 | files |
| :-------------- | ----: |
| scanned         |  1180 |
| **not scanned** |   205 |

`lib/studio` (the whole builder canvas), `lib/tour`, `lib/onboarding` and
`lib/dock` were all outside it.

`lib/surfaces` was outside it too, and **must stay outside it**. That directory
holds the surface catalog, whose raw titles are not what anybody reads:
`vocabulary.ts` overrides them and `check-nav-vocabulary` resolves each one the
way the app does before testing it. Scanning it reports "Product fitment" and
"How the CRM behaves", both of which render as "What it fits" and "How this app
behaves". Two false alarms is how a check gets switched off. That reason is now
written in the file, because the next person to widen the roots will otherwise
add it.

### 2. It could not see one sentence in eight

Its pattern for text between JSX tags rejected any run containing a brace:

```js
const JSX_TEXT = />([^<>{}'"`]{8,600})</g;
```

The brace exclusion is there for a real reason — `=>` supplies an opening angle
bracket and a generic supplies a closing one, so without a filter the check
reported 1,040 findings that were almost all `api.get`. But it also excludes
every sentence with a **value in the middle of it**, and most real sentences on a
console have one.

|                                    |   count |
| :--------------------------------- | ------: |
| JSX sentences the check could read |   3,786 |
| allowing one interpolation         |   4,362 |
| **invisible to it**                | **576** |

One of those 576 was live:

```
surfaces/pulse/index.tsx
    The {String(FINISHED_SHOWN)} most recent.
    Older runs live in the module that started them.
```

**"module" is the first word the lexicon bans.** Piggles has no modules and does
not price by them; it calls them apps. The check read that file, counted it, and
could not see the sentence. Delete the `{String(FINISHED_SHOWN)}` and it fails
immediately.

## The fix

`JSX_TEXT` now admits a single-level interpolation, and each `{…}` is replaced
with an ellipsis before the prose test — so what is checked is the words AROUND
the value, which is what the value was never part of anyway. Nested braces stay
out on purpose: `{items.map(x => <Row/>)}` is a subtree, not a sentence, and its
inner tags are found on their own.

Roots gained `lib/studio`, `lib/tour`, `lib/onboarding` and `lib/dock`.

`live region` joins the technical list. It is the odd one there: the others are
things a person might need named, and this is a screen-reader term that got
borrowed to mean "the platform fills this in for you".

|               | before |    after |
| :------------ | -----: | -------: |
| files read    |   1180 | **1253** |
| words watched |     20 |   **21** |

Pulse now reads: _"The 8 most recent. Older runs live in the app that started
them."_

## Guard

The check IS the guard, so it was proven red twice on real code before either
string was fixed:

```
[module]      apps/workbench/surfaces/pulse/index.tsx
              The … most recent. Older runs live in the module that started them.

[live region] apps/workbench/lib/studio/host-cores.tsx
              … · live region
```

Both then green. The blast radius was measured first rather than discovered: the
proposed configuration was run over the whole console before the real check was
touched, and it found exactly these two with **no false positives**.

## What this is an instance of

A check that reads files and reports the file count looks thorough. This one read
1,180 files and could not see one sentence in eight of them, and the number it
printed was the number of FILES. A denominator is only honest about the thing it
counts ([[feedback_structural_checks_go_blind]]).
