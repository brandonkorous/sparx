# 628 — A customer question came with "Their IP address ::1"

**Status:** fixed
**Severity:** low
**Found by:** P03 · Juniper Row · act 212
**Surface:** mypiggles › My Site › Form replies › a reply, Where this came from
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 212 (seen on screen, before and after)

## What happened

My Site › Form replies. Rosalind Achebe asked whether to size up or down in the
Ash Overshirt. Under her message, a card headed **Where this came from**:

```
Form           Messages from my website
Page           /contact
Site           Juniper Row
Received       Sep 1, 2026, 4:34 AM
Their IP address   ::1
Their browser  Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
               (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36
```

The labels are in my words. The values are not. And `::1` is not an address: it
is what a machine reports when it is talking to itself.

## Why it happened

This is **issue 618's own neighbor**, and 618 was closed earlier in the same
session.

618 fixed the Devices signed in card, which showed `From ::`. Its file,
`where-from-words.ts`, opens by naming the shape it exists to correct:

> The user agent beside it was already handled — `describeDevice` answers
> "Unknown device" rather than printing the raw string. The address next to it
> got no such treatment, which is the usual shape: the thinking was done for one
> field and not for the one sitting next to it.

Both answers then stayed on that one card. The form-reply pane is the only other
screen in the console that shows a stranger's address and browser, and it had
neither ([[feedback_a_fix_leaves_its_neighbour_behind]]).

Measured 2026-09-17, platform-wide:

|                               |       |
| :---------------------------- | ----: |
| form submissions              |     7 |
| carrying an address           |     7 |
| whose address means "nowhere" | **7** |
| carrying a raw user agent     | **7** |

So on **every form reply anybody has ever opened**, both rows were noise, and
the first presented a placeholder as a fact about a stranger
([[feedback_never_present_absence_as_measurement]]).

## The fix

`describeDevice` moved out of `security-data.ts` — a module full of react-query,
which is why nothing else reached for it — and now lives in `where-from-words.ts`
beside the address it is always shown next to. `security-data.ts` re-exports it,
so every existing caller is unchanged.

New `submission-context-words.ts` decides each row:

- **A placeholder address draws no row at all.** "Their IP address · nothing" is
  worse than silence, because the label is what makes the value evidence.
- **The browser is never printed raw.** "Chrome on Windows", or an honest
  "Unknown device" — which is still a ROW, unlike the address, because "unknown"
  is an answer to "what were they using" where a loopback address is not an
  answer to "where were they".
- It reuses the console's own `humanizeKey`, so an unnamed context field reads
  the same way here as in the answers list above it.

On screen:

|             |                                                          before |                 after |
| :---------- | --------------------------------------------------------------: | --------------------: |
| address row |                                          Their IP address `::1` |         **not drawn** |
| browser row | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36…` | **Chrome on Windows** |

## Guard

`submission-context-words.test.ts`, **9 tests** per console.

The two that are rules rather than examples:

```ts
it('draws no row at all for a placeholder', …)   // all six placeholder forms
it('never prints the raw string', …)             // asserts the output has no "Mozilla" in it
```

Proven red by printing both values raw: **4 of 9** fail.

## What it led to

Three of her four replies were still marked **New**, dated Aug 31 and Sep 1, with
today being Sep 17. Nothing in the console counted them — no badge on My Site,
nothing on Home — while live chat, orders, bookings, invoices, stock and both
social queues all had one. Filed and fixed as
[629](629-two-people-wrote-in-and-nothing-anywhere-counted-them.md), and the
tenant-wide read behind that badge as
[630](630-the-form-inbox-answered-for-every-site-she-runs.md).
