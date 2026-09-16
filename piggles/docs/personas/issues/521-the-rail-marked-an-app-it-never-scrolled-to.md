# 521 — The rail marked an app it never scrolled to

**Status:** fixed and proven
**Severity:** major
**Found by:** Devi, working in Sell on a laptop-height window
**Surface:** `piggles/apps/workbench/components/app-rail.tsx` and `sparx/apps/workbench/components/rail.tsx`
**Filed:** 2026-09-15

## What is wrong

The rail is the one screen element a business owner looks at every day, and on a
1280×800 laptop it shows **38% of itself**.

Measured, on Juniper Row's own console at 800px tall:

```
rail list viewport    319px      (top 133 → bottom 452)
rail list content     848px
hidden                529px
```

Thirteen apps plus Favorites and Recent. Once the header, the plan card, the
"Action needed" card and the footer have taken their share, the list has 319px —
about six rows. **Everything from Sell downwards is already clipped**, including
Stock, Partners, Customers, Messages, Bookings, Invoices, Money and My Team.

A scrolling list is not by itself a defect. This is:

## The panel reopens where it was left, and the rail does not follow

`use-shell-prefs` restores a **pinned** panel on load:

```ts
if (state.pinned && state.module) setBrowsing(state.module);
```

The rail then marks that app with `aria-current="true"` — and starts its
scroller at zero. Measured, panel pinned on My Team, console reloaded:

```
marked app        My Team
rail scrollTop    0
scroller          top 133 → bottom 452
marked row        top 925 → bottom 969        473px below the fold
marked visible    false
```

So she comes back the next morning to a panel full of her team, and a rail with
no selection anywhere she can see — which is exactly what a rail with **nothing**
selected looks like. The one element that is supposed to say "you are here" says
nothing, and says it in the way that reads as normal.

## What changed

Both rails now scroll their marked row into view when what is being browsed
changes:

```tsx
const contentRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  contentRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
}, [browsing, nav.length]);
```

`block: 'nearest'` is the whole design: it moves the **minimum** distance and
does nothing at all when the row is already in view, so this can never yank a
rail that somebody has scrolled themselves.

The effect is also keyed on how many apps are in hand. `browsing` is restored
from storage during mount, which can land before the rail has any rows to find;
without that second key the query runs once against an empty list and never runs
again.

## Proven, on the live rail at 800px

| state                                     | scrollTop | marked row | visible |
| ----------------------------------------- | --------- | ---------- | ------- |
| before, panel pinned on My Team           | 0         | 925 → 969  | **no**  |
| after, panel pinned on My Team            | 517       | 408 → 452  | yes     |
| after, panel pinned on My Site (near top) | **0**     | near top   | yes     |

The third row is the one that matters as much as the second: an app that was
already in view moves nothing.

## Both trees

`sparx/apps/workbench/components/rail.tsx` restores a pinned module the same way
(`workbench-shell.tsx:206`) and marks it the same way, with the same missing
scroll. It has more modules than Piggles has apps, so it clips sooner. Fixed
identically.

## Why it had not been found

Every previous look at this console has been at a window tall enough to show the
whole rail. At 1113px nothing clips, `scrollTop` 0 is correct, and the marked row
is exactly where it should be. The defect only exists at the height most people
actually work at, and it presents as an absence — no highlight — which is the one
symptom that renders identically to "nothing is selected, as intended".
