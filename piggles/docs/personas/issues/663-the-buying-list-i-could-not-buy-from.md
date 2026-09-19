# 663 — The buying list I could not buy from

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 235
**Surface:** Stock — What to reorder, and Why this number
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 235 (a supplier linked, the notice clearing, the line drafted)

## What she saw

Devi had just walked an order out of the building, so she asked the obvious next
question and opened **What to reorder**. One line:

| Item                                     | Supplier        | Available | To order | Runs out     |
| :--------------------------------------- | :-------------- | --------: | -------: | :----------- |
| The Ash Overshirt · THE-ASH-OVER-XS-BONE | No supplier yet |         0 |       12 | Out of stock |

At the bottom of the pane, in its own line with a lorry beside it:

> **Choose lines to draft orders** · click a row to see how its figures were
> worked out · shift-click alongside

She clicked the tick box. Nothing happened. She clicked the one in the header.
Nothing happened.

Both were disabled, correctly — a purchase order needs somebody to send it to,
and nothing supplies that item. But a disabled tick box looks exactly like an
empty one, the reason sat two columns away as a badge that reads like a label,
and the sentence under the table went on telling her to do the thing the screen
would not let her do. [[feedback_a_promise_in_copy_is_a_contract]]

## It is not an edge case

Measured across every tenant on the platform, the same afternoon:

| Tenant           | Lines on the worklist | Of those, un-orderable |
| :--------------- | --------------------: | ---------------------: |
| Threadline       |                    65 |                 **65** |
| Wildroot Flowers |                     3 |                      2 |
| WizeWorks LLC    |                     3 |                      2 |
| Inventory Test   |                     3 |                      1 |
| Juniper Row      |                     1 |                  **1** |
| Sable Thyme      |                     1 |                      0 |

**71 of 76.** For four accounts out of six, every single line on the screen is
one the screen refuses to act on, and the only thing saying so is a control that
does not respond.

## The count already existed

`assembleSuggestions` has always split these off into their own array and
reported `counts.unsupplied`. The list route read that result, flattened both
halves into one table, and dropped the count on the floor — so the only thing a
screen could do about such a line was grey its tick box.
[[feedback_fetched_but_never_rendered]]

It now rides on the list response beside `total`, counted over the **whole
narrowed list** rather than the page, because a page is a window: "3 of these
cannot be ordered" is untrue of a window holding three of sixty-five.

## What the screen says now

A second notice under the reorder-level one — they are two different reasons this
list cannot do its job and an account can have both at once:

> **This one cannot be ordered yet**
> Drafting an order needs to know who you buy from, and no supplier is linked to
> this item. Open the supplier under Suppliers and add the item under “What you
> buy from this supplier”. Until then this list can tell you what is running low,
> but it cannot turn it into an order.
> **[Suppliers]**

With some but not all stuck it counts both halves instead, and promises nothing
about a rest that does not exist:

> **3 of these need a supplier first** … The other 9 lines can be chosen and
> drafted as normal.

And the sentence under the table no longer opens with an invitation when not one
line on the page can be chosen. It just says what a click does.

## The one the fix created, and closed

The notice opens Suppliers **beside** the reorder pane. Linking the supplier over
there left the pane on the left still saying "cannot be ordered yet", because
nothing invalidated the worklist — two panes side by side disagreeing about a
thing that had just been fixed in one of them. `useInvalidateSuppliers` now
refreshes it, which also covers archiving or renaming a supplier whose name the
worklist prints.

## Driven end to end

```
What to reorder → "This one cannot be ordered yet" → [Suppliers]
  → Ashcombe Mills → What you buy from this supplier → Add an item
  → THE-ASH-OVER-XS-BONE · $24.00 each → "added to what you buy here"
  → back: notice gone · Supplier "Ashcombe Mills" · tick box live
  → footer: "Choose lines to draft orders …"
```

## And the sentence beside it was broken English

Clicking the row opens **Why this number**, whose own heading promises "nothing
here is a black box". Under the sales table it read:

> The forecast uses **the nothing sold**, at 0 a day. Sales landed on 0 days out
> of the last 90, and there are 25 days of history for it.

`forecastBasisLabel` answers five ways. Three name a window — "last 30 days" —
and read correctly after "uses the". The other two are not windows at all, so
the sentence came out as above, or as "uses the not measured". Those two are
exactly the branches a shop with no sales history gets, which is every shop in
its first week.

It is one tested helper now, and the 90-day clause is dropped when nothing sold
because it says the same thing a second time:

> Nothing has sold, so the forecast is 0 a day, and there are 25 days of history
> for it.

## What was good here, and was already good

- **Why this number** prints the actual arithmetic with her numbers in it, and
  says why: "Check it on paper if you like. That is the point of showing it."
- Each input carries **Measured** or **Assumed**, so she can see which half of
  the figure is a guess.
- The reorder-level notice above already counts honestly — "75 of your 76 stock
  lines have no reorder level" — which is the same discipline this issue extends
  one step along.
- Every column that folds away at narrow widths folds **back into the item cell**
  rather than vanishing, "No supplier yet" included. Checked at 360px.

## Files

- `wizeworks/services/api-rest/src/routes/v1/inventory/reorder.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/reorder-supplier-words.ts` (new) + test
- `piggles|sparx/apps/workbench/surfaces/inventory/{reorder-data.ts,suppliers-data.ts}`
- `piggles/apps/workbench/surfaces/inventory/{reorder-list.tsx,reorder-list-empty.tsx,reorder-list-footer.tsx,reorder-window.ts}`
- `sparx/apps/workbench/surfaces/inventory/reorder-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/inventory/{planning-data.ts,planning-explain.tsx}` + `planning-words.test.ts` (new)
- `piggles|sparx/apps/workbench/lib/api/client.ts`
