# 820 — A revenue chart drawn in cents

**Status:** fixed
**Severity:** correctness (money in the wrong unit) + copy
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `analytics.dashboard.view`, `analytics.dashboards.list`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi, before and after
**Blocked on:** —

## The chart said 80,000 and the card beside it said $2,391

Devi opened the Sales dashboard. Three cards along the top:

> **Revenue** $2,391 · **Orders** 13 · **Average order** $184

Under them, the hero chart, **Revenue over time**, with a y-axis reading

> 0 · 20,000 · 40,000 · 60,000 · 80,000

and a spike at about 72,500 on September 5.

Money is stored in **cents**. The cards divide by 100; the chart does not. So
the best day of her month read as 72,500 next to a card saying the whole month
was 2,391, and neither number carried a currency symbol on the axis to say which
was which.

`tiles.tsx` had the fix four lines further down:

```tsx
return <TrendChart series={…} points={…} grain={…} />;          // the hero chart
…
return <DonutChart rows={rows} format={(n) => formatValue(n, result.unit)} />;  // the donut
```

The donut was handed the formatter. The chart above it was not, and `TrendChart`
had no parameter to take one, so the axis and the tooltip both printed the raw
stored number. [[feedback_a_fix_leaves_its_neighbour_behind]]

It takes a `format` now, applied to both the axis labels and the crosshair
tooltip, and the axis reads **$0 to $800** with the peak at about $725 — which
is a day that adds up against a $2,391 month.

## The chart told a screen reader it was something else

```tsx
<Chart option={option} className="h-80! w-full" aria-label="Visitors and page views over time" />
```

Hardcoded from the Traffic dashboard this chart was first built for, and it
stayed when the chart became the hero of every dashboard. On Sales, a screen
reader announced "Visitors and page views over time" over a revenue line. It is
the tile's own title now.

## A full circle labelled "Unattributed"

**What brings in sales** drew a donut with exactly one slice:

> Unattributed · 100% · $2,391

That is a picture of not knowing, drawn with all the authority of a measurement,
and it is the same defect this act already fixed once on "Where new customers
come from". [[feedback_never_present_absence_as_measurement]]

Two fixes, and the second is the structural one.

**The word.** `commerce-sales.ts` introduces its label table with _"Plain-language
labels (an owner does not think in 'referral')"_ and then labels the bucket
`Unattributed`, which is the least plain word in the set. It reads **Could not
tell** now, which is the honest answer to where a sale came from when there is no
same-day visit to match it to.

**The shape.** A pie of one thing is not a chart, whichever slice it is, and
every breakdown on every dashboard can land there: one channel, one campaign, one
source. `BreakdownTile` now says it in a sentence instead:

> All of it falls under one heading, Could not tell: $2,391. There is nothing
> here to compare it against yet.

## "Added by your team", off a sixth copy of the table

**Where sales came from** split her month into **Your website** and **Added by
your team**. Devi has no team.

`lib/console/channels.ts` already fixed this, and its header says why it exists:
one till sale read four different ways on four screens — "In person or by phone"
on Money, "Added by your team" on the selling report, "Entered by your team" on
the order, "Orders you enter by hand" in the price-list picker (issue 260). Its
second note records a FIFTH, the customer reports pane drawing the API's wording
instead.

The dashboards were a sixth, reading a copy of the table in `api-rest` that had
drifted in both directions a second copy always drifts:

|         |                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------ |
| `admin` | said **"Added by your team"**; the console's table says "Added by hand" and carries a paragraph on why |
| `pos`   | **missing entirely**, so a till sale would have drawn the raw key `pos`                                |

The missing key is the same failure as `marketplace` falling out of the lead
source table four days ago: a second copy of a label table goes stale at the next
addition, and nothing goes red.

Both fixed in api-rest, and Piggles now maps channel rows off the row's **key**
through `channelKeyLabel` at `useDashboardQuery` — the one place the feed enters
the console, the same boundary rule as `useReportFields` and `useActivity`.

## "no baseline"

On all three headline cards, where a comparison would go:

> **Revenue** $2,391 · _no baseline_

An analyst's phrase for something every shop owner understands: there is no
earlier stretch of time to hold this up against. It says **"nothing to compare
with"**.

The chip that replaces it when there IS a baseline had its own problem: a soft
badge reading `↑ 12%`, whose only explanation was a tooltip saying "vs previous
period". There is no hover on the device the compact console was built for, so
on a phone it was a percentage of nothing stated. It carries the whole sentence
as its accessible name now: _"12% up on the period before"_.

## The picker had the 88th copy of a sentence written once

**Dashboards** opened with:

> Each dashboard answers one set of questions. Open one in a tab, Shift-click to
> place it alongside your work, or Alt-click to send it to another window.

`components/row-open-hint.tsx` exists because 87 surfaces each wrote their own
version of that, and its header states the two things wrong with doing so: the
wording cannot be changed in one place, and **it is nonsense on a phone** — no
shift key, no alt key, no second window — which is why the component hides itself
below `@md`. The hand-rolled copy here showed at every width.

The sparx console was already using `RowOpenHint` on this exact pane. The Piggles
copy had diverged and kept the old sentence.

Three more things on the same pane, all of them the shape issue 818 described:

- **The toolbar was empty.** Nothing on the left, where every other pane in the
  console says what it is showing. It carries a count.
- **All three states were a bare silica `<EmptyState>`** floating in the pane,
  which `pane-empty.tsx` says in its own header it exists to stop. `PaneEmpty`,
  `PaneLoadError` and `PaneWaiting` now.
- **The loading state was the word "Loading…"** as a line of text.

The sparx copy had the last two as well, and has the house components. Fixed
there too.

## And the viewer's toolbar said nothing either

Both of its controls — the grain toggle and the period picker — sit on the right
and fold into the overflow popover on a narrow pane. So at that width the screen
was a wall of figures with nothing saying which dashboard they were of or over
what stretch of time. It reads **"Sales · Last 30 days"** now.

sparx already showed the dashboard's title there. The Piggles copy had dropped
it. The same divergence as the open hint, in the same file pair, in the opposite
direction.

## Proved red

The channel guard's first draft could not go red. It read `data.ts` and asserted
the file CONTAINED the word `channelKeyLabel` — which it still does with the swap
deleted, because the import stays. It passed with the bug reinstalled.

It calls the transform now, over a response shaped like the real one:

```
× rewrites a channel breakdown into this console's words
  AssertionError: expected 'Added by your team' to be 'Added by hand'
```

It also asserts over EVERY key in `channels.ts`, not a sample, with the count
asserted first — the failure it guards was one entry out of nine.
[[feedback_a_test_that_cannot_go_red]]

## Files

- `piggles|sparx/apps/workbench/surfaces/analytics/charts.tsx` — `TrendChart` takes a formatter and a name
- `piggles|sparx/apps/workbench/surfaces/analytics/tiles.tsx` — the formatter, the delta chip, the one-slice rule
- `piggles|sparx/apps/workbench/surfaces/analytics/dashboards-list.tsx`
- `piggles/apps/workbench/surfaces/analytics/dashboard-view.tsx`
- `piggles/apps/workbench/surfaces/analytics/data.ts` — the channel boundary
- `piggles/apps/workbench/surfaces/analytics/channel-words.test.ts` — NEW, 4 tests
- `wizeworks/services/api-rest/src/lib/analytics/metrics/commerce-sales.ts`

## Noted, not fixed

**`color="neutral"` on the dashboards retry button**, and `tone = 'neutral'` for
a flat delta chip. Both are RULE #4 asks rather than judgement calls, and they
join the carried list.

**The dashboard viewer's toolbar is named "Dashboard controls" while its tab
reads the dashboard's own name.** `check:toolbar-names` compares against the
catalog title, which is the generic "Dashboard", so it passes. Issue 817 already
records that the dashboards panes are the two the guard cannot check, for the
same reason: one file, two names, and no single right answer to guess at.
