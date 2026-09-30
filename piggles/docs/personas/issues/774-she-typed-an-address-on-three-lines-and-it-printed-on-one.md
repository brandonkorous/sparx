# 774 — She typed an address on three lines and it printed on one

**Status:** fixed
**Severity:** medium
**Found by:** P03 · Juniper Row · act 274
**Surface:** the printed billing document — preview, PDF and the copy the customer gets
**Filed:** 2026-09-22
**Blocked on:** —

## What happened

Having sent INV-000018 to Tamsin, the next thing to look at is what Tamsin
actually got. **Preview** opens the real artifact, and the bill-to block read:

```
Tamsin Vale
2140 NE Alberta St Portland, OR 97211 US
tamsin@loomandlarder.com
```

Directly above it, the seller's own address was on three lines:

```
1184 SE Ash St
Portland, OR 97214
US
```

Two addresses, one document, formatted differently.

Devi typed hers on three lines. The box she typed it into is a textarea whose
placeholder is itself two lines: `Street` / `City, State ZIP`. The screen asked
for line breaks and the document removed them.

## Why

`partyFromJson` builds the block. The seller address arrives as an ARRAY and is
rendered one `<div>` per entry. The customer address arrives as ONE STRING
holding the newlines, and was pushed as a single line. HTML turns a newline
inside one element into a space, so the whole address ran together.

Measured across the 106 billing documents on the account:

```
bill_to.address  24 hold one, 11 of them multi-line
ship_to.address  13 hold one, 10 of them multi-line
                 21 of 37 printed as a run
```

## Two more in the same function

Looking at the other shapes the same function accepts turned up two more, both
on the customer's copy:

**`recipientName` was read by nothing.** A ship-to captured at checkout names
the person under that key; the function reads `name` / `company` /
`companyName` and stops. INV-000001's ship-to holds "Marguerite Adeyemi" and
printed a delivery address with nobody's name on it.
[[feedback_fetched_but_never_rendered]]

**The town line put a comma before the postal code.** `[city, state, zip]`
joined with `", "` gives `Portland, OR, 97214`, which is not how an address is
written in any country. Two documents print their address block that way.

## What was done

All three at the one point every render path shares
(`billing-render-parts.ts`), so the preview, the PDF and the emailed copy
change together:

- a value holding newlines becomes one printed line per line typed, blanks
  dropped, `\r\n` included, and the same rule applies to a pre-split entry that
  itself holds a break
- `recipientName` joins the name chain, after the explicitly printed name
- the town line is `city, state` then a SPACE then the code

## Proof

Before, on INV-000018:

```
2140 NE Alberta St Portland, OR 97211 US
```

After, unchanged otherwise:

```
2140 NE Alberta St
Portland, OR 97211
US
```

`billing-render-parts.test.ts` is new: 13 assertions, and **4 of the first 6 were
watched going red** with the split removed, 1 with `recipientName` dropped, and
5 with the comma join restored. [[feedback_a_test_that_cannot_go_red]]

## Files

- `wizeworks/packages/crm/src/services/billing-render-parts.ts`
- `wizeworks/packages/crm/test/unit/billing-render-parts.test.ts` (new)

## Gap to 10

The 21 documents already printed with a run-on address print correctly from now
on, because the block is built at render time and nothing was frozen wrong. No
backfill is needed or possible.
