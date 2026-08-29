# 309 — She re-imported her list and it put someone who unsubscribed back on it

**Status:** fixed, confirmed
**Severity:** major (a re-import silently un-unsubscribes people, and the screen
that promises to show "exactly what would happen" cannot tell 25 new customers
from 25 overwritten ones)
**Found by:** P03 · Juniper Row · wrong moves — importing the same file twice
**Surface:** the console — Move in from somewhere else › Bring in a file
**Filed:** 2026-08-28
**Fixed:** 2026-08-28

## What happened

Devi imported her 25-row mailing list in August. Since then Tomas Beaulieu rang
to give her a new number and to ask to come off the newsletter, and she changed
both on his record.

Weeks later she is tidying up, finds the same CSV on her desktop, and brings it
in again — the ordinary wrong move of someone who cannot remember whether she
already did it.

Every screen in the flow told her this was an import of 25 customers:

    Bring in 25
    25 customers ready to import.
    Try a practice run first — it checks every row against what you already
    have and shows you exactly what would happen, without saving anything.

The practice run, which is the screen built for this exact question, answered:

    Practice run finished — nothing was saved
    Customers
    25
    of 25 would come over

So she ran it. The finished screen said:

    Your business is here
    Everything below is now in your account.
    Customers
    25
    of 25 brought over

None of it is true in the way she will read it. Nobody came over. The customer
count before and after is **32 and 32**. All 25 rows were overwrites, and one
of them undid a decision that was not hers to undo:

| Tomas Beaulieu        | Before the re-import | After          |
| --------------------- | -------------------- | -------------- |
| Phone                 | (206) 555-0244       | (206) 555-0198 |
| Do not send marketing | **on**               | **off**        |

He asked to be taken off the list. He is back on it, and nothing anywhere said
so.

## Why

Two separate faults that land on the same screen.

**1. The import can turn a suppression off.** The row processor writes the
opt-in column straight onto an existing customer
([customers.ts](../../../../wizeworks/services/import-worker/src/processors/customers.ts)):

```ts
...(row.accepts_marketing !== undefined
  ? { doNotContact: doNotContactFrom(row.accepts_marketing) }
  : {}),
// Only ever ADDED on an update. A file saying no already lands as
// do-not-contact ...
...(consent === null ? {} : { gdprConsent: consent }),
```

The comment on the line below is the right thinking applied to the wrong field.
`gdprConsent` — the RECORD of a permission, the audit trail — is protected and
only ever added to. `doNotContact` — the switch that actually stops the send —
is written from the file in both directions. So the evidence of consent is
carefully preserved while the thing that enforces it is overwritten by a
months-old spreadsheet.

The same file already argues the case against itself, about the first import:

> the failure modes are not symmetric: a contact wrongly marked no can be asked
> again, and a contact wrongly marked yes is an unlawful send the tenant finds
> out about from a complaint

On a re-import the asymmetry is sharper still. A "yes" in an old export is not a
statement that they want the newsletter — it is the file being **silent about
everything that happened after it was saved**, including the unsubscribe.

**2. The screen adds `new` and `updated` together and shows the total.** The
number on the card is `entity.imported + entity.updated`
([migration-progress.tsx](../../../apps/workbench/surfaces/migration/migration-progress.tsx)),
and both halves are already on the wire separately. So:

| Run                      | imported | updated | The card says |
| ------------------------ | -------- | ------- | ------------- |
| first import, 2026-08-26 | 9        | 16      | 25 of 25      |
| this one, nobody new     | 0        | 25      | 25 of 25      |

Two runs that do completely different things to her business are reported with
the same sentence. The one number the card shows is the one number that cannot
distinguish them.

The only per-row hint that these people already existed makes it worse:

    Note  tomas.beaulieu@example.com — They already had an address on file,
          so this one was left off.

That is about the address, which was the one field left alone. Read down a list
of twenty-five of them and it says her existing records were respected — at the
moment his phone number and his unsubscribe were being replaced.

## The fix

**1. Suppression is one-way on an update.** `optInForExisting` in
[customers.ts](../../../../wizeworks/services/import-worker/src/processors/customers.ts)
replaces the two-way write: a file saying "do not email" still lands, a file
saying "email them" can now only apply to somebody the file is CREATING. The
`gdprConsent` line below it already worked this way; the switch that enforces it
now does too.

**2. It says so instead of overriding her file in silence.** A row whose opt-in
was left off carries a note into the run report, so the person it happened to is
named rather than counted.

**3. New and already-here are counted separately, everywhere a run is
reported** — the practice run, the finished run and the past-moves list, which
share one module ([run-outcome.ts](../../../apps/workbench/surfaces/migration/run-outcome.ts))
so they cannot describe the same run differently. Both numbers were already on
the wire; only the screens were adding them up.

**4. When nothing in the file is new, that is the headline**, and it is amber
rather than green. Nothing failed, but a bulk overwrite of records she already
has is not what she pressed the button for, and on a practice run it is the
moment to stop.

**5. The past-moves rows were being drawn shorter than their own content.**
Found by putting a third line in them: the list is a flex column that scrolls,
the rows had no `shrink-0`, so every card was squashed to share the visible
height — 65px drawn over 108px of content. The bottom line of every row was cut
in half before this issue existed, including the "1 brought across" of a run
that had nothing new to say.

## Confirmed as Devi, 2026-08-28

Put Tomas back the way he was — new number, taken off marketing — and brought
the same file in again.

**The practice run now stops her:**

    Nobody in this file is new                                    [amber]
    All 25 are people you already have. Doing this for real replaces their
    name, phone, tags and address with whatever this file says — including
    anything you have changed here since the file was made. Anyone who has
    been taken off marketing stays off it.

    Customers
    25
    of 25 would come over
    none of them new — every one is somebody you already have

    Worth knowing
    Note  tomas.beaulieu@example.com — This file has them down as happy to be
          emailed, but they have been taken off marketing here since it was
          made. They stay off it.
          Row 3 of your customers file

**And the real run keeps its word:**

| Tomas Beaulieu        | Before | After the re-import |
| --------------------- | ------ | ------------------- |
| Do not send marketing | on     | **on**              |

His phone still reverts to the file's number, and that is correct — it is a
detail she can see and change back. The one thing that could not be undone by
noticing it is the one thing the file can no longer touch.

The past-moves list makes the whole history of this file legible at last:

    Aug 25,  7:13 PM  practice  25 would come across
    Aug 25,  7:56 PM  practice  25 would come across   24 new · 1 already here
    Aug 25,  8:10 PM            25 brought across       9 new · 16 already here
    Aug 25, 11:24 PM            25 brought across       none of them new
    Aug 28,  5:29 AM            25 brought across       none of them new

Five runs of one file that used to read identically.

Checked in dark and at 360px, and in light: the amber banner, the breakdown line
and the notes all wrap and stay readable.

## Not checked

- **The `upsert: false` path.** No screen sets it — only the API can — and
  nothing counts a skip, so 25 skipped rows reported as 0 with no reason given.
  Rows now carry a note saying why, which is visible without a new column, but
  the count is still absent.
- **Whether other kinds of record overwrite the same way.** Products, companies
  and the rest run through their own processors; only customers was driven.
