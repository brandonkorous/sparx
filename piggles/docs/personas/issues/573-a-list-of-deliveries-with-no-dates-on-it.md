# 573 — A list of deliveries with no dates on it

**Status:** fixed and proven on screen
**Severity:** medium
**Found by:** Devi, on Partners → Booking stock in
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/receiving-list.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_fetched_but_never_rendered]] · [[feedback_a_fix_leaves_its_neighbour_behind]]

## What she saw

Partners → Booking stock in, in her ordinary three-pane layout:

| Receipt   | Order         | Units |
| --------- | ------------- | ----- |
| GR-000003 | PO-<br>000002 | 58    |
| GR-000002 | PO-<br>000001 | 2     |
| GR-000001 | PO-<br>000001 | 38    |

**No date.** A list of deliveries that cannot answer "did that one come in this
week?" — the question the screen exists for. And the order number is breaking
across two lines at its own hyphen.

## Measured

The pane is 549px. The table has five columns and three of them disclose:

```tsx
<th>Receipt</th>
<th className="hidden @lg:table-cell">Order</th>
<th className="hidden @xl:table-cell">Into</th>
<th className="text-right whitespace-nowrap">Units</th>
<th className="hidden whitespace-nowrap @2xl:table-cell">When</th>
```

549px clears `@lg` (512) and not `@xl` (576), so **Into** and **When** are both
gone. The Order column has a fold-back line under the receipt number for narrow
panes; the other two have none, so they simply vanish.

The file's own header says what was meant:

> _Columns disclose with @container so a narrow pane keeps the **reference**, the
> **order** and **when it landed**._

It kept the order. It lost the other two — and one of them was never in a column
at all.

**The packing-slip reference is the sharper loss.** All 9 goods receipts on the
platform carry one — `FT-8871`, `AM-DN-4502`, `PACKING-7741` — and it is how a
delivery is matched to the paper in the box. It has no column anywhere, it rode
only on that fold-back line, and the fold-back line hides at `@lg`. The search
box on this very pane invites you to type it:

> _Try part of a receipt number, an order number, or a **packing-slip reference**._

So the console will find a receipt by a number it will not show you.

Three real dates were being hidden: 15, 10 and 9 September.

## The fix

Every piece the columns drop, folded back under the receipt number, each hiding
at the breakpoint where its own column arrives — so nothing is ever said twice:

```tsx
<span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
  <span className="@lg:hidden">{order}</span>
  <span className="max-w-40 truncate @xl:hidden">{warehouseName}</span>
  <span className="whitespace-nowrap @2xl:hidden">{formatDay(receivedAt)}</span>
  <span className="max-w-40 truncate font-mono">{reference}</span>
</span>
```

The reference has no column, so it never hides.

And `whitespace-nowrap` on the Order cell: `PO-000002` was breaking at its hyphen
because the browser treats one as a break opportunity. An identifier is one word.

**Now**, verified on screen:

> **GR-000003**
> Main Warehouse · September 14, 2026 · FT-8871&nbsp;&nbsp;&nbsp;PO-000002&nbsp;&nbsp;&nbsp;58

## One I checked and did not file

Two receipts stored at `2026-09-10 00:39 UTC` and `2026-09-15 05:01 UTC` render
as 9 and 14 September on my screen. That is the viewer's own timezone, and it is
a deliberate, already-reasoned house decision, written down in `lib/today.ts`:

> _The person's own device clock, deliberately, not the business's saved zone …
> Whether a trading day should belong to the shop's zone instead is a real
> question and a bigger one: it would have to move `period.ts`, the server's day
> buckets and the stored values together, and it cannot be half done._

Measured, read, dismissed.

## Proven

Layout, so it is proven by measuring the rendered pane rather than by a unit
test: the fold line now carries the location, the date and the packing slip at
549px, and `PO-000002` renders on one line. Both consoles.

|                 |              |
| --------------- | ------------ |
| piggles console | **426 pass** |
| sparx console   | **338 pass** |
| typecheck       | both exit 0  |
