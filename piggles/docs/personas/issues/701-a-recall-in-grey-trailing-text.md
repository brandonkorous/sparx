# 701 — A recall, in grey trailing text, on a line that truncates

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 245
**Surface:** mypiggles + sparx — Stock › Expiring stock
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen — before and after
**Blocked on:** —

## What happened

Devi's one dated batch read:

> **Brass belt hardware, antique**
> `FT-8871-B`
> Main Warehouse · recall cl…

`recall cl…` is a recall status, cut off by `truncate`, in the same grey and the
same size as the warehouse name beside it.

```tsx
<span className="truncate text-sm">
  {lot.warehouseName ?? 'Unknown location'}
  {lot.recallStatus ? ` · recall ${lot.recallStatus}` : ''}
</span>
```

## Why it matters

There are two values, and they mean opposite things:

| stored    | means                                                      |
| --------- | ---------------------------------------------------------- |
| `cleared` | the recall was lifted; this batch is fine                  |
| `active`  | **this batch is recalled and must not leave the building** |

Rendered identically. Same weight, same color, same truncating line, differing by
one lowercase word that the truncation is eating. The most serious state a batch
can be in was styled as a footnote on a location.

```
batches with an ACTIVE recall     2
units in them                    68
```

And one cell to the right, the expiry date is already a properly toned
`<Badge color={bucketTone(lot.bucket)}>`. **The file knew the pattern.** The
recall just never got it. [[feedback_status_badges_semantic_color]]
[[feedback_a_fix_leaves_its_neighbour_behind]]

It also printed the column value rather than the meaning: "recall active" is
enum-speak, and this console is written for people who have never seen a database
([[feedback_non_technical_audience]]).

## What was changed

The status is its own badge, outside the truncating span, and says what it means:

- `active` → **Recalled**, `danger`
- `cleared` → **Recall lifted**, `success`
- absent → nothing at all, rather than an empty clause

The warehouse name truncates a little harder to make room, which is the right way
round: a location is recoverable by opening the row, and a recall is not
something to make somebody go looking for. That is issue
[687](687-a-shelf-label-that-says-not-for-sa.md)'s rule — the meaning-carrying
part of a line is the part that must not be cut.

## Confirmed

> Brass belt hardware, antique
> `FT-8871-B`
> Main Wareh… **Recall lifted**

Green badge, unclipped, and a recalled batch now reads **Recalled** in red.
