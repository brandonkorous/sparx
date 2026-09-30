# 870 — The list could not tell a shared page from her own

**Status:** fixed
**Severity:** **moderate** — issue 867 gave the content editor a control for
which of her websites show a page. The list she opens that editor FROM still
drew nothing, so a page every one of her businesses publishes looked exactly
like one belonging to the site she was standing on. She sees the list first, and
she decides what to open from it
**Found by:** P03 · act 308, finishing what 867 deferred
**Surface:** mypiggles › Content, in both consoles
**Filed:** 2026-09-29
**Fixed:** 2026-09-29
**Confirmed by:** 11 unit tests + 1 integration test against the live database,
both proved red

## This is my own deferral, and the reason I gave was wrong

867 closed with this:

> **A content list column showing which sites a page is on** would need
> `propertyIds` added to the list serializer, a join on a 250-row query. The
> editor is where she acts and where the harm was, so the column is deferred
> rather than bundled.

Measured properly:

```
content_entry_properties          154 rows, platform-wide, in total
  most any single entry carries      2
  Devi's own                        32
content_entries                   702
```

**The whole junction table is smaller than one page of results.** The cost I
cited to defer the work does not exist. Prisma fetches the relation as one extra
batched query returning at most a few hundred two-column rows.

[[feedback_verify_cost_decisions]] cuts both ways: a cost claimed without
measuring is as wrong as a cost ignored. And "the editor is where she acts" was
the weaker half of the argument — she acts in the editor, but she **chooses** in
the list.

## What she saw

From 867's own findings, unchanged until now:

> On the Journal, Content showed nine rows: the Journal's three, plus the six
> that are on every site. On the Press site, eight rows: its five, plus the same
> six. Nothing distinguished the shared six from the pinned ones, on either
> screen.

So the editor now opens with **Which of your sites show this** already filled in
correctly, and she had no way to know she needed to look.

## What it does now

```
Title                    Kind    Sites                         Author   Changed   Status
Autumn cloth notes       Post    Juniper Row Journal           Devi     12 Sep    Published
Care and repair          Page    [ All sites ]                 Devi      9 Sep    Published
Press pack 2026          Page    Press and Lookbook            Devi      4 Sep    Draft
```

- **The empty list means every site**, so that is the one case wearing a badge.
  It is not a warning, nothing is wrong, and it is not the common case either.
  It is the fact that changes what an edit MEANS: touch that row and all seven of
  her businesses publish the change.
- One or two sites are **named**, because a name beats a count wherever it fits,
  and two is the most any entry on the platform carries.
- Three or more become "3 sites" — the names stop fitting a table cell.
- A page pinned to a site that has since been removed is **counted, not
  dropped**: it is still pinned to something, and naming only the survivors
  would under-report the scope.

The column is **hidden entirely for a business with one website.** There is no
choice to show, and a column headed "Sites" would invent one. Same rule the
shared site-scope field follows on all ten editors that now have it.

## Three cases, and the bug that makes them two

```ts
propertyIds === undefined   the scope never arrived
propertyIds.length === 0    EVERY site
propertyIds.length > 0      pinned to those
```

The tempting line is `propertyIds ?? []`. It compiles, it reads as a safe
default, and it turns every row of a stale cache into a confident **All sites**
claim about pages that are pinned. So `siteScopeCell` returns `null` for the
third case and the cell draws nothing.
[[feedback_never_present_absence_as_measurement]]

The console type's comment now says this where the type is declared, because the
next person to reach for `?? []` will be reading that line, not this file.

## Proved

**11 unit tests**, proved red by installing exactly that bug plus one more:

```
propertyIds ?? []  and  drop unknown site ids instead of counting  →  2 of 11 fail
```

**1 integration test** against the live database, proved red by taking the echo
back off the list route:

```
the list stops echoing the scope  →  1 of 12 fail
```

It asserts both shapes on the same row: pinned to the primary site reads
`[thatId]`, and after a PATCH to `[]` the same row reads `[]`. A test that only
checked the pinned case would pass with the key missing entirely, since a missing
key and an empty list both fail to equal `[thatId]` in only one of the two
directions.

**Checks:** typecheck 0 on api-rest and both workbenches. Tests: piggles
workbench 150 files / 1429, sparx 117 / 1114, api-rest 33 / 269 plus entries
lifecycle 12 / 12 against the real DB. All ten guards OK. ESLint and prettier
clean.

## Files

- `wizeworks/services/api-rest/src/routes/v1/content/entries.ts` (the list carries the scope)
- `wizeworks/services/api-rest/test/integration/entries-lifecycle.test.ts`
- `{piggles,sparx}/apps/workbench/surfaces/cms/content-sites.ts` (new)
- `piggles/apps/workbench/surfaces/cms/content-sites.test.ts` (new)
- `{piggles,sparx}/apps/workbench/surfaces/cms/content-list.tsx` (the column)
- `{piggles,sparx}/apps/workbench/surfaces/cms/data.ts` (the comment was stale)

## The thing to remember

**A deferral is a claim, and it needs measuring like any other.** "A join on a
250-row query" sounded like a cost and was never a number. The junction table
has 154 rows in it. Two acts of a feature shipped without the third because of a
sentence I wrote and did not check.

And the shape: **a control on the detail screen finishes nothing if the list that
leads to it is silent.** 867 gave her the ability to fix the scope. It did not
give her any reason to go and look.
[[feedback_finish_whole_surface_not_the_hard_part]]
