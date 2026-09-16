# 493 — The arrival date the server worked out never reached the screen

**Status:** fixed
**Severity:** major
**Found by:** Devi placing her first purchase order with Ashcombe Mills
**Surface:** `inventory.purchase-orders.detail` (both consoles)
**Filed:** 2026-09-09

## What was wrong

The Expected field carries a promise:

> When you expect it. Left blank, the supplier's usual lead time fills it in
> when you place the order.

She left it blank and placed the order. The header changed to
**Placed September 9, 2026**, the banner said _"40 of 40 units still to come"_,
and the Expected box stayed **empty**.

The server had kept the promise perfectly. Asking the database straight
afterwards:

```
number    | status    | ordered_at | expected_arrival_at
PO-000001 | submitted | 2026-09-09 | 2026-09-30
```

Twenty-one days, which is exactly Ashcombe Mills' recorded lead time. The date
existed, the pane had fetched it, and the box showed nothing.

The purchase-orders LIST showed it correctly the whole time
(`Expected · September 30, 2026`), which is the tell: the record was right and
one screen was not reading it.

## Why

The pane seeds its editable draft from the fetched record behind a one-way
latch:

```ts
// Seed local state once the record lands (or immediately for a new order).
useEffect(() => {
  if (isNew) {
    setLoaded(true);
    return;
  }
  if (detail && !loaded) {
    const next = draftFromDetail(detail);
    setDraft(next);
    setOriginal(detail.lines);
    setBaseline(JSON.stringify(next));
    setLoaded(true);
  }
}, [isNew, detail, loaded]);
```

`loaded` goes true on the first fetch and never goes back. **Every fetch after
the first is dropped on the floor.**

That is safe while this pane is the only thing that writes the record, and it is
not. Placing an order is the SERVER working out the arrival date from the
supplier's lead time (`deriveArrival` in `purchase-order-lifecycle.ts`). The
place mutation even invalidates the query correctly, so the fresh record arrives,
lands in `detail`, and is refused at the door.

Same family as
[478](issues/478-she-added-a-supplier-and-was-told-it-was-not-saved.md) and
[483](issues/483-two-more-panes-saved-a-record-and-kept-denying-it.md) — a pane
holding local state that stops agreeing with the record — but a different
consequence. 478 and 483 were "it says unsaved"; this one is **"it does not show
what the server worked out"**, and nothing on screen looks wrong. An empty box
is what an unset date looks like.

## The fix

The guard that belongs there is DIRTY, not loaded. A refetch that would clobber
something half-typed is still refused, which is what the latch was really
protecting; a refetch landing on a form nobody is editing is just the truth
arriving, and there was never a reason to turn it away.

```ts
if (!detail) return;
const next = draftFromDetail(detail);
const serialized = JSON.stringify(next);
// Nothing new to show, or something typed that must not be clobbered.
if (loaded && (dirty || serialized === baseline)) return;
setDraft(next);
setOriginal(detail.lines);
setBaseline(serialized);
setLoaded(true);
```

Comparing the serialized record against the baseline is what stops it looping:
once adopted, `baseline === serialized`, so the next run returns immediately.

## Proven

Not by reloading — a reload seeds fresh and would prove nothing. PO-000002 was
still a draft with an empty Expected box, so it was placed and WATCHED:

| moment                  | Expected box   |
| ----------------------- | -------------- |
| before placing          | empty          |
| after "Place the order" | **09/19/2026** |

Ten days, which is Fairfield Trims' lead time. The date arrived on its own, with
no reload and nothing typed. The database agrees:

```
PO-000002 | submitted | 2026-09-09 | 2026-09-19
```

## Not swept

Eleven panes per console carry the same `!loaded` latch:

`business-details`, `crm/record-detail`, `email/email-settings`,
`finance/expense-detail`, `inventory/bin-detail`,
`inventory/purchase-order-detail`, `inventory/supplier-detail`,
`partner/bootcamp-detail`, `sites/site-manage` (`sites/site-detail` in sparx),
`staff/person`, `team/member`.

The latch is only a DEFECT where the server enriches the record on an action the
pane itself fires, so this fixes the one that was proven and leaves the rest to
be driven rather than swept blind. `crm/record-detail` is already known to
derive its saved copy from the query and self-heal.
