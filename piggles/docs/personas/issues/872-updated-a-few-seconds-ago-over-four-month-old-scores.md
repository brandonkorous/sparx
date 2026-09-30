# 872 — "Updated a few seconds ago" over four-month-old scores

**Status:** fixed
**Severity:** **major** — the page list on Get found is a stored snapshot, and
its freshness marker reported when the BROWSER last fetched rather than when
anything was scored. Measured across the platform, **370 of 370 audits were more
than a week old**, averaging 47 days and reaching 117, every one of them under a
tooltip reading "updated a few seconds ago". The screen's own primary action is
**Rescan the site**, so the age of the scores is the whole input to the one
decision it offers
**Found by:** P03 · act 308, opening Get found with the dev ports down, from the
code and the database
**Surface:** mypiggles › Get found › Site checks, in both consoles
**Filed:** 2026-09-29
**Fixed:** 2026-09-29
**Confirmed by:** 11 tests, proved red on two different wrong rules

## Measured

```
seo_audits, platform-wide           370 rows, 16 tenants
  oldest computed_at                2026-06-04   (117 days)
  newest computed_at                2026-09-19   ( 10 days)
  average age                        47 days
  older than a week                 370 of 370
```

Devi's own 148, on the day she opened it (2026-09-29):

```
builder_page   74   scored 2026-08-29 .. 2026-09-19
product        34   scored 2026-09-17
cms_page       27   scored 2026-09-17
collection     13   scored 2026-09-17
```

So the freshest thing on her screen was ten days old and the oldest was a month,
and the only date on offer said "a few seconds ago".

## The wrong question, asked correctly

```tsx
<RefreshButton
  isFetching={audits.isFetching}
  updatedAt={audits.data ? audits.dataUpdatedAt : undefined}
```

`dataUpdatedAt` is react-query's **fetch** time. The shared `RefreshButton`
documents itself as taking exactly that:

```ts
/** `dataUpdatedAt` from the query. Omit only if the list genuinely has no
 *  loaded data yet. */
updatedAt?: number;
```

**Nothing is wrong with that component**, and nothing is wrong with the ~15
ordinary lists using it, where the server's reply IS current and "when did I last
ask" is the same question as "how current is this". This list is a snapshot read
back unchanged, so the two questions come apart, and one of them was answered.

The tooltip read:

> Refresh · updated a few seconds ago

## The server has always sent the real answer

```sql
SELECT
  a.id, a.entity_type AS "entityType", a.entity_id AS "entityId",
  a.score, a.grade, a.fix_first AS "fixFirst", a.title, a.path,
  a.computed_at AS "computedAt", a.card
FROM seo_audits a
```

And the console's own type declares it **required**, in both consoles:

```ts
/** One row in the site-wide list — a page and its latest score. */
export interface AuditRow {
  …
  computedAt: string;   // not optional
}
```

[[feedback_fetched_but_never_rendered]]

## Its own sibling does it correctly

Three files away, in the same folder:

```tsx
// seo/performance.tsx:139
<Timestamp value={run.computedAt} format="relative" />
```

One of two surfaces in one folder asks the right question.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## And the detail makes it worse, not better

The detail pane **re-scores on open** and the live endpoint **re-stores the row**.
So:

- the detail is always current, and its `dataUpdatedAt` is honest there, because
  a read genuinely re-scores;
- the list is not;
- and opening one page quietly freshens that single row while the other 147 stay
  months old.

A fresh detail disagreeing with a stale list, with no age on screen, reads as a
bug in the score rather than as the list being old.

## What it says now

```
before   Every page scored for how easily people can find it on a search engine.
         Open a page to see exactly what to change.
                                            [tooltip] Refresh · updated a few seconds ago

after    Every page scored for how easily people can find it on a search engine.
         Open a page to see exactly what to change.
         Scored 31 days ago. Rescan to bring them up to date.
```

And when only some are old:

```
Scored 31 days ago. 12 of 27 are more than a week old. Rescan to bring them up to date.
```

Visible text rather than a tooltip, for two reasons written into the module: the
primary action on that toolbar is **Rescan the site**, so this is the input to
the decision the screen exists to offer; and freshness in a tooltip is a fine
place for "do I need to click this", which is not the same question as "are these
numbers true".

## The rule, and why it is the oldest

**A list is only as current as its OLDEST row.** Reporting the newest would let
one rescan of one page speak for a hundred stale ones, which is the same wrong
answer the fetch time gave, arrived at differently. The oldest can never claim
the scores are fresher than they are.

A stamp that cannot be parsed returns **null**, not "now". An unreadable date is
not evidence of freshness, and inventing "just now" from it is the bug this
replaces coming back through the other door.
[[feedback_never_present_absence_as_measurement]]

`STALE_AFTER_DAYS = 7`, because a score describes a page as it was when it was
read, and a shop that edited a page last Tuesday should not be told its old score
still applies. Nothing breaks at eight days; the sentence simply starts offering
the remedy.

## Proved

**11 tests**, proved red on two different wrong rules:

```
report the NEWEST instead of the oldest, and treat an unreadable stamp as now
  →  6 of 11 fail
```

Both breaks are the plausible mistakes. Reporting the newest looks like the
friendly choice and is the one that hides the problem; `?? Date.now()` on a bad
stamp looks like a safe default and asserts freshness nobody measured.

`now` is a parameter rather than a call to the clock, so the tests stand at a
fixed date instead of being true only this week.

**Checks:** typecheck 0 on both workbenches. Tests: piggles workbench 152 files
/ 1452, sparx 117 / 1114. All ten guards OK. ESLint and prettier clean.
`score-age.ts` is byte-identical in both consoles.

## Files

- `{piggles,sparx}/apps/workbench/surfaces/seo/score-age.ts` (new)
- `piggles/apps/workbench/surfaces/seo/score-age.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/seo/audits-list.tsx`

## The thing to remember

**A shared component answers the question it was built for, and a snapshot
changes the question.** `RefreshButton` is right on fifteen lists and wrong on
this one, and nothing about the call site looked wrong: the prop was the right
name, the right type, and the documented value. The tell is upstream of the
component, in what the endpoint returns: **a read that serves stored rows cannot
report its own age from the clock.**

Same shape as issue 463, where a nightly cache's refresh marker showed the fetch
time and read "updated just now" over breakfast figures, with `computed_at`
written since it shipped and drawn by nobody. Twice now, in two surfaces, from
the same cause.

## Also checked on this surface, and correctly not filed

- **Site scoping.** `/v1/seo/audits` resolves `x-sparx-property-id` through
  `resolveListScope` and filters with `auditsOnSiteSql`, which reaches through
  the junction tables the three non-builder entity types use. Its comment names
  issue **391**: "an unscoped read put another site's pages into her score."
  Already fixed. Worth noting that 74 of her 148 audits carry a NULL
  `property_id` and the scoping still works, because the predicate goes through
  the junctions rather than that column.
- **`content_entries.archived_at`.** Written once, as `null`, at creation;
  serialized on every read; declared in both consoles' `ContentEntry` and drawn
  nowhere. 11 entries platform-wide carry `status = 'archived'` and **0** have
  the timestamp, because nothing can write it. Not filed: all 11 belong to the
  operator's own tenant, Devi has none, and building a writer for a reader that
  does not exist is the wrong half to build first. Recorded here so the next
  person reaching for "archived on" knows the column is structurally empty.
- **Location timezones.** 17 of 19 are NULL, which looked alarming and is
  correct: the schema comment says NULL means "follow the business's zone", and
  `findBookingPlaceTx` resolves place → business → UTC before anything reads it.
  Issues **108** and **178** settled this, and a `@default("UTC")` is exactly
  what they removed, because it "cannot say nobody chose".
- **Bookings first run.** Devi has 2 staff resources, 1 location and **0
  services**, so nothing can be booked. The create pane already detects it and
  says "Set up something to book first: a booking is a time against one of your
  services", with the action beside it. Correct as built.
