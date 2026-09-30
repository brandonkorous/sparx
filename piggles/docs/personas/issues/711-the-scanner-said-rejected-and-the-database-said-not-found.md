# 711 — The scanner said rejected and the database said not found

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 250
**Surface:** mypiggles + sparx — Stock › picking and packing, every scan
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen: an unknown barcode comes back amber, and the row it wrote says `not_found`
**Blocked on:** —

## What happened

Found while chasing British spellings out of the server. This line, twice:

```ts
outcome: recorded.message?.includes('catalogue') ? 'not_found' : 'rejected',
```

The message it is looking for is built four hundred lines away:

```ts
const message = `Nothing in the catalog matches ${resolution.scanned}.`;
```

**"catalog" does not contain "catalogue".** The test was never true, in either
function, for any scan, ever.

## Why it matters

`scanToPick` and `scanToPack` decide the outcome INSIDE the transaction and write
it to `inventory_scan_events`, correctly. Then they threw it away and rebuilt it
outside by reading the sentence they had just written.

So the row saved a millisecond earlier says `not_found` and the answer handed
back to the scanner says `rejected`. **The database and the answer disagree about
the same event.**

It reaches the floor as **color**:

| outcome     | `scanTone` | what it means to a picker        |
| ----------- | ---------- | -------------------------------- |
| `not_found` | warning    | we have never heard of this code |
| `rejected`  | danger     | you are holding the wrong thing  |

An unregistered barcode lit up **red**, in the same red as "you are at the wrong
shelf" and "that item is not on this order". One says the code is unknown to us;
the others say the person is wrong. Two causes, one signal, different remedies.
[[feedback_one_outcome_two_causes]]

Nothing went red when the spelling was Americanized, because the string was copy
to every check in the repo and an identity to exactly one line of code.
[[feedback_copy_edit_breaks_identity_lookups]]

## What was done

The transaction already knew the answer. It now carries it out, on all eight
branches — four in each function: the barcode is unknown, the item is not wanted
here, the shelf or the box is wrong, and it worked.

```ts
outcome: recorded.outcome,
```

**The rule, written down:** a decision must never be keyed on a sentence we wrote
ourselves. Our own copy is edited, translated and shortened as a matter of
routine, and every one of those is a silent break. Matching somebody ELSE's fixed
string is different and stays allowed — `events/consumer.ts` matches a NATS error
and `scheduling/errors.ts` matches a Postgres constraint name. Neither is ours to
reword.

A source-reading test now holds it: no outcome may come from
`message.includes/startsWith/match`, and every `recordScan` outcome must appear
again in the return beside it, in the same order.

## Files

- `wizeworks/packages/inventory/src/services/pick-scan.ts`
- `wizeworks/packages/inventory/src/services/scan-outcome-carried.test.ts` — new

## Proof

Put the old line back in one of the two functions: **2 of 4 tests fail**, naming
it. Restored: 4 pass.

**On the screen, 2026-09-19.** Scanning `999000111222` into **Scan a delivery**
on PO-000004 comes back amber: _"Nothing in the catalog matches
999000111222."_ The row it wrote, read straight out of the database a second
later:

| value        | outcome     | message                                      |
| ------------ | ----------- | -------------------------------------------- |
| 999000111222 | `not_found` | Nothing in the catalog matches 999000111222. |

Amber on the screen, `not_found` in the table. They agree. Before this they did
not, and the picker saw the same red as "you are at the wrong shelf".
