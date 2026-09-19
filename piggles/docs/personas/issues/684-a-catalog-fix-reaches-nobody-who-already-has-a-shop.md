# 684 — A catalog fix reaches nobody who already has a shop

**Status:** fixed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 241
**Surface:** every tenant's product page, and the way the platform ships page fixes
**Filed:** 2026-09-19
**Fixed:** partly; see The fix and What is still open
**Confirmed by:** P03, on her own Journal site; see below
**Blocked on:** —

## What happened

[682](682-the-shop-page-never-said-it-was-a-preorder.md) and
[683](683-the-shop-never-said-when-a-sold-out-thing-comes-back.md) were both fixed
in `commerce.ts`, the catalog factory that builds a product page. Every test
passed. The page still said nothing.

Because a product page is not built from the factory when somebody looks at it.
It was built from the factory ONCE, on the day the site was made, and the result
is a row in `builder_pages`. Fixing the factory fixes the next tenant.

MEASURED 2026-09-19 across every stored product page in the dev fleet. Thirteen
are published and live. Every one has a working Add-to-cart form:

```text
can say "Sold out"            0 of 13
can say "Made to order"       1 of 13
can say "Preorder, ships …"   0 of 13
can say "Back in stock …"     0 of 13
```

**NOT ONE live shop can tell a customer a thing is gone.** Their form is not
gated on `soldOut` either, because the ref did not exist when they were stamped,
so it renders in full on a product with nothing behind it. This is not a preorder
problem. It is every shop, on the commonest thing that happens to stock.

## Why

The catalog is a STAMP, not a template. `record-templates.ts` says so plainly:
these "all materialize once and are then the tenant's". That is the correct trade
for a published page — an author's work must not change under them — but it has a
consequence: a bug the platform shipped in a factory lives on every page stamped
from it, forever, and the owner has no way to know and no realistic way to fix it
by hand.

`upgrade-page.ts` exists for exactly this and says all of the above in its own
header. It had three repairs. None of them was about what a page is allowed to
SAY, and nothing had ever compared a stored buy box with the factory's.

## What should have happened

A page that takes money is not allowed to fall behind on what it must disclose.
Design drifts; a missing "sold out" is a different kind of thing.

## How to reproduce

1. Sign in as `p03.devi@piggles.test`, Juniper Row.
2. **Stock › Preorders**, open an offer on a product with no stock.
3. Open that product on her Journal shop.

Full price, live Add to cart, no preorder line, no sold-out line. Fixing the
factory changes nothing here.

## Why it matters

It is the reason the previous two fixes were worth nothing on their own, and it
will be the reason the next one is. Anything added to a buy box from now on
reaches new sites only, silently, and the gap widens every time somebody improves
the factory.

It is also the more dangerous half of 682. That issue was about a shop that could
not say "preorder". This one says no shop at all can say "sold out", which is the
thing that happens to every shop every week.

## Where it lives

| What                        | Where                                                     |
| --------------------------- | --------------------------------------------------------- |
| The factory that was fixed  | `wizeworks/packages/silica-catalog/src/commerce.ts`       |
| The stamp nobody re-reads   | `builder_pages.silica_published_tree`                     |
| The repair that can heal it | `wizeworks/packages/silica-catalog/src/upgrade-page.ts`   |
| The draft-only read         | `wizeworks/packages/builder/src/services/site-service.ts` |

## The fix

**One repair in `upgradePageBody`: bring a stamped buy box's supply disclosures
up to the factory.** It finds the add-to-cart form, gates it on `soldOut`, and
inserts whatever is missing of the made-to-order note, the preorder panel, the
sold-out notice and the back-in-stock line. The nodes are the FACTORY'S OWN,
called rather than rebuilt, so the repair cannot drift from what a new site gets.

It clears that file's stated bar by more than any repair in it: broken on
published sites, stamped by the platform and not by any author, and the correct
replacement is known exactly.

**Why it is safe to run on somebody's page.** Every node it adds is gated on data
an ordinary product does not carry, and the engine drops a node whose ref
resolves to nothing. On a product that is simply in stock the healed page renders
not one extra word; the only difference in the markup is a 33-byte wrapper the
sold-out gate hangs on.

**One repair, not four.** They are one capability: what the page says instead of,
or before, the button. A page healed to say "sold out" but not "preorder" still
takes money for nothing.

## Proved red, and one that was proved on screen instead

Seven tests. Removing the repair reddens exactly two of them; weakening any gate
reddens four.

Measured against real data rather than fixtures: all thirteen stored trees pulled
from the database, healed, and re-healed. **13 of 13 gained all four
disclosures, and 13 of 13 were stable on the second run.**

**And that measurement was wrong, which is the lesson.** The repair put the
panels in the PAGE GRID. The two-column grid's child is the buy-box column, whose
children include the form, so the grid matched first and the preorder panel
became a grid cell beside the photograph — **544 by 719 pixels of solid amber** —
and the sold-out gate wrapped the ENTIRE right-hand column, so a sold-out product
would have lost its title, its price and its description along with its button.

Every ref was present. Every ref was correctly gated. The fleet probe said 13 of 13. It was found by opening the page in the studio and clicking the yellow block.

> **Presence is not placement.** A structural repair has to be looked at.

**It happened a second time, in the measurement itself, and that one was worse.**
The table above first read **3 of 13** for "Sold out". It was counted the obvious
way — search each stored tree for the `soldOut` ref — and every tree has it,
because `versionChoice` gates each version on `soldOut` so a sold-out size can
grey itself out. So the count was of pages with a version picker. The true number
was **zero**.

The same false positive was inside the repair. `hasGate` searched the subtree,
found the picker's `soldOut`, concluded the column already had a sold-out notice,
and **never added one to any page**. The fleet probe reported thirteen of thirteen
healed; not one had gained the disclosure this issue is mostly about.

The fix is structural rather than textual: the notice, the panels and the gate are
all DIRECT children of the buy box column, because that is where the factory puts
them and where the repair puts them, so `hasDirectGate` asks about direct children
only. And one function, `missingDisclosures`, now answers "what can this buy box
not say" for BOTH the repair and the surface that reports it. When those were two
pieces of reasoning they disagreed immediately and silently: the panel said a page
could say "sold out" while the repair was declining to add it. **A repair and its
report have to be the same sentence or the panel lies.**

The recognition is now tight — a direct form child, or the sold-out gate around
one, and nothing else — and there is a test that heals a real two-column page and
asserts the grid still has exactly two cells. Loosening the lookahead reddens it.
[[feedback_a_test_that_cannot_go_red]] [[feedback_test_as_a_business_owner]]

## Confirmed by

> **In the studio, as Devi.** Opened **My Site › Page › Each product** on the
> Journal site. The page loaded, the repair ran and the footer said "Saved.
> Visitors still see the last published version." The draft in the database
> gained `preorder.shown` and `backInStock`; the published tree did not, which is
> the contract holding exactly as written.

That is also where the placement bug appeared, and it is the whole argument for
driving the screen: the database said the repair had worked.

> **End to end, after the placement fix.** The page was reopened, and the repair
> wrote the right shape this time: the page grid back to **two** cells, and the
> sold-out gate wrapping **one** node, the form. Published from the studio as
> Devi. The API then served the healed tree, and the bracelet's page rendered:
>
> > **Preorder: ships July 1, 2027**
> > Strung to order by the workshop in Lyon.
>
> That is a page stamped months ago, carrying a disclosure written today, which
> is the thing this issue says was impossible.

> **The telling, on her Home screen.** Amber, above "What needs you":
>
> > **Your live shop is behind the pages you have saved** [ Review and publish ]
> > Until you publish, your product pages cannot tell a customer:
> > · When something sells out, your page does not say so. The Add to cart button
> > stays on it, and somebody can buy a thing you do not have.
> > Publishing puts them on your site. Nothing you have written changes.
>
> Two lines below it, in "What needs you": **3 items are sold out.** She had three
> right then, and her shop could not say so about any of them.
>
> The button opened the Publish pane, which listed the same sentence beside the
> header-and-footer one. Publishing put all three disclosures live. Reloading the
> pane, the whole panel was **gone** — it is derived from what is published, so it
> disappears the instant the live site has it, with nothing to clear and nothing
> to go stale.

One caution worth writing down, because it nearly produced a wrong conclusion:
after publishing, the browser kept showing the old page. The tree was right, the
API was right, and the rendered HTML from a fresh request had the panel in it —
the tab was serving a cached copy. A cache-busting query settled it. **"I looked
and it was not there" is not a measurement until the response you looked at is
the one you just changed.**

## Telling her, which was the half that mattered

**The heal lands on the DRAFT, so a live site does not change until its owner
publishes.** That is the right blast radius and it has not been widened. What was
missing was that nobody was ever told, so the repair existed and never arrived.

`live-chrome-gap.ts` had already solved exactly this for the header and footer.
The page body now has its twin, built to the same contract:

|                                      |                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `livePageGaps()`                     | What the LIVE pages cannot say, DERIVED from what is published rather than stored, so it disappears the instant the live site has it |
| `POST /v1/builder/site/repair-pages` | The repair, on request, over every saved page. Draft only                                                                            |
| Home                                 | One offer, above the fold, with the button that starts it                                                                            |
| Publish pane                         | The same list under "Your visitors are not getting these yet"                                                                        |

**Two sources, two different buttons**, which is the lesson issue 315 paid for.
A `saved` gap is resolved by publishing. A `waiting` gap is not — her draft is as
stale as her live page, and publishing would send the same page back out. One
un-repaired page makes the whole row `waiting`, deliberately: telling an owner to
publish something a publish cannot fix is the failure the field exists to prevent.

**Pages come before chrome on Home.** A header missing its account link
inconveniences a visitor; a page that cannot say "sold out" takes their money for
a thing that is not there. Only one offer shows at a time, because two boxes
saying "your site is behind" is a wall she scrolls past.

**And the sentences are capabilities, not incidents.** "When something sells out,
your page does not say so" is true and actionable for every shop on the platform.
"You have a sold-out product right now" would be a claim about stock this code
cannot check and has no business making.

Beyond that, the question this issue really raises: a supply disclosure is a
CAPABILITY, not styling, and the platform already renders capabilities live
through host cores rather than stamping them. A buy box that rendered from code
would make this class of bug impossible instead of repairable. That is an
architecture decision, not a defect fix, and it is written down here rather than
taken.

## Rating effect

Recorded in [rating.md](../rating.md) against `inventory.preorders`, with 682 and
683 — the same surface, the same pass, and the reason the other two were not
finished.
