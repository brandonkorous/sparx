# 593 — The same sale had five names in the other console

**Status:** fixed
**Severity:** copy
**Found by:** P03 · Juniper Row · act 201
**Surface:** sparx workbench › Money, Selling report, Orders, Carts, Checkouts, Price lists
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** — (not yet seen on screen; the dev stack was down)

## What happened

Issue 260 fixed this in Piggles: one sale, four screens, four different names
for the place it came from. The fix was a single shared file, and every Piggles
screen now calls it.

The sparx console was never brought along. Following up on
[586](586-the-console-has-one-word-for-my-website-and-two-panes-never-heard-it.md),
which had recorded "sparx still carries three separate `channelLabel`
functions", the real count is **six** — two more than 586 said, because two of
them are not called `channelLabel` and so were not found by looking for that
name.

One order entered by hand reads, on six screens:

| screen            | what it says             |
| ----------------- | ------------------------ |
| Money › Channels  | In person or by phone    |
| Selling report    | Added by your team       |
| The order itself  | Entered by your team     |
| Price list picker | Orders you enter by hand |
| Carts             | Entered by your team     |
| Checkouts         | Entered by your team     |

And the same spread for the other places a sale comes from:

| stored value   | how many different names it had                             |
| -------------- | ----------------------------------------------------------- |
| `admin`        | **4**                                                       |
| `b2b_portal`   | 3 — Wholesale portal · Trade portal · Your wholesale portal |
| `storefront`   | 2 — Your website · Your online store                        |
| `import`       | 2 — Imported · Imported orders                              |
| `mcp`          | 2 — AI assistant · Your AI assistant                        |
| `marketplace`  | 2 — Marketplace · Marketplaces                              |
| `sparx_market` | 2 — sparx.market · sparx Market                             |

## What should have happened

A channel is a fact about an order, and a fact may not have six names. What the
platform decided in issue 260 for Piggles applies word for word to sparx: the
same sale, named the same way, wherever it appears.

## How to reproduce

Every time, on any order entered by hand.

1. Open an order whose channel is `admin`. It reads "Entered by your team".
2. Open **Money › Channels**. The same sale is under "In person or by phone".
3. Open the selling report. It is under "Added by your team".

## Why it matters

Not wrong money, but it makes one sale look like several. An owner reconciling
the selling report against Money cannot tell whether "In person or by phone" and
"Added by your team" are the same $96 counted once or two different sales, and
the totals will not settle it, because a shop with one till sale has the same
number in both rows either way.

It also carries a claim the data does not support. "In person or by phone" says
how the order arrived. The stored value only knows it did **not** come through
the website. And "Added by your team" and "Entered by your team" both tell a
sole trader about a team she does not have.

## Where it lives

`sparx/apps/workbench/lib/console/channels.ts` is new, ported from the Piggles
file that issue 260 created. Six private tables are gone:

| file                                      | was                                            |
| ----------------------------------------- | ---------------------------------------------- |
| `surfaces/finance/format.ts`              | its own `MARKETPLACE` map + a `switch`         |
| `surfaces/commerce/reports-data.ts`       | `CHANNEL_LABEL`                                |
| `surfaces/commerce/data.ts`               | `CHANNEL_LABELS` + `MARKETPLACE_SOURCE_LABELS` |
| `surfaces/commerce/price-list-detail.tsx` | `CHANNEL_LABELS`, file-private                 |
| `surfaces/commerce/checkout-data.ts`      | `CHECKOUT_CHANNEL_LABELS`                      |
| `surfaces/commerce/carts-data.ts`         | `CART_CHANNEL_LABELS`                          |

Each now calls the shared one, in the same shapes Piggles uses: `format.ts` and
`reports-data.ts` re-export it, `data.ts` keeps its order-shaped wrapper, and the
cart and checkout helpers delegate.

**Two of the six were invisible to the search that found the others.**
`CHECKOUT_CHANNEL_LABELS` and `CART_CHANNEL_LABELS` are the same vocabulary
under different names, so grepping for `channelLabel` — which is how 586 arrived
at "three" — found four of six. What found all six was asking who IMPORTS the
thing rather than who defines it: the two extra tables turned up as callers with
no import.

**Which words won.** The Piggles wording, because issue 260 already reasoned it
through against a real business and the two consoles are meant to agree.
`admin` is **"Added by hand"** (it says what happened and assumes nothing about
a team or a telephone); `pos` is **"At the till"**, which is a real till as
opposed to an order typed in afterwards. The one place sparx keeps its own
spelling is `sparx_market` → **`sparx.market`**, which is the product's name in
docs/106 and docs/107 and what four of the six tables already said.

## Guard

`lib/console/one-channel-vocabulary.test.ts`, in **both** consoles. It parses
every source file and fails on any object literal outside the house module whose
keys are three or more channel slugs mapped to strings.

Three is the threshold on purpose. One or two slugs is a pane making a local
distinction — a filter offering `storefront` and `b2b_portal`, say. Three is a
vocabulary, and a vocabulary belongs in one place. It also only counts slugs
mapped to STRING literals: `{ storefront: 3 }` is a tally and
`{ storefront: <Icon/> }` is an icon set, and neither is a second set of names.

Proven red: putting `CART_CHANNEL_LABELS` back fails it, naming the file, the
line and the four slugs.

It asserts it scanned more than 300 files, so it cannot go blind and print green.

Piggles passes it unchanged, which is the point — it has been correct since
issue 260 and now cannot quietly stop being.

## Still open

Nothing. Both consoles have one channel vocabulary, guarded.

Two more `channelLabel` functions live outside the consoles and were **not**
touched: `wizeworks/apps/admin/lib/acquisition.ts` and
`wizeworks/services/api-rest/src/lib/analytics/metrics/commerce-sales.ts`. The
admin one is the WizeWorks staff console, a different audience with different
words. The api-rest one labels an analytics response. Neither is a tenant-facing
console screen, so neither is this issue; worth knowing they exist before
someone assumes the shared file is now the only one on the platform.

**Not yet seen on screen.** The dev stack was down for this act, so this is from
the parser, the guard and the files. The first screens to check: an `admin`
order in sparx, against **Money › Channels** and the selling report.
