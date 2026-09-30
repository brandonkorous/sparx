# 821 — A count stated before it was taken

**Status:** fixed
**Severity:** correctness (41 toolbars across both consoles)
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — 41 panes, and `components/pane-toolbar.tsx`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** the guard, proved red; seen on screen as Devi
**Blocked on:** —

## How it was found

Devi opened **What you told us**. The pane was still loading, the mascot in the
middle of it saying "Just a moment…", and the bar above already said:

> **0 messages**

She had none, so it happened to be right. That is the whole problem with it.

## The shape, and how wide it goes

Almost every status slot in the console is the same two lines:

```tsx
const rows = data?.items ?? [];
…
<PaneToolbar status={<Text>{rows.length === 0 ? 'No mailbox connected yet' : …}</Text>} />
```

`?? []` is correct and necessary — the component renders before the query
answers. But it means that during that render the array is EMPTY, and the bar
does not know the difference between "the answer is none" and "there is no
answer yet". So it states the first.

And on a **failed** read it states it forever. `rows` stays empty, the body
switches to "This is a problem reaching the server", and the bar above it goes on
insisting there are zero. That is the same defect the activity feed fixed inside
its own content region and never carried up to its chrome.
[[feedback_never_present_absence_as_measurement]]

Measured 2026-09-25 across both consoles:

|                                                                 |        |
| --------------------------------------------------------------- | ------ |
| toolbars with a status slot                                     | 225    |
| of those, printing a count off an array with a `?? []` fallback | 43     |
| **guarded**                                                     | **2**  |
| **not guarded**                                                 | **41** |

The two that were right are `crm/duplicates.tsx` in each console, which says
**"Checking…"** while it is checking. One pane had worked out the answer and it
had not travelled.

## The fix is in the toolbar, not at 41 call sites

`<PaneToolbar>` takes `statusReady` and `statusFailed`. When the read has not
landed the bar says **Counting…**; when it failed, **Could not be read**;
otherwise the status as written.

That is deliberately not a helper each pane calls, because the failure mode here
is a pane FORGETTING to think about it, and a helper can be forgotten. The bar
owns the bar. A call site adds one attribute:

```tsx
<PaneToolbar
  status={…}
  statusReady={!isPending}
  statusFailed={isError}
```

A status that is not a count — a saved state, a name, a warning — passes nothing
and behaves exactly as before.

## What was swept, and what was deliberately left

**27 files** by script, **9 by hand**. The script refused loudly on anything it
could not classify rather than guessing, and printed its choice of flag for every
file it did touch. Diffed against a copy taken before the sweep: **nothing but
`statusReady=` and `statusFailed=` lines added, in either console.**
[[feedback_codemod_diff_your_own_sweep]]

The 9 it refused were files where `x.isPending` appears on several objects —
`disconnect.isPending`, `save.isPending`, `moderate.isPending` — and a mutation's
pending flag is not the read's. Picking one would have been a coin toss on a
screen's correctness.

**Five were already right and were left alone**, and they matter because they are
the other correct answer:

```tsx
status={rows.length > 0 ? <Badge>{rows.length} waiting</Badge> : null}
```

A count shown only when it is above zero never states a wrong one. Reporting
those would have been pushing correct code to change, so the guard knows that
shape too.

## The guard

`scripts/check-counts-before-known.mjs`, wired into `package.json` and the
pre-push hook. It parses the `status={…}` attribute by brace matching, finds the
counted arrays, checks each one is actually derived with a `?? []`, and accepts
three forms of guard: the new prop, a pending flag read inside the block, and the
above-zero shape.

Two denominators are asserted before any of that, because the whole risk with a
check like this is that it stops recognising the shape and prints a tick:

```
✓ counts: 43 toolbars print a count that starts empty, and all 43 of them wait
  until it is known (225 status slots across both consoles).
```

Proved red by removing the two attributes from the feedback pane:

```
✖ counts: 1 toolbar states a count before the read has landed

  piggles/apps/workbench/surfaces/feedback/feedback-list.tsx
     status prints rows.length, which is [] until the query answers,
     so the bar says zero over a pane that is still loading — and keeps
     saying it if the read fails.
```

## Two smaller things on the same pane

**The empty state was a bare silica `<EmptyState>`.** Beside a loading state that
draws the brand's own artwork, the empty one was a small grey glyph. `PaneEmpty`
now, in both consoles. This is one of the 74 that issue 818 measured and left for
a detector; it was fixed here because it was on the pane being opened, not
because the detector exists yet.

**The Send dialog named a screen this console does not have.** Twice:

> …and the reply lands in **Your feedback**.
> Replies arrive by email and in **Your feedback**.

`Your feedback` is the platform's title for `platform.feedback.list`. Piggles
calls it **What you told us** — which is what the tab said, and what the site
picker four lines below those sentences said, because that control reads the live
page title. One dialog, two names for one screen. Both sentences read the brand
now, through `productSurfaceTitle`, so a rename in `vocabulary.ts` carries.
[[feedback_a_copy_edit_breaks_identity_lookups]]

## Files

- `piggles|sparx/apps/workbench/components/pane-toolbar.tsx` — `statusReady`, `statusFailed`
- 36 panes across both consoles
- `scripts/check-counts-before-known.mjs` — NEW, wired into `package.json` + `.githooks/pre-push`
- `piggles|sparx/apps/workbench/surfaces/feedback/feedback-list.tsx`
- `piggles/apps/workbench/components/feedback/{context.ts,compose.tsx,compose-dialog.tsx}`

## Noted, not fixed

**"Counting…" is one word for several kinds of waiting.** It is true of every one
of the 43, because they are all counts. A status slot that starts holding
something else and passes `statusReady` would get a word that does not fit; the
guard would not catch that, because it is about the sentence rather than the
shape.
