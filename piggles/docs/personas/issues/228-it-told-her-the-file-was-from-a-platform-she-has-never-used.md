# 228 — It told her the file was from a platform she has never used, and threw away seven of her eleven columns

**Status:** fixed and confirmed
**Severity:** high
**Found by:** P03 · Juniper Row · act 8 — importing her mailing list
**Surface:** mypiggles › Home › Get set up › Move in from somewhere else › Bring in a file
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 8, same file re-dropped — the screen now asks instead of asserting, and all 11 columns come across

## What happened

Devi exported her mailing list as a spreadsheet. Eleven columns:

```
First Name, Last Name, Email, Phone, Address, City, State, Zip, Country, Tags, Accepts Marketing
```

She dropped it in. A green tick came back:

> **This is a Squarespace contacts export**
> We can tell because it has the "Email" column.

Devi has never used Squarespace. Under it, in the same green:

> Customers · 25 of 25 ready
> 25 customers ready to import.

The count is true and the sentence above it is not, and the two together are
worse than either alone — the count is what makes the claim look checked.

## What actually came across

The practice run's own record, read back from `import_jobs.raw_rows`:

```json
{
  "type": "person",
  "email": "marguerite.adeyemi@example.com",
  "last_name": "Adeyemi",
  "first_name": "Marguerite"
}
```

**Four fields of eleven.** Phone, address, city, state, postcode, country, tags
and marketing consent are all gone. Nothing on the screen said so. "25 of 25
ready" was about ROWS; seven of her columns were dropped inside every one of
them.

## What should have happened

Either recognise the file and read all of it, or say we are not sure and let her
say what her columns are. Never name a platform on the strength of a column every
spreadsheet on earth has.

## Why it matters

She imported her customer list to have her customers. Phone numbers and addresses
are how a shop reaches somebody and how a parcel gets posted; they were in the
file she handed over. Finding out later means re-doing the import, and by then
there are twenty-five contacts to reconcile rather than a file to re-drop.

And the wrong name is its own harm. A person who reads "this is a Squarespace
export" about their own spreadsheet either believes the software knows something
they do not, or stops believing anything else it says.

## Where it lives

**`Email` is not a fingerprint, and four adapters claim it.**
[detect.ts](../../../../wizeworks/packages/migration/src/detect.ts) states the rule
at the top of the file:

> Required headers. Every one must be present, and they are chosen to be columns
> that vendor emits and nobody else does. **This is a gate, not a score.**

Four contact sources break it — `squarespace.contacts`, `wix.contacts`,
`godaddy.contacts` (`required: ['Email']`) and `bigcommerce.customers`
(`required: ['Email Address']`). Devi's file cleared all four gates at an
identical **0.6**, and `readSource` takes `candidates[0]`, so the winner was
whichever adapter the registry happened to list first.

**And `confidence` never reached a caller.** The same file says:

> 0–1. Anything below 0.5 is offered as a question, never as an answer.

Nothing offered anything as a question. `FileReport` in
[migration-run.tsx](../../../../piggles/apps/workbench/surfaces/migration/migration-run.tsx)
branched on `detected === null` and put every other result in a `color="success"`
alert as a flat statement. The threshold existed, was computed, and was discarded.

**The consequence is the vendor's column map.** `mapContacts` in
[squarespace.ts](../../../../wizeworks/packages/migration/src/vendors/squarespace.ts)
reads five headers, because that is what a Squarespace contacts export has. It
was handed a file that had eleven.

## The fix

**The score now reflects a miss.** Each of those four sources declares `hints` —
the columns that vendor really does write (`Subscribed`, `Labels`,
`Customer Group`). Devi's file matched none of them, which is the strongest
available evidence that it is not that export. A source whose whole gate is ONE
header and which no hint corroborates is now capped below the certainty line.
No column names were invented: a genuine Squarespace export carries `Subscribed`
and still detects at 0.9.

**A tie between platforms is not an answer either.** `readSource` returns a new
`sure` flag, false when the top candidate is under the line OR when a rival from
a DIFFERENT vendor explains the file exactly as well.

**The surface reads it.** Not sure → it asks, and shows the column mapper:

> **Is this a Squarespace contacts export?**
> It has the "Email" column — and plenty of files do, so we would only be
> guessing. Say what your own columns are below and every one of them comes
> across.

The mapper guesses too, so this is not extra work — it matched **11 of 11** on
her file with nothing left to correct.

**And a guess stays off the record.** The run no longer files `vendor:
squarespace` against a coin toss; "Past moves" is read back months later as a
statement of where a business came from.

## What it looked like once fixed

Same file, same drop, `import_jobs.raw_rows`:

```json
{
  "zip": "97214",
  "city": "Portland",
  "tags": "newsletter, market stall",
  "email": "marguerite.adeyemi@example.com",
  "phone": "(503) 555-0142",
  "country": "US",
  "address1": "1184 SE Ash St",
  "province": "OR",
  "last_name": "Adeyemi",
  "first_name": "Marguerite",
  "accepts_marketing": "yes"
}
```

Eleven of eleven, and `vendor` empty rather than wrong.

## Related

The address columns then had nowhere to land — [230](230-the-mapper-offered-a-home-for-her-addresses-and-nothing-wrote-them.md).
The field names she was asked to confirm were developer words — [229](229-it-asked-a-clothes-shop-to-confirm-province-and-accepts-marketing.md).

## Rating effect

`Home › Move in` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
