# 813 — The guard for renamed screens was blind to more than it saw

**Status:** fixed
**Severity:** copy (105 sentences) + a guard that was reporting green over them
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles workbench — 20 panes across Customers, Stock, Email, Invoices, Sell, Money, Bookings, Social and Setup
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** the guard, now at 87 renamed screens over 24,646 sentences, proved red
**Blocked on:** —

## How it was found

Scoring **Customer reports** as Devi, two tiles read **"Pipeline value"** and
**"Active segments"**. This console calls those things _how things move_ and
_groups of customers_. `check:screen-names` exists to catch exactly that, and it
was green.

## The hole

```js
// One word matches ordinary prose all day; only a phrase is a name.
if (entry.sparx.trim().split(/\s+/).length < 2) continue;
```

Any rename whose sparx name is a **single word** was skipped. The reasoning is
sound — "Site", "Media", "Reports", "Tasks" and "Inbox" are all real renames and
all real English, and matching them across every file would flood.

But skipping them left a hole **bigger than the coverage**. Measured
2026-09-25:

|                                               | panes  |
| --------------------------------------------- | ------ |
| renamed, sparx name is one word — **skipped** | **56** |
| renamed, sparx name is longer — checked       | 51     |

The majority of the renames were invisible to the guard that exists to protect
them. Issues 719 and 723 fixed 99 and 89 sentences of this defect; this is the
third tranche and nobody could see it.

## The fix to the guard

A one-word name is checked **only inside the file that draws that screen**. In
`segments-list.tsx` the word "segment" is the screen's name and nothing else; in
a shipping pane it is prose. That closes the hole without the flood.

Two refinements followed from the first run:

**A name that grew a word at the FRONT is not a rename away.** The guard skipped
"What matters" → "What matters most" but not "Requests" → "Help requests", so it
flagged _"No open requests"_ on the pane called Help requests, and _"No
duplicates found"_ on Possible duplicates. `startsWithPhrase` is `containsPhrase`
now: **30 false reports gone**.

**`${…}` inside a template literal is code, not words.** _"Where the number for
`${movement.variantSku}` stands now"_ was reported as naming the Movements
screen, because the identifier in the hole is called `movement`. The holes are
blanked before matching.

## What it found: 105 sentences across 20 panes

| pane                  | tab says | body said                                          | n   |
| --------------------- | -------- | -------------------------------------------------- | --- |
| Groups of customers   |          | "Active segments", "No segments yet"               | 11  |
| Things to do          |          | "All tasks", "Could not load your tasks"           | 11  |
| What kind of business |          | "Set my industry", "Could not apply that industry" | 13  |
| Moving stock          |          | "New transfer", "Loading transfers…"               | 12  |
| Automatic emails      |          | "Search sequences", "No sequences yet"             | 12  |
| Email campaigns       |          | "Search broadcasts", "New broadcast"               | 11  |
| What happens when     |          | "New workflow", "No workflows yet"                 | 9   |
| Baskets left behind   |          | "No abandoned carts", "Loading carts…"             | 6   |
| Money paid to you     |          | "Could not load payouts"                           | 4   |
| Comments and replies  |          | "Put back in the inbox"                            | 3   |
| Other software        |          | "Search integrations"                              | 3   |
| Every change          |          | "Movements filters"                                | 2   |
| and eight more        |          |                                                    | 8   |

Rewritten, never word-swapped, which is the rule in the guard's own header:

> "Could not load your segments" → **"Could not load your customer groups"**
> "A transfer moves stock from one of your locations to another" → **"This is
> stock on its way from one of your places to another"**
> "A sequence follows up with someone over time" → **"A series follows somebody
> up over time"**

"customer group" rather than bare "group", because this console also has Groups
of products and Wholesale groups, and a search box saying "Search groups" would
be three things at once.

One toolbar was converted on the way: "Industry actions" is now "Controls for
what kind of business", so `check:toolbar-names` covers 82 toolbars rather
than 81.

## Six recorded exceptions

Where the word is ordinary English on its own screen, `NOT_OUR_WORD` now says so
with a reason:

- **scoring** — the verb for working a number out again. _"Could not finish
  re-scoring"_ has no plainer form.
- **profit** — the screen is What you kept; the number on it is a profit, and
  calling it anything else avoids the word a business owner uses.
- **approval** ×2 — _"Hold any order over a set amount for approval"_ is what
  the setting does.
- **connection** — the act of connecting an account, not the screen listing them.

## Proved red

Putting `title="Could not load your segments"` back:

```
  surfaces/crm/segments-list.tsx:159
      "Could not load your segments"
      this screen is "Groups of customers" in Piggles, not "Segments"
```

Green it reads: **87 renamed screens, 24,646 sentences across every surface, and
every one calls a screen what its tab calls it.** Before this act it was
checking 51.

## Caught by prettier, not by me

One replacement in the sweep sliced a quote off its own string
(`'Nothing to do',` became `'Nothing to do,`). Typecheck would have caught it;
prettier caught it first, on the run immediately after. The diff was then read
back line by line before anything else.
[[feedback_codemod_diff_your_own_sweep]]

## Left alone

`copyStrings` requires two lowercase words, so a **single-word** string is never
read at all. That is a reasonable filter — most one-word strings are props and
identifiers — but a column header is one word and is user-facing: the Things to
do table was headed **"Task"** until this act, and the guard could not see it.
It says "What to do" now. Widening the filter to single words is a separate
question with its own flood to measure.
