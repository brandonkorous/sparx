# 449 — The sparx console cannot settle a swap at all

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 109 (while fixing [448])
**Surface:** sparx workbench › Selling › Returns › a return
**Filed:** 2026-09-08
**Fixed:** 2026-09-08
**Confirmed by:** act 110, driven on screen at localhost:3011

## What is wrong

`sparx/apps/workbench/surfaces/commerce/return-actions.tsx` ships five moves:

| move         | sparx  | piggles |
| ------------ | ------ | ------- |
| Approve      | yes    | yes     |
| Turn down    | yes    | yes     |
| Received     | yes    | yes     |
| Record check | yes    | yes     |
| Refund       | yes    | yes     |
| **Swap**     | **no** | yes     |

There is no `ExchangeReturnModal`, no `useSettleExchange`, and no call to
`settleExchange` anywhere in that console.

**This is [220] verbatim, still live.** That issue reads _"an even exchange could
only be ended by refunding a customer who was owed nothing"_, and it was fixed in
piggles only. A shop on sparx whose customer asks for a different size can end
that return in exactly one way: give the money back.

## Why it matters

The service supports it. `settleExchange` exists, moves both halves of the stock,
publishes `return.exchanged`, and — since [448] — writes to the customer. The API
route exists. Only the screen is missing, so the capability is paid for, tested
and unreachable.

It is also the fifth time this shape has appeared: a capability built in one
console and never given to the other (acts 88, 89, and issues [436], [439]).

## What it needs

A port, not a design. The piggles implementation is
`surfaces/commerce/return-exchange-modal.tsx` plus `useSettleExchange` in
`returns-data.ts` and one entry in the moves list. The two consoles' returns
surfaces have already diverged in shape (sparx keeps all its modals in one
`return-actions.tsx`), so it is a port into that file rather than a file copy.

It should land with [450]'s picker behaviour, which piggles now has and sparx
does not: open on the product that came back, and show what there is of each
version.

## The fix

The port, and three things the port could not leave alone.

**1. The move itself.** `ExchangeReturnModal` in `return-actions.tsx` (this
console keeps every modal in one file), `useSettleExchange` in `returns-data.ts`,
`'exchanged'` added to `ReturnStatus`, and a `Send replacement…` row in the
detail pane. `canRefund` split into `canRefund` / `canExchange` on
`preferredOutcome`, so the wrong move is not merely available beside the right
one — it is gone.

**2. The screen said the wrong thing about how to finish.** `returnState` took a
status alone, so every ready-to-settle return read _"Give the customer their
money back to finish"_ — including the swaps. It now takes the outcome too, the
way the piggles copy already did, and a swap reads _"Send the replacement they
asked for to finish. No money moves."_ Same for the "Received" confirm, which
promised a refund step to somebody owed a part.

**3. The picker could not be read at all.** `versionOf` and the option-value
search were piggles-only. `/v1/commerce/variants` has always returned `options`
on every row; this console typed the field away, so a fuel injector's two
versions both rendered as `Fuel Injector — 6.7L Cummins` with the price as the
only difference. That is [182] and [221] still live here, and a picker nobody can
read is not a working swap. `options` added to `VariantChoice`, `versionOf`
ported, and typing "reman" now matches.

**4. A swapped return was findable under no filter chip.** Both consoles' returns
lists pinned each chip to one status and stopped at "Settled" = `refunded`. A
**Swapped** chip added to both.

### Where the code changed

- `sparx/…/commerce/returns-data.ts` — `exchanged`, `useSettleExchange`,
  outcome-aware `returnState`
- `sparx/…/commerce/return-actions.tsx` — `ExchangeReturnModal`
- `sparx/…/commerce/return-detail.tsx` — the row, the split, the modal
- `sparx/…/commerce/{variant-picker.tsx, bundles-data.ts}` — `versionOf`, `options`
- `{piggles,sparx}/…/commerce/returns-list.tsx` — the Swapped chip

## Confirmed by

Driven on screen at `localhost:3011` on return SO-1003, Dana Whitfield, a faulty
6.7L Cummins injector wanting a replacement. Received → **Send replacement…** →
the picker opened on the injector's own two versions reading **None left** and
**18 to sell** → the button read **Send Remanufactured** → settled.

Measured after: `commerce_return_requests.status = 'exchanged'`,
`refunded_amount_cents = 0` (not a $0.00 refund pretending to be a refund), one
stock movement of −1 leaving balance 17, and an automation run
**"Replacement sent — email" · completed** carrying
`replacementLabel: "Fuel Injector — 6.7L Cummins — Remanufactured"`. That last
row is [448] proven end to end in production code, on a console that could not
reach the path when [448] was written.

Two further defects were found while driving it and are filed separately:
[451] and [452].
