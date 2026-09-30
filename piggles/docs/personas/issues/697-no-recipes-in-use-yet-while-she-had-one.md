# 697 — "No recipes in use yet", while she had one in use

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 243, on the first load after a dev restart
**Surface:** mypiggles + sparx — Making things › Plan a run
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen — the claim appeared while the recipe was `active` in the database
**Blocked on:** —

## What happened

Devi opened **Plan a run**. The form told her:

> **No recipes in use yet**
> A run is built to a recipe. Write one and mark it as in use, then come back: a
> draft cannot be built from, so that everyone builds to the same one.
>
> [ 🍲 Write a recipe ]

She had marked **The Ash Overshirt recipe** as in use twenty minutes earlier.

```sql
SELECT name, status FROM inventory_bills_of_materials WHERE tenant_id = '2e78…';
 The Ash Overshirt recipe | active
```

## Why

```ts
const bomOptions = useMemo(() => (boms.data?.items ?? []).map(…), [boms.data]);
…
{bomOptions.length === 0 ? <Alert><AlertTitle>No recipes in use yet</AlertTitle>… : null}
```

`boms.data` is `undefined` in **two** states that are not "none": the query is
still in flight, and the query failed. `?? []` folds both into an empty list, and
the empty list drives a sentence written as a fact about her business.

[[feedback_never_present_absence_as_measurement]]: a value nobody measured must
never render as one. The usual version of this is a number; this is the same
error in prose, which is worse, because a sentence cannot be squinted at. It also
carried a button, so the screen's advice was to do again the thing she had
already done.

## What it looked like from her side

A cold load after a restart is exactly when a business owner is most likely to
believe it: she has just come back to the tab, the screen is telling her
something definite about her own data, and the remedy is right there. The most
likely outcome is a second recipe for the same garment, which is the one thing
recipes exist to prevent — "so that everyone builds to the same one", as the same
alert says two lines down.

## What was changed

Three states, not two:

```tsx
{
  boms.isError ? <Alert color="warning">Could not load your recipes…</Alert> : null;
}
{
  askedAndEmpty ? <Alert color="info">No recipes in use yet…</Alert> : null;
}
```

```ts
/** The query has ANSWERED, and the answer was none. Not the same as not having
 *  asked yet, which is what an empty list also looks like. */
const askedAndEmpty = boms.data !== undefined && bomOptions.length === 0;
```

The picker's placeholder got the same treatment: **Looking…** while in flight,
**No recipes in use** only once that is true.

## The sweep

A probe over 1,189 panes in both consoles looked for a list derived with
`?? []` from a query whose `.length === 0` then drives an `Alert` or
`EmptyState` title, with no `isPending` / `isError` / `data !== undefined` guard
anywhere above it. Two hits, and **both were false positives**: `seo/audits-list`
renders that block only inside `audits.isError ? … : audits.isPending ? … :` and
already writes `!audits.isPending && rows.length === 0` for its other claim.

So the console's convention is right and this pane was the outlier — no
mechanical check added, because the correct pattern has several legitimate
spellings and a guard that cannot tell them apart is one that gets switched off
([685](685-the-plural-helper-stopped-at-the-noun.md)).
