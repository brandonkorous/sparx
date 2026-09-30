# 766 — The accepted quote named the order and refused to open it

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 271
**Surface:** `invoicing.invoice.edit` — the lifecycle header, both consoles
**Filed:** 2026-09-22
**Fixed:** 2026-09-22
**Confirmed by:** P03, accepting Q-000017 and walking to order O-000020
**Blocked on:** —

## What happened

Tamsin said yes. Devi moved the quote to **Accepted** and turned it into an
order, which is the whole point of having made one. Three things went wrong on
the way, all in the same header.

### The menu spoke in schema

The stage picker, which is the control she uses to say what has happened:

```
MOVE TO STAGE
  Draft         [draft]         Will assign its number
  Submitted     [draft]
  Under Review  [draft]
  Quoted        [draft]
  Accepted      [committed]     Will freeze a permanent record of it
  Declined      [void]          Will lock it from further edits
  Expired       [void]          Will lock it from further edits
```

The badge printed `stage.stageType` raw. So the row said **Submitted** and the
badge beside it said **draft**, which is a contradiction on one line; the
**Draft** row's badge repeated the word it sat next to; and the two words that
carried any information at all, `committed` and `void`, are database enum values
a shop owner has never seen.

The file next door, `stage-presentation.ts`, already owns the plain wording for
exactly these six roles, and says so in its own comment: _"'committed' tells a
shop owner nothing on its own."_ The workflow EDITOR used those words. The menu
she opens every day did not. [[feedback_a_fix_leaves_its_neighbour_behind]]

### It offered to collect money on a price nobody owed

The overflow menu on an accepted quote:

- Print or save as PDF
- **Copy payment link**
- Convert to order

The link collects `balance`, which on Q-000017 was the whole $504.00, and its
toast calls that _"the amount still owed"_. Two panels down on the same screen,
in copy written the day before, the Deposits panel says:

> Nothing is owed on a quote. Record a deposit here only if you have taken money
> to hold the job.

One screen, two answers. `canPaymentLink = doc.balance > 0`, and a quote has a
balance the way a menu has prices.

### And then the door was locked

She converted. The toast said **"Order O-000020 created"** and stopped there.
Reopening the menu:

```
  Print or save as PDF
  Copy payment link
  ⧉ Order O-000020 exists          ← greyed out
```

An open-in-a-new-window icon, on a disabled row, at the exact moment she wanted
to go and look at the order. The menu's own doc comment promises the opposite:
_"Each item appears only when it can actually work, so the menu is the
document's real capabilities, not a list of greyed-out wishes."_
[[feedback_a_promise_in_copy_is_a_contract]]

## What was done

**`typeBadge()` in `stage-presentation.ts`** — the six roles as one short phrase
each, from the vocabulary that file already owns:

| stage type | badge                       |
| ---------- | --------------------------- |
| draft      | not promised yet            |
| open       | sent, still yours to change |
| committed  | they said yes               |
| final      | they owe it                 |
| paid       | settled                     |
| void       | called off                  |

**The payment link is gated on the document being a bill** —
`doc.balance > 0 && !priceOffer`. Money taken on an offer is a deposit, and
Deposits already has its own button for that.

**The converted order is a door.** `ctx.open('commerce.order.detail', …)`, both
from the menu row (now **Open order O-000020**) and automatically on conversion,
so the order is already in front of her when the toast arrives.

**"Convert to order" is now "Turn it into an order"**, which is the voice the
rest of the console uses: _Price up a quote_, _Raise an invoice_, _Enter an
order_. And its failure toast reads the document's noun.

## Files

- `piggles/apps/workbench/surfaces/invoicing/stage-presentation.ts`, `sparx/…` — `typeBadge`
- `piggles/apps/workbench/surfaces/invoicing/lifecycle.tsx`, `sparx/…` — badge, gate, door, label
- `piggles/apps/workbench/surfaces/invoicing/invoice-editor.tsx`, `sparx/…` — passes `noun` + `priceOffer`

## Proof

Read on screen 2026-09-22:

```
MOVE TO STAGE
  Draft         [not promised yet]   Will assign its number
  Submitted     [not promised yet]
  Under Review  [not promised yet]
  Quoted        [not promised yet]
  Accepted      [they said yes]   ✓  Will freeze a permanent record of it
  Declined      [called off]         Will lock it from further edits
  Expired       [called off]         Will lock it from further edits
```

The overflow menu on the accepted quote is now two rows — **Print or save as
PDF** and **Open order O-000020** — with no payment link. Pressing the second
opened O-000020 in its own tab:

```
Not paid · To send · $504.00
Tamsin Vale — Placed Sep 22, 2026 · Added by hand
Marlow Knit, mixed sizes, spring range   12 × $42.00   $504.00
Who bought it: Tamsin Vale · Wholesale customer: Loom and Larder
```

The wholesale account carried through the conversion, which is the 763 fix
holding one step further down the road.

Both consoles carry all four changes; sparx had every one of them.
