# 627 — A failed fetch told me I have no customer groups

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 211
**Surface:** mypiggles › Sell › Special prices; Wholesale invoices; a product's Stock; Moving stock
**Filed:** 2026-09-17
**Fixed:** 2026-09-17

## What happened

Sell › Special prices, opening **Trade sheet 2026**. The pane sat on a spinner
that never resolved. api-rest had restarted underneath it, and both of its reads
came back **503**:

```
GET /v1/commerce/price-lists/a26b15d5-…          503
GET /v1/commerce/price-lists/a26b15d5-…/entries  503
```

The spinner was honest while the requests hung. What it hid was worse: the pane
checks `listQuery.isError` and **never checks `entriesQuery.isError`**. Had the
price list loaded and only the prices failed, the editor would have rendered
with an empty price table, under a list row that says **1 price**.

Reading the same pane further down:

> **You have no customer groups yet.** Create one under Customers, then choose it
> here.

I have **nine**.

```sql
select count(*) from segments where tenant_id = '2e78fb6c-…';  -- 9
```

That sentence is not a report on my screen. It is a claim about my business, and
it prints whenever a fetch does not come back.

## Why it happened

The shape is three states written where there are four:

```tsx
if (listQuery.isError) return <PaneLoadError … />;        // one of them failed
if (listQuery.isPending || entriesQuery.isPending) …      // still coming
return <Editor entries={entriesQuery.data ?? []} />;      // here it is
```

`entriesQuery.isError` falls through the bottom, and `?? []` turns the failed
read into an empty list. Under a chooser, the same `?? []` feeds a
`.length === 0` that prints a sentence about the owner
([[feedback_never_present_absence_as_measurement]],
[[feedback_absent_behaves_like_fine]]).

A scan of both consoles found the shape in **four panes each, eight in total**:

| pane              | waits for                            | never asks |
| :---------------- | :----------------------------------- | :--------- |
| Special prices    | the prices, the groups, the accounts | all three  |
| Wholesale invoice | the trade accounts                   | them       |
| A product's stock | the locations                        | them       |
| Moving stock      | the locations                        | them       |

The last one matters most on its own terms: a transfer IS two locations, and an
unread location list renders as two empty choosers with nothing saying why.

## The fix

**Two fixes, because there are two kinds of query here.**

- **Essential** — the pane cannot draw without it. Those join the existing error
  branch: `entriesQuery` on the price list, `locationsQuery` on the stock pane
  and on Moving stock. Moving stock gets its own sentence, because "could not
  load this transfer" would be wrong about which thing failed.

- **A chooser's options** — the pane draws fine without them, but must not claim
  anything. New `lib/choice-list-note.ts` + `components/choice-list-note.tsx`:

  > Your customer groups could not be loaded just now. That is a problem reaching
  > the server, not something missing from your business. Close this and open it
  > again.

  The caller still supplies the "you genuinely have none" sentence, because only
  the caller knows where the owner would go to make one.

**And a structural check, because the shape will be written again.**
`scripts/check-pane-load.mjs`, wired into `pnpm check:pane-load` and the pre-push
hook:

> In a pane that asks ANY query whether it failed, every query it WAITS for must
> be asked too.

Both halves carry weight. "Asks any query" scopes it to panes that already
decided a failed load is theirs to report. "Waits for" is the pane's own
statement that it cannot draw without that data.

```
check:pane-load — every waited-for query is checked for failure
                  (20 of 1182 surfaces guard a load).
```

The denominator is printed on purpose, so a check that has gone blind is visible
([[feedback_structural_checks_go_blind]]). The scan roots are resolved from the
repo root and asserted to exist.

## Guard

`choice-list-note.test.ts`, **6 tests** per console. Two are rules:

```ts
it('never says she has none', …)
it('still says so even if a stale count is sitting in hand', …)
```

The second is the one a later "optimization" would break: react-query can fail a
refetch with old data still cached, and a count from a read that has since failed
is not evidence of anything.

The structural check was **proven red** by removing one of the four fixes: it
failed, named `locationsQuery` and the exact file, and went green again when the
fix was put back.

## Not a defect

**The 503s themselves.** api-rest was restarting because of an edit made minutes
earlier in this same session. The spinner during a hung request is correct
behavior. What the restart did was walk the pane through a state nobody had
written, which is the only reason this was seen at all.
