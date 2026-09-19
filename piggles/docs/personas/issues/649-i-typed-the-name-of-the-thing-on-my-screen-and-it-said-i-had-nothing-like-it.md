# 649 — I typed the name of the thing on my screen and it said I had nothing like it

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 224
**Surface:** the console's search box (⌘K) — the record half of it
**Filed:** 2026-09-18
**Fixed:** 2026-09-18
**Confirmed by:** P03 · Juniper Row · act 224 (the hit appeared, opened the record, and the footer changed its answer)

## What happened

With **Welcome series** open in the pane behind it, I typed `welcome` into the
box that says **"What do you want to do?"** and got two screens and this:

> Nothing in your records matches "welcome". Everything below is a screen.

The record was on screen. The sentence was about my business, and it was wrong.

Nothing in the whole **Messages** app was searchable: not a campaign, not an
automatic email, not a rule. Measured 2026-09-18:

|                                        |           |
| :------------------------------------- | --------: |
| email campaigns on the platform        |    **16** |
| automatic emails                       |    **15** |
| automation rules                       | **2,411** |
| of those, findable from the search box |     **0** |

## Why that sentence is the defect, and not just the gap

`launcher-rows.tsx` records its own history in a long comment. The sentence used
to NAME what it looked through, was wrong twice for that reason, and the decision
taken was to stop listing and grow the index instead:

> A list of what was searched is a promise that goes stale every time the index
> grows, and the useful fact is simply that the record half found nothing.

That makes the unqualified sentence a claim about **the whole index**. So a kind
of record with no projector is not a missing feature somewhere; it is that
sentence telling an owner her business contains nothing by that name.
[[feedback_never_present_absence_as_measurement]]

And the plan was already written down. `registry.ts` has said since Phase 1:

> Phase 2 appends CMS / Email / Site Builder bundles here.

It never did. [[feedback_a_fix_leaves_its_neighbour_behind]]

## The fix

Three projectors, in `commerce-indexer/src/messaging-projection.ts`:

| record            | title              | subtitle              | also matches on              |
| :---------------- | :----------------- | :-------------------- | :--------------------------- |
| `email_broadcast` | what she called it | what the customer saw | the subject, preheader, tag  |
| `email_sequence`  | its name           | its description       | its description              |
| `automation`      | the rule's name    | its description       | its trigger (`order.placed`) |

Two decisions worth naming:

- **A campaign has two names and they are different.** "Autumn drop
  announcement" is hers; "The last of the linen" is what landed in an inbox. She
  may remember either, so the subject is the subtitle AND a keyword rather than
  only one of them.
- **The trigger is a keyword, never the subtitle.** `order.placed` is machine
  vocabulary. A search box is exactly where somebody types it after seeing it on
  a screen, so it has to MATCH without being read back at her.

**Seeded rules are indexed alongside hand-written ones.** 2,404 of the platform's
2,411 arrived with the account; excluding them would index seven rules and call
it the automations index. They are in her account, she can read them, she can
switch them on.

Then the two halves that make a projector actually reach anybody:

- **A write-time signal.** `indexEntity` after every write that moves one — 15
  call sites across the three routes, including status changes, because status is
  faceted and switching a rule on has to reach the index.
- **A route binding.** `entity: 'email_sequence'` and its two siblings on the
  detail routes, so clicking the hit opens the record instead of resolving to
  `undefined` and doing nothing.

## Confirming it

End to end, as Devi, through the real stack:

1. Saved her sequence, which published `search.entity.changed`.
2. Asked Typesense directly:

   ```
   found: 1
     email_sequence | Welcome series | /email/sequences/aaeed243-…
   ```

3. Typed `welcome` in the console. A new group **Automatic emails** appeared with
   **Welcome series** under it, and the footer changed to **"1 record matched.
   The rest are screens."**
4. Clicked it. It opened the sequence.

## Guard

**`check:search-entities`** (`scripts/check-search-entities.mjs`), wired into
`pnpm check:search-entities` and the pre-push hook. It holds the three things
that have to line up, in three packages that have no dependency on each other:

1. a projector exists,
2. something signals the index when one is WRITTEN,
3. a route binding exists so the hit opens.

Today: **30 projectors, all routed, 30 signalled on write, from 32 signal
sources in 2,204 files.**

Proved red six times:

1. Remove one route binding → names the type and says a hit on it opens nothing.
2. Remove one write signal → names the type and says it reaches search only on a
   reindex.
3. **Read only ONE call shape** → **10 of 30 falsely reported**. See below.
4. Point a projector file at a path that does not exist → exits 1 refusing to
   scan less than it claims. [[feedback_structural_checks_go_blind]]
5. Remove the real `cms_page` signal while `seo-audit.ts` still carries the same
   word → names `cms_page`. This is the one the earlier version could not do.
6. Recognise no signal source at all → exits 1 rather than reporting all thirty
   as faults.

## The guard said a thing was fine, and it was not

Found while refreshing the stale `reindex-only` comments on the projectors,
which is the kind of tidying that is supposed to change nothing.

The check matched a bare `entityType: 'x'` **anywhere in any file**. That word is
not owned by the search index. `api-rest/src/lib/seo-audit.ts` builds an SEO
snapshot keyed `entityType: 'cms_page'`; a notification seed uses the key; so
does a test fixture. Thirteen of thirty types were being counted on evidence that
did not mean what the check read it to mean.

Twelve were accidentally right — their real signal is a literal in a MAP fed into
the helper (`commerce/src/events.ts`) or a hand-built `search.entity.changed`
envelope (`crm/src/pubsub-bridge.ts`), two shapes the narrow patterns miss. One
was not:

> **`cms_page` had no write-time signal at all, and never had.** A tenant's
> policy pages and standalone pages reached search only on a reindex, and the
> guard printed a tick over it.

Measured: 30 projectors, 29 genuinely signalled, `cms_page` the only gap.

**The fix is a property of the FILE, not the line.** A file is read for signals
only if it could be issuing one — it calls an `index*Entity*` helper, or it names
`search.entity.changed`. That keeps the map-and-variable shapes working while the
look-alikes drop out. Test files are excluded outright: a signal in a fixture
proves nothing about production. The success line now prints the number of signal
SOURCES beside the number of files, so a scan that stops recognising them is
visible rather than quietly generous. [[feedback_a_test_that_cannot_go_red]]

**The narrow version and the wide version failed in opposite directions, and the
wide one is worse.** Reporting a fault that is not there gets read and corrected,
as it was here on the first pass. Reporting a tick over a real gap is read once
and believed.

### The guard nearly reported a fault that was not there

The first scan matched `indexEntity({ entityType: 'x' })` and reported **eleven**
kinds of record as never indexed. Eight of them were fine: the modules wrap the
helper in their own positional versions — `indexCommerceEntity(ctx, 'bundle',
id)`, `indexInventoryEntityOnCommit(ctx, 'purchase_order', id)` — and a check
that knows one spelling reports the other spelling as a fault.

Caught by reading the eleven and going to look at one, not by the check going
green. It now matches both shapes and the real number is three.
[[feedback_dont_argue_without_proof]]

## The four that were still waiting, closed the same day

Four kinds of record had a projector and **no write-time signal**, so one made
today only became findable after somebody ran `ops:reindex-search`. Three were
named by the guard, with the reason, so they could not sit there quietly. The
fourth was hidden BY the guard, which is its own story below. All four are
closed:

| record             | signalled from                                                |
| :----------------- | :------------------------------------------------------------ |
| `cms_entry`        | create, update, delete, publish, unpublish, revision restore  |
| `cms_page`         | the same six, paired with `cms_entry` (see below)             |
| `billing_document` | create, update, send, delete, stage advance, payment recorded |
| `media`            | upload reserved, upload completed, metadata edited, deleted   |

Two of those needed a second look rather than a copy of the same line:

- **`media` has a writer that is not a route.** `media-worker` owns the
  `uploading` → `ready` flip on any backend that transcodes, and `status` is a
  faceted field. Signalling only from the routes would have left every
  photograph reading as still uploading, forever. The failure branch signals too,
  so a file that could not be processed says so rather than staying hopeful.
- **`billing_document` is found by its NUMBER, and the number is not assigned at
  create.** Entering a stage is what numbers it, so a quote becoming invoice
  INV-1042 has to signal from `advance` — the create signal alone would index it
  under a number it did not have yet.

`cms_entry` turned out to need the most care of the three, for a reason that only
showed up once the guard was honest. `content_entries` is ONE table read by TWO
projectors that split on one column: `typeKey = 'page'` is a `cms_page` document,
everything else a `cms_entry` one. A route holds an id and nothing else, so it
cannot know which it just saved.

So both are signalled, every time, through `api-rest/src/lib/content-search.ts`.
The wrong one is a no-op: a projector returns `null` for a row that is not its
kind, and the indexer treats a null projection as "remove this". The pair is also
self-correcting in the one case that would otherwise rot — an entry whose typeKey
CHANGES moves from one index name to the other in the same breath, with no orphan
left behind.

Written out as two calls rather than a loop over a pair, because the guard reads
these literals and a name it cannot see is a name it reports as missing. Five
tests hold the rule; removing the `cms_page` half reddens three of them.

`NO_WRITE_SIGNAL_YET` in the guard is now empty, and the success line reads
**"None waiting on a reindex."** Proved red by renaming one `entityType` string:
the guard named `billing_document` and exited 1. It also caught all three itself
on the way through, with the "now signalled, delete the entry" branch — the list
cannot go stale in the safe direction either.

## Also recorded, not fixed

This dev database holds **54 documents** in the universal index for the entire
platform, and **one** for Juniper Row. Her 36 customers, her products and her
orders are absent from their own collections too. Seed data is written by scripts
that do not go through the routes, so nothing ever published for it. That is why
the record half of the search has read as broken for every persona so far, and
the remedy already exists (`ops:reindex-search`) — it has simply never been run
here.
