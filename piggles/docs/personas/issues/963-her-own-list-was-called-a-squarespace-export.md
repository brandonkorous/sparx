# 963 — Her own list was called a Squarespace export

**Status:** fixed (act 10)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 10
**Surface:** mypiggles › Move in › Somewhere else, or your own spreadsheet (both consoles)
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 10, `marrow-review-subscribers.csv`
**Blocked on:** —

## What happened

Her file: `First name, Last name, Email, Subscribed, Signed up`, 40 readers, one of them
(Hugh Ashdown) `Subscribed: no`. The importer said **"This is a Squarespace contacts
export. We can tell because it has the "Email" column and 1 of 2 columns only
Squarespace writes."** She has never used Squarespace. The column it meant was
`Subscribed`.

When it then asked instead of telling, its column guess matched 3 of 5 and left
**Subscribed** as "Leave this column out". Imported like that, Hugh would have come in
as a reader to email.

## Why

- `packages/migration/src/detect.ts` let any hint column prove a platform. `Subscribed`
  is a word anybody types into a header row.
- The column guesser had no other spellings for "Email opt-in".

## The fix

- `detect.ts`: `EVERYDAY_HEADERS` (Subscribed, Status, Title, Quantity, Published,
  Company, Created and others). Such a column still counts toward the score, but never
  as proof of where a file came from, and is never named as "a column only X writes".
- Column guesser (`column-guess.ts` piggles, `column-mapper.tsx` sparx): "Email opt-in"
  also answers to Subscribed, Subscriber, Email subscriber, Accepts marketing, Opted in,
  Opt in, Newsletter, Mailing list.
- `migration-file-report.tsx`: the note said "every one of them comes across", which is
  not so for a column with nowhere to go (her "Signed up" dates; the importer does not
  keep a "customer since" date, on purpose). It now says "each one you match comes
  across".

## Proof

- `detect.test.ts`: her list is a question, never an answer; without the change it
  reddens. The Squarespace sample now carries `Email Subscriber`, the column the adapter
  itself lists as Squarespace's. Migration package 201 pass.
- `column-guess.test.ts`: "Subscribed" maps to the opt-in; without the alias it reddens.
- On screen: "Is this a Squarespace contacts export? … we would only be guessing", 4 of
  5 matched, Subscribed as Email opt-in. Imported: 40 readers, Hugh `do not contact`.
