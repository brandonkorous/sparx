# 327 — Eleven buttons in the console did nothing at all, and said nothing either

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · trying to publish the fix for [326]
**Surface:** mypiggles › My Site, Stock, and the empty-workspace screen
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** the button, clicked, opening the pane it names

## What happened

Devi had listed her Instagram and Pinterest in **Site identity** and needed to
publish so her visitors would get them. The pane says where to go, and puts a
button under the sentence:

> How your header and footer are arranged — and your colors, type, and shapes —
> are designed in the editor. **[Design the header & footer]**

She pressed it. The button took focus. Nothing else happened — no pane, no
message, no spinner, no error. Pressing it again did the same nothing.

**Colors & type**, beside it, behaved identically.

## What should have happened

The editor opens. It is the only way to publish a header or footer, so with both
buttons dead there is no route from "I added my social links" to "my visitors can
see them" at all.

## How to reproduce

Every time, on any site, before the fix.

1. **My Site › Your site**, scroll to the bottom.
2. Press **Design the header & footer**, or **Colors & type**.
3. Nothing opens. The button is not disabled — it takes focus normally.

## Why it matters

**A control that does nothing and says nothing is the worst failure a button
has.** A disabled button explains itself. An error tells her something is wrong
and that it is not her fault. This teaches her that she pressed the wrong thing,
so the reasonable next move is to hunt for the right one, and there isn't one.

**It is not one button.** The same mistake is in eleven places across the
console, and they were all silent in the same way. The worst of them is the
screen you get when you close your last pane on a phone:

> **Nothing open** — Pick something from the menu to get started. **[Start here]**

That screen exists to be the way out of a dead end. Its own comment says so.
**Start here** opened `workbench.home` — sparx's Home, which the Piggles console
does not register — so the one button on the screen written to prevent a dead end
was itself the dead end.

**And nothing anywhere would ever have reported it.** Typecheck passes: the
surface key is a plain string. Lint passes. The tests pass. The button renders,
takes hover, takes focus, takes a click. It is
[[feedback_absent_behaves_like_fine]] in its purest form — a missing registration
renders identically to a correct one.

## Where it lives

`controller.open` in
[controller.ts](../../../apps/workbench/lib/workbench/controller.ts) resolves the
key and gives up without a word:

```ts
const definition = getSurface(surface);
if (!host || !definition) return null;
```

The eleven calls, and what each of them meant:

| Where                             | Opened                      | Should open                        |
| --------------------------------- | --------------------------- | ---------------------------------- |
| `builder/site-identity.tsx` ×2    | `builder.studio` + a `mode` | `builder.layout` · `builder.theme` |
| `builder/page-results.tsx`        | `builder.studio`            | `builder.page`                     |
| `builder/saved-piece-detail.tsx`  | `builder.studio`            | `builder.piece`                    |
| `builder/saved-pieces-list.tsx`   | `builder.studio`            | `builder.page`                     |
| `inventory/barcode-conflicts.tsx` | `commerce.products.detail`  | `commerce.product.detail`          |
| `inventory/barcodes-list.tsx`     | `commerce.products.detail`  | `commerce.product.detail`          |
| `inventory/warehouse-mode.tsx`    | `commerce.products.detail`  | `commerce.product.detail`          |
| `inventory/pack-bench.tsx`        | `crm.orders.detail`         | `commerce.order.detail`            |
| `inventory/stock-ownership.tsx`   | `inventory.stock.detail`    | `inventory.stock.item`             |
| `components/empty-workbench.tsx`  | `workbench.home`            | `piggles.home`                     |

Two different histories, and both are ordinary:

**`builder.studio` was deleted.** It was the one pane that edited a whole site,
and it was split into a pane per document — `builder.page`, `builder.theme`,
`builder.layout`, `builder.piece`, `builder.publish`. Five call sites kept naming
it. The split was NOTICED at the time, in
[vocabulary.ts](../../../apps/workbench/lib/console/vocabulary.ts), which still
carries a paragraph explaining that the key stopped existing — so someone worked
this out, wrote it down beside the screen names, and never looked for the buttons.

**The other five are typos** — a plural (`products` for `product`, `orders` for
`order`), and a word that was never the key (`stock.detail` for `stock.item`).
The params were all correct. Only the key was wrong.

## What is telling about this one

**The platform already knows how to say it, and only says it for links.** Ask for
`/home` in the Piggles console and it does not fail silently — it lands on

> `/link-not-found?detail=workbench.home&reason=unknown-path`

which is an honest answer to "that address opens nothing". A URL naming a dead
surface gets a screen. A BUTTON naming the same dead surface gets silence. The
two paths were given opposite treatments of the same mistake.

## The fix

**1. The eleven call sites**, each pointed at the pane it was always naming.
Nothing else changed: every one of them already passed the right parameters.

**2. A check, because eleven of these accumulated without a single failure.**
[check-surface-routes.mjs](../../../../scripts/check-surface-routes.mjs) already
held the two directions between the route table and the registry. It gains the
third — **every `open('…')` in either console must name a registered surface** —
which is the direction that was blind, and the one all eleven were hiding in.

It reads the literals rather than importing the registry, for the reason the file
already gives: the registry pulls in React, silicaui and 341 pane components, and
this is a data check. It prints its denominators (`341 surfaces … 744 open()
calls across 2105 files`) and asserts every scan root exists, so it cannot go
quietly blind the way five other checks did in one tree move — see
[[feedback_structural_checks_go_blind]]. Proved red on a one-character typo and
green again, both directions.

**3. Five that are recorded, not fixed.** The check found the same three typos in
`sparx/apps/workbench` — the tree Piggles was copied from in August, so these are
the originals and Piggles inherited them. `sparx/**` is off limits under Piggles
RULE #0, so they are listed by exact call site in `KNOWN_DEAD_OPENS` with the
reason, and a stale entry there fails the check too. **They are still five dead
buttons in the sparx console** and want someone who owns that tree:

```
sparx/apps/workbench/surfaces/inventory/barcode-conflicts.tsx:153  commerce.products.detail
sparx/apps/workbench/surfaces/inventory/barcodes-list.tsx:106      commerce.products.detail
sparx/apps/workbench/surfaces/inventory/pack-bench.tsx:582         crm.orders.detail
sparx/apps/workbench/surfaces/inventory/stock-ownership.tsx:59     inventory.stock.detail
sparx/apps/workbench/surfaces/inventory/warehouse-mode.tsx:256     commerce.products.detail
```

**Not fixed here, and deliberately:** the silence itself. `controller.open`
returning null for an unknown key is still a decision a caller cannot see. The
check now makes it impossible to SHIP one, which is the better place to catch it
than a toast in front of a customer.

## Confirmed by

**The screen.** **Design the header & footer** opens the Site layout pane on
`/builder/header-footer?site=primary`, with Devi's real header and footer in it.
That is also what finally let [326] be published and confirmed.

The check is green on both consoles, and was proved red on a deliberate
one-character typo (`piggles.hom`) and on a recorded call site that no longer
matches, then green again after each.

## Rating effect

Against `My Site › Site identity`, and against `Stock` for the four in the
warehouse screens. The panes themselves are good; the way out of them was not
connected.
