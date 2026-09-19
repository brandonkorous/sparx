# 591 — The item name got narrower as the pane got wider

**Status:** fixed and proven by measurement
**Severity:** medium
**Found by:** Devi, on Stock → Every change
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/movements-list.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_responsive_top2_rule]] · issue 565

## What she saw

| When       | Item       | Change | Why      |
| ---------- | ---------- | ------ | -------- |
| 2 days ago | **Brass…** | −2     | Damaged  |
| 2 days ago | **Brass…** | +2     | Received |
| last week  | **Linen…** | +2     | Received |
| last week  | **The …**  | −1     | Sold     |

Every row identified by four characters. The Item cell is the one that GIVES in
this table, and at her pane width it was giving everything: **86px**, against
122px for "2 days ago" and 160px for "Damaged".

## Measured

The give-cell width and the sideways overflow, at every width the pane can be:

| pane  | item name | overflow  |
| ----- | --------- | --------- |
| 400px | 64px      | **23px**  |
| 480px | 121px     | 0         |
| 520px | 161px     | 0         |
| 560px | 79px      | 0         |
| 600px | 64px      | **224px** |
| 672px | 64px      | **152px** |
| 760px | 64px      | **132px** |
| 900px | 72px      | 0         |

**The item name got worse as the pane got wider**, and from 600px to 760px the
table scrolled sideways by up to 224px inside a pane that had room for it.

64px is the give-cell's floor. It sat on the floor at most widths.

## Why

Each breakpoint added more than the extra width paid for.

```tsx
<th className="hidden @lg:table-cell">When</th>        // +122px at 512px
<td className="max-w-40 @xl:max-w-72">                  // +128px at 576px
<th className="hidden @xl:table-cell">Location</th>     // +192px at 576px, same breakpoint
<th className="hidden text-right @2xl:table-cell">Left on shelf</th>
```

At `@xl` the Why column grew by 128px **and** the Location column appeared, worth
192px: **320px of new demand for 64px of new pane.** The give-cell paid for all
of it, and when it hit its floor the table scrolled.

The file already knew this could happen. The comment above the Why cell says so:

> CAPPED, and that cap is load-bearing... measured at 521px against 84px for the
> product name... **Any column added beside a give-cell needs a width.**

The cap was added. What was missed is that a cap which GROWS is a column being
added, and that two things must not grow at the same breakpoint.

## The fix

Nothing new appears until the pane can pay for it, and nothing grows at a
breakpoint where something else appears.

| Column        | Was                   | Now                                      |
| ------------- | --------------------- | ---------------------------------------- |
| Why           | always on, `max-w-40` | `@sm`, `max-w-28` → `@lg` 40 → `@4xl` 56 |
| When          | `@lg`                 | `@xl`                                    |
| Location      | `@xl`, `max-w-48`     | `@2xl`, `max-w-40`                       |
| Left on shelf | `@2xl`                | `@3xl`                                   |

And at the one width where Why cannot have a column, the reason folds into the
item cell, exactly as When and Location already did:

```
{/* And the reason, at the one width where its own column cannot fit.
    A change with no WHY is not an entry. */}
<span className="truncate text-sm @sm:hidden">{movementReason(movement.reason)}</span>
```

## Proven by measurement, at fourteen widths

| pane   | before   | after     | overflow before | overflow after |
| ------ | -------- | --------- | --------------- | -------------- |
| 320px  | —        | **121px** | —               | 0              |
| 360px  | 64px     | **161px** | 15px            | **0**          |
| 390px  | 64px     | **191px** | 23px            | **0**          |
| 480px  | 121px    | 169px     | 0               | 0              |
| 520px  | 161px    | 209px     | 0               | 0              |
| 560px  | **79px** | **201px** | 0               | 0              |
| 600px  | **64px** | **119px** | **224px**       | **0**          |
| 672px  | **64px** | **191px** | **152px**       | **0**          |
| 760px  | **64px** | 128px     | **132px**       | **0**          |
| 830px  | —        | 130px     | —               | 0              |
| 896px  | —        | 196px     | —               | 0              |
| 1100px | —        | 336px     | —               | 0              |

**No sideways scroll at any width**, and the item name never drops below 119px.
It was on its 64px floor at six of the widths measured.

Verified on screen afterwards: "Brass belt hardware, a… / BRASS-BELT-1 / 2 days
ago · Main Wareh…", where it had read "Brass…".

The 830px reading is worth keeping. The first draft put Why's growth at `@3xl`,
the same breakpoint that brings Left on shelf back, and measurement showed the
give-cell drop to **66px** in that band — the exact mistake being fixed,
reintroduced one breakpoint along. Moving the growth to `@4xl` put it at 130px.
It would not have been visible without measuring between the breakpoints.

|                 |              |
| --------------- | ------------ |
| piggles console | **499 pass** |
| sparx console   | **401 pass** |
| typecheck       | both exit 0  |
| lint / prettier | clean        |

## Still open

This is issue 565's family and 565's list is still open: 23 more tables with a
give-cell and two or more always-visible unshrinkable columns. This one was found
by reading a screen rather than by the list, which is the point — but the list
would have found it, and a check that measured the give-cell across breakpoints
would have found all 24.
