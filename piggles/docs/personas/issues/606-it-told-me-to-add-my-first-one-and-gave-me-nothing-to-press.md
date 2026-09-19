# 606 — It told me to add my first one and gave me nothing to press

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 205
**Surface:** mypiggles › Sell › Made to order (and thirteen more)
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 205 (button seen and clicked through)

## What happened

I make coats to measure, so **Made to order** should be mine. I opened it:

> **No builds yet**
> A build lets a shopper make a product to order: choosing a size, a finish, an
> engraving, anything that changes what they get or what it costs. **Set up your
> first one to get started.**

So I looked for the thing to press, and there wasn't one. The card has a
picture, a heading, that sentence, and nothing else. My pane was 567px wide,
which is what you get with two panes side by side.

The way in is a small round **+** at the top of the pane. It has no words on it.
I found out what it does by hovering over it.

## Measured

The toolbar's create button hides its label on a narrow pane. Read off the live
screen at each width, waiting for the bar to settle:

| pane width | what the button says |
| ---------: | -------------------- |
|      360px | nothing              |
|      440px | nothing              |
|      512px | nothing              |
|      600px | nothing              |
|      700px | Set up a build       |
|     1100px | Set up a build       |

So under about 700px — every phone, and every pane in a two-up split — the only
way to make the first one is an unlabeled icon, on a screen whose whole message
is "make the first one".

**I measured this wrong the first time** and nearly filed something false. My
first pass resized the pane and read the button in the same tick, and the label
never appeared at any width, because the bar sizes itself from a ResizeObserver
that had not run yet. Waiting two animation frames gives the table above. A
measurement that does not wait for the thing it measures is a guess with numbers
on it.

## Why the toolbar is right and this is still wrong

The collapse is deliberate and well argued. `pane-toolbar-actions.tsx` says it:

> THE LABEL MAY HIDE ONLY WHEN THE ICON CAN CARRY IT ALONE. In a pane already
> titled "Customers", `+` is unambiguous — the title supplies the noun.

That holds for somebody who has used the app. **It does not hold on a first
run**, which is exactly the case where the reader does not yet know what this
screen makes, and is being told to make one.

And the empty state already knew that. Its own component says so:

```ts
/** The create action — a <Button color="module"> that makes the first one. */
actions?: ReactNode;
```

Thirty-nine lists pass one. **Sixteen do not**, and fourteen of those sixteen
still print a sentence telling the reader to add the first one.

## Where it lives

`workbench/components/list-empty-state.tsx` and fourteen list surfaces, in both
consoles.

**Fixed in one place plus one line each.** `FirstRunState` gained an `action`
that takes the **same object the toolbar is given**, and the component renders
the button:

```ts
action?: { label: string; onClick: (event: ActionEvent) => void };
```

Taking the action rather than a rendered button is what keeps the label in one
place. Each surface now hoists its create action to a `createFirst` const and
hands the same object to both, so renaming "Add a bundle" cannot leave the empty
state saying something else. No icon on the prop on purpose: the two consoles
draw their glyphs from different libraries, and a labelled button needs none.

The fourteen:

| app       | list                                                                              |
| --------- | --------------------------------------------------------------------------------- |
| Sell      | bundles, categories, groups, made to order, discounts, gift cards, special prices |
| Customers | customers, deals, pipelines, segments, tasks                                      |
| Partners  | trade accounts, price tiers                                                       |

Both consoles, 28 files, each one a hoisted const and an `action:` line. The
toolbar keeps its own icon, title and narrow-pane collapse untouched — that
behaviour was not this change's business.

## The two I left alone, and why

**Shelves** (`inventory/bins-list`). Its empty state says "Turn them on for a
location from its settings, then add the shelves you actually have." The first
step is not on this screen, so a "New shelf" button here would contradict the
sentence above it. Its create control also sits in the toolbar's `controls`
slot rather than the primary one, which is a separate question.

**Sites** (`sites/sites-list`). Already carries a comment saying the omission is
deliberate: "No action: nothing conjures a first site, and the toolbar already
carries 'New site'." That toolbar button is the labelled kind, visible at every
width, so the reasoning holds.

Not fixing these two is a decision, not a leftover.

## The mistake I made fixing it, and what it cost

Halfway through I wanted to redo the codemod, so I ran `git checkout --` on
seven of the files.

**That deleted an earlier session's uncommitted work in all seven.** Nobody
commits during these runs, so the working tree is the only copy: the checkout
restored HEAD and took with it a `{rows.length > 0 ? <RowOpenHint /> : null}`
guard in every one of the seven, plus a whole **"Given away"** column and its
import in `discounts-list.tsx`.

`row-hint-hidden-when-empty.test.ts` caught the guards — it exists for exactly
that — and named all seven files. **Nothing would have caught the column.** It
came back only because I happened to have copied the tree to a scratchpad
minutes earlier for a different reason.

Restored, re-applied, and 578 tests green. Written down so the next run does not
repeat it: back up before a sweep, and never reach for git to undo your own
edit.

## Guard

The existing `row-hint-hidden-when-empty.test.ts` is what caught the collateral
damage, and it went red on exactly the seven files, which is the shape a guard
should have.

For this defect itself, the measurement is the evidence: the label ladder above,
taken off the live pane at six widths, before and after. Then the button was
clicked on screen and landed on `/commerce/configurator/new`.

## Still open

Nothing from this issue.

Worth someone's afternoon, noted not filed: the two consoles declare a toolbar's
primary action two different ways — `primaryAction={{…}}` (an object the bar
compacts) and `primary={<Button>}` (a node it leaves alone). Piggles uses both;
sparx uses only the second, and hides its label with a hand-written
`hidden @lg:inline` on a span, which is the very per-call-site decision the
`primaryAction` slot was introduced to end.
