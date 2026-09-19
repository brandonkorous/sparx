# 605 — It told me nothing changed after it had already changed things

**Status:** fixed
**Severity:** critical
**Found by:** P03 · Juniper Row · act 205
**Surface:** mypiggles › Sell › Special prices
**Filed:** 2026-09-16
**Fixed:** 2026-09-16
**Confirmed by:** P03 · Juniper Row · act 205 (created and saved a real list on screen)

## What happened

I supply a few shops, so I went to make a wholesale sheet. **Special prices ›
Add a price list**, named it **Trade sheet 2026**, left the optional note empty
(which now works — [602](602-i-could-not-make-a-product-group-without-writing-an-optional-note.md)),
created it. Added the Astrid Signet Ring in rose gold, changed its price from
$1,450.00 to $1,100.00, pressed **Save**.

It spun for about ten seconds and then:

> **Could not save this price list**
> Nothing was changed.

and a toast: "Something went wrong on our end, so that didn't save. Nothing you
typed was lost. Try again in a moment."

I pressed Save again and it worked. The price list is right.

## What I went looking for, and what I actually found

The failure itself was a **500 on `PATCH /v1/commerce/price-lists/{id}`**, and I
could not make it happen again: three more of exactly the same request came back
200 in 14, 16 and 29 milliseconds. The failed one hung for about ten seconds
first, which points at the connection pool rather than at the code — a failure
mode this repo already knows well (`db/src/client.ts` documents 154 pool
timeouts in 45 minutes on a starved pool). **Not filed as a defect, because I
have not proved one.** The evidence is here so the next person who sees it has a
second data point.

What it exposed is a defect, and a serious one.

## The real problem: Save is three requests and the message speaks for one

Saving an existing price list does this:

```
1. PATCH the list          name, currency, who gets it, dates, which sites
2. DELETE each removed price          one request each
3. POST the remaining prices          one bulk request
```

Three separate requests to a server that **commits each one**. There is no
transaction across them. All three sit inside one `try`, and the `catch` says:

```ts
setFailure(priceListErrorMessage(error, 'Could not save this price list. Nothing was changed.'));
```

That sentence is true of step 1 and false of the other two.

I hit it at step 1, so I was told the truth by luck. Somebody who hits it at
step 3 is told "nothing was changed" **after their settings have been written
and the prices they deleted are already gone.** That is the worst possible
moment for that sentence: it tells her the deletions did not happen, so she does
not go back and check, and the prices stay deleted.

## The second one, on the same screen, and worse

Creating a list has the same three-request shape. Its entries write was:

```ts
async function bulkSetEntriesFor(listId, entries) {
  await api
    .post(`/v1/commerce/price-lists/${listId}/entries/bulk`, { entries })
    .catch(() => undefined);
}
```

with a comment calling the failure "soft" because "the list was created, so the
pane still lands on it and the prices can be re-saved there."

Half of that is right: the list does exist and throwing would leave me on a
create form that would make a second one. The other half is the bug. **Nobody is
told.** The caller ran it as `void …finally(land)`, so on failure the pane lands
on the new list and announces:

> Trade sheet 2026 created

A price list created with none of the prices I typed, reported as a success,
with the prices gone and no message anywhere on the screen. I would find out
weeks later, when a shop I supply paid full price.

## Where it lives

`workbench/surfaces/commerce/price-list-detail.tsx`, in both consoles.

**Fixed, three things:**

1. **The save knows how far it got.** A `SavePoint` moves from `settings` to
   `removals` to `prices` as each request commits, and the sentence is chosen
   from it. "Nothing was changed" is now said only where nothing was.

2. **The create path stops swallowing.** `bulkSetEntriesFor` returns whether it
   wrote instead of turning a rejection into silence. The pane still lands (that
   part was right), but the toast says which of the two things happened:

   > Trade sheet 2026 was created, but its 3 prices could not be saved. Add them
   > again on the list.

3. **A partial save refreshes what the pane believes.** The next attempt computes
   its deletions from `saved`, so without this, saving again re-deletes prices
   that are already gone and fails on the 404 — a second failure caused by the
   first. `touched` stays true, so nothing typed is replaced by the refetch.

The new sentences:

| where it failed | what it now says                                                                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| the settings    | Could not save this price list. Nothing was changed.                                                                                               |
| a removal       | The list itself was saved, but its prices were not. The 4 prices you took off the list have already gone. Check the prices below, then save again. |
| the prices      | The list itself was saved, but its prices were not. Nothing you typed has been lost: save again.                                                   |

"Nothing you typed has been lost" appears only on the last one, because it is
only true there — after a removal fails, the list is half-cleared and she needs
to look before she saves over it.

## Guard

`workbench/surfaces/commerce/price-list-save-words.test.ts`, 9 tests in each
console. One of them is the rule rather than a string:

```ts
it('never says nothing changed once the settings have committed', ...)
```

Proven red by putting the old sentence back — one line returning
"Nothing was changed" for every point — which fails **4 of 9**, including that
one.

## What I did NOT delete

**Trade sheet 2026** is a real list on Juniper Row, with a real trade price on
the Astrid Signet Ring and a note. It is still a draft, so it charges nobody.
Kept deliberately: it is the evidence that the create path, the empty-note
create, the price picker, the bulk write and the second save all work.

## Still open

The 500 above. One sighting, ten seconds, not reproducible in four more
attempts. If it recurs, the thing to look at first is the pool, not
`updatePriceList` — the transaction it opens does five small statements and
finishes in 14ms when the pool is free.
