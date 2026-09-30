# 833 — A wire value is safe until something draws it

**Status:** fixed
**Severity:** copy + correctness
**Found by:** P03 · Juniper Row · act 281
**Surface:** both consoles — Paying for what sold, Money paid to you, Sites, one domain
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi

## "cancelled", in British, on a pane that says "canceled" twice

The consignment settlement badge was this:

```tsx
<Badge color={settlementTone(data.status)} variant="soft">
  {data.status}
</Badge>
```

There was a tone function and no LABEL function, so all four call sites across
the two consoles drew the stored value verbatim:

> draft · closed · invoiced · paid · cancelled

Lower case, in the trade's own words. And the last one is the British spelling,
because that is what is in the database — on a pane whose own copy says
**"canceled"** twice, in its failed-load sentence and in its toast. **One screen,
one word, two spellings.**

That is the exact failure `american-spelling.test.ts` was built for, and one it
cannot catch. `'cancelled'` in that file is a WIRE VALUE and correctly exempt:
respelling it would not fix a spelling, it would stop matching the database and
the event catalog. The exemption is right.

**The exemption is only safe while nothing DRAWS the value.** That is the finding.

## The sweep, and what it found

Measured across 1,202 surface files in both consoles, for a stored field drawn
as the whole of a JSX child:

| Where                                     | Drawn             | Verdict                                               |
| ----------------------------------------- | ----------------- | ----------------------------------------------------- |
| `inventory/consignment-settlement-detail` | `{data.status}`   | **Defect** — British spelling, lower case, jargon     |
| `inventory/consignment-settlements`       | `{row.status}`    | **Defect** — same                                     |
| `sites/sites-list`                        | `{site.status}`   | **Defect** — "paused" / "archived", lower case        |
| `domains/domain-detail`                   | `{kind}`          | Fine — "TXT", "CNAME" is what their provider says     |
| `builder/saved-piece-usage`               | `{row.kind}`      | Fine — `'Page'` / `'Layout'`, minted in the file      |
| `scheduling/booking-resource-picker`      | `{resource.kind}` | Fine — staff / equipment / table / space, capitalized |

Three of eight, mirrored in both consoles. The three that are fine are worth
listing because the shape is not automatically wrong: a value is drawable when it
was written to be read.

## What they say now

`settlementState` returns a label and a tone together, so the two cannot drift
apart the way a tone-only helper let them:

| Stored      | Piggles            | sparx    |
| ----------- | ------------------ | -------- |
| `draft`     | Still adding to it | Draft    |
| `closed`    | Owed               | Closed   |
| `invoiced`  | Billed to you      | Invoiced |
| `paid`      | Paid               | Paid     |
| `cancelled` | Canceled           | Canceled |

And a site that is not live says **Paused** or **Put away** rather than `paused`
or `archived`.

## Two greys, worked out rather than asked for

`draft` and `cancelled` were `neutral`, which is not a color this file may choose
(RULE #4). Working out what they MEAN settled it without an ask: a draft owes
nobody anything yet, and a canceled period owes nobody anything ever, so neither
has urgency to carry. Their `tone` is **undefined**, which renders a COLORLESS
badge — a different thing from naming grey, and sanctioned without approval.

Same for `archived` on a site: the badge was `warning` for both non-live states,
which is right for "you paused this and may want to undo it" and wrong for "this
is put away". And for the DNS record type badge, which was `color="neutral"` on a
value that carries no meaning to color.

## "Deposit", on a pane called Deposit, under a tab called Deposit

`finance.payout.detail`'s toolbar status was a literal:

```tsx
status={<p className="text-sm">Deposit</p>}
```

The pane's own name, said a third time, in the slot that exists to say something
a person could not otherwise see. The two facts somebody opens a deposit to
confirm are **how much** and **whether it has landed**, and the second lived only
in a badge in the body, which scrolls away. The bar carries both now, and says
**Could not be read** rather than a word when the read failed.

Same shape as issue 831's "Preview" on the blueprint pane. Third time this act
that a mode name or a pane name was sitting in a status slot.

## The same picture, twice, in one viewport

Paying for what sold has two sections, both empty on a first run, and each one
drew the brand's artwork. The same illustration appeared twice, one above the
other, on one screen. Two copies of one picture does not read as a pattern; it
reads as a mistake.

Each region decides its own state without knowing what its neighbour chose,
which is right — the first section's code even argues, correctly, for why it uses
the branded state rather than a glyph. What was missing was the pane-level view.
`PaneEmpty` takes `art={false}` now, for a SECOND empty region on the same pane:
one picture says whose pane this is, and the sections under it get a glyph and a
label.

**Not swept.** 15 files hold two or more `<PaneEmpty>`, and most of those are
alternative BRANCHES (no rows / no match) that can never render together. Only
the ones that stack are defects, and telling them apart needs reading, not a
regex. [[feedback_codemod_diff_your_own_sweep]]

## Files

- `piggles|sparx/apps/workbench/surfaces/inventory/{demand-data,consignment-settlements,consignment-settlement-detail}.ts|tsx`
- `piggles|sparx/apps/workbench/surfaces/sites/sites-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/domains/domain-detail.tsx`
- `piggles/apps/workbench/surfaces/finance/payout-detail.tsx`
- `piggles/apps/workbench/components/pane-empty.tsx`

## The thing to remember

**Check what draws it before exempting it.** Every guard in this repo has a list
of values it deliberately does not check — wire values, column aliases, keys,
another company's own words — and every one of those lists is correct. What none
of them asks is whether the value also reaches a screen. A `grep` for the field
rendered as a bare JSX child answers it in one pass, and it is worth running
whenever an exemption is added.
