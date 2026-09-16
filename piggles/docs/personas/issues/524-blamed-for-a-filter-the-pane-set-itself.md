# 524 — Blamed for a filter the pane set itself

**Status:** fixed and proven
**Severity:** minor
**Found by:** Devi, opening Reviews for the first time
**Surface:** `surfaces/commerce/reviews-list.tsx`, both trees
**Filed:** 2026-09-15

## What she saw

Clicked **Reviews**. Empty screen:

> **Nothing matches those filters**
> Try a different word, or switch the filter back to All.

She had not typed a word and had not touched a filter. She has two reviews, both
published, sitting on her website right now.

## Why

The pane opens on the moderation queue:

```ts
const [status, setStatus] = useState('pending');
```

Which is the right default — "what needs me" is what this screen is for, and the
toolbar even has a **Work the queue** button. The problem is one line further
down:

```ts
const anyFilter = search.trim() !== '' || status !== 'all';
```

**That counts the pane's own default as the person having filtered.** So a shop
with nothing waiting is told it typed something wrong, and sent looking for a
control that is already off.

This platform has a rule about exactly that, written into `orders-list-filters`:

> What to try when nothing matched — naming ONLY what is actually narrowing the
> list. Telling someone to clear a filter they never set sends them looking for
> a control that is already off.

A filter the PANE set is not a filter the person set.

## What changed

Three states instead of two, because there are three things that can be true:

```ts
const searching = search.trim() !== '';
const atDefaultQueue = !searching && status === DEFAULT_STATUS;
const showingEverything = !searching && status === 'all';
```

| state                | title                         | says                                                                                                    |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| the queue, untouched | Nothing waiting for you       | No review is waiting to be published. Switch the filter to All to see the ones already on your website. |
| showing everything   | No reviews yet                | (the original first-run copy, unchanged)                                                                |
| narrowed by hand     | Nothing matches those filters | Try a different word, or switch the filter back to All.                                                 |

`'pending'` is now a named `DEFAULT_STATUS`, because the empty state has to be
able to tell that default apart from a status somebody chose.

## Proven, on her screen

Opening Reviews, with the **Waiting** chip selected and nothing typed:

> **Nothing waiting for you**
> No review is waiting to be published. Switch the filter to All to see the ones
> already on your website.

Following that advice — clicking **All** — shows her two published reviews, "The
Ash Overshirt" and "The Everyday Tee". The advice names a control that exists,
and doing what it says works.

## Checked and not a defect, in the same sweep

Sixteen other lists carry the string "Nothing matches those filters" without a
ternary, which looked like the same bug sixteen times. They are not: they pass
it to `<ListEmptyState filtered={anyFilter} noResults={…} firstRun={…} />`, a
shared component that already picks between the two. Reading one of them before
counting saved a sweep across sixteen files that did not need one.
