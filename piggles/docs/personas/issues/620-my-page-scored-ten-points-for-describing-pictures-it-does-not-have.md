# 620 — My page scored ten points for describing pictures it does not have

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 207
**Surface:** mypiggles › Get Found › page check (every page)
**Filed:** 2026-09-17
**Fixed:** 2026-09-17
**Confirmed by:** P03 · Juniper Row · act 207 (seen on screen, before and after)

## What happened

My Products page, **62 out of 100**. Two things on it did not add up.

### It told me about the summary twice

> **Worth fixing** — Each of these would help this page be found. Start at the
> top.
>
> | Worth a look | The page has a short summary | not written yet |
> | Worth a look | How long the summary is | nothing written |

One missing summary. Two rows. And the second carried **no advice at all**,
while every other row on the screen had a sentence under it.

### And it congratulated me for pictures I do not have

> **Already good** — Nothing to do here. These are set up correctly.
>
> | Looking good | Every picture is described | **no images** |

Nothing was set up. There was nothing to set up. And "Every picture is
described" is the heaviest check in the catalog — **10 points of 100** — handed
over for a test that never ran.

## Why it happened

Both are the file's own rule, not followed. `audit.ts` says it in its header:

> `info` checks (an intentional `noindex`, the always-true llms.txt fact) are
> shown but excluded from the denominator, so the score reflects **only what the
> author can actually act on**.

And the mechanism is right there: `earnedFor` gives `info` zero, and both the
total and the per-area bars filter `c.status !== 'info'`.

**The summary.** `desc-length` warned at length zero, which is not a length
problem — it is `desc-present` said again. Whoever wrote it knew: the tip is
explicitly gated on `dl > 0`, because there is no length advice to give when
there is nothing there. They suppressed the advice and left the row.

It also charged her twice for one absence. A `warn` earns half its weight, so an
unwritten summary lost **3 of 6** on the presence check **and 2 of 4** on the
length one.

**The pictures.** `imageCount === 0` set `pass`, full marks.

The test directly above it in the same file had already got this right for a
different check:

```ts
it('treats noindex as info and removes its weight from the denominator', () => {
  // An otherwise-perfect page that is intentionally noindex should NOT be
  // penalized — the two index checks go info and the score normalizes over 83.
```

Its neighbor got the opposite answer. Fifth time today.

## The fix

| check         | when               | was    | now                                 |
| :------------ | :----------------- | :----- | :---------------------------------- |
| `desc-length` | no summary at all  | `warn` | `info` · "nothing to measure yet"   |
| `image-alt`   | no pictures at all | `pass` | `info` · "no pictures on this page" |

And the console stops filing facts as achievements. "Already good · these are
set up correctly" now holds only real passes; `info` rows moved to their own
section:

> **Worth knowing**
> Nothing to fix and nothing to praise. These say what the checker found, and
> none of them counts towards the score.

## The one I nearly shipped

The first cut kept the picture check's advice, because its tip was gated on
`alt !== 'pass'` and `info` is not `pass`. So a page with **no pictures** was
told **"Write one for each."**

Fixed where it cannot come back, rather than at the call site:

```ts
/** An `info` check never carries advice. A fact is not a task. */
function finalize(d: CheckDraft): CheckResult {
  const { tip: _tip, action: _action, ...bare } = d;
  const kept = d.status === 'info' ? bare : d;
  return { ...kept, earned: earnedFor(d.status, d.weight) };
}
```

## Scores move, and they move DOWN

This page went **62 → 58**, and its "What is on the page" bar **56% → 27%**.

That is the inflation coming out, not a regression. The page was being scored
over 100 points of which 10 were unearnable credit. It is now scored over the 90
that were actually measured, and it turns out to be in worse shape than it
looked. Any page with no images on it will move the same way.

## Guard

`audit.test.ts`, **30 tests**, 4 of them new or rewritten.

One existing test **asserted the bug** and was rewritten rather than deleted:

```ts
it('passes alt-text when there are no images', …)      // was
it('does not award alt-text points to a page with no pictures', …)  // now
```

It stated no rule anyone would defend out loud — a page with no pictures is good
at describing pictures — so it was the defect written down. The replacement
pins the arithmetic, which is the part worth protecting: denominator 90, score
still 100 on an otherwise-perfect page.

The others pin the rest of the arithmetic (denominator 96 and score 97 for one
missing summary, charged once) and the rule the near-miss taught:

```ts
it('never puts advice on a fact', …)
```

Proven red by restoring all three: **4 of 30** fail.

## Still open

Nothing from this issue.
