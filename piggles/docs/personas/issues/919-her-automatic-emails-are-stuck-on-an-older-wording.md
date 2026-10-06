# 919 — Her automatic emails are stuck on an older wording

**Status:** open
**Severity:** major (every business's automatic emails, and every fix made to them since September 16)
**Found by:** P03 · Juniper Row · act 324, while confirming [129](129-the-email-editor-draws-her-button-black-and-the-preview-draws-it-brown.md)
**Surface:** mypiggles › My Site › Email designs, and every automatic email sent
**Filed:** 2026-10-06
**Fixed:** —
**Confirmed by:** —
**Blocked on:** the file that holds the fix has another session's change in progress (see below)

## What happened

Devi's Booking reminder, which she has never edited, opens with:

> Hi Alex — a friendly reminder about your upcoming booking:

The shipped default no longer says that. It reads "Hi {{customer.greeting}}: a
friendly reminder about your upcoming booking:" and has since the em-dash sweep
of 2026-09-16 (`851aa54d6`). Her customers are still being sent the old one.

## Why

A business's automatic emails are copied into its account when it starts. When
a default's wording changes, `refreshRedesignedDefaults` brings an untouched
copy forward, and it decides "untouched" by fingerprint: a stored body is
replaced only when it matches one of the earlier shipped versions listed in
`PRIOR_DEFAULT_BODY_FINGERPRINTS` (`builder/src/services/email-default-refresh.ts`).
The file says to add the outgoing version's fingerprint every time a default
changes. The September 16 sweep changed almost every default and added none, so
every copy made before it matches nothing on the list and is never refreshed.

## How wide

Measured read-only against the dev database: tenant-wide default emails whose
draft and published bodies agree, are not the current default, and are not on
the list.

- **870 rows across 44 kinds.** For most kinds it is **25 of 26** businesses:
  everyone except the one made after the sweep.
- Nearly all of them still contain an em dash.
- Some will be an owner's own edits, which the refresh is right to leave
  alone. 25 of 26 per kind is not that.

Every later fix to a default email is stranded the same way, for the same
businesses. Issue 064's receipt and "delivered" fixes are the ones another
session is now carrying across by hand, by computing each past version's
fingerprint from the code at each commit.

## The fix

Two parts:

1. **Now:** add every past shipped body's fingerprint for each of the 44 kinds,
   computed from the code at each commit that changed it, as the other session
   is doing for the receipt and "delivered" emails. Then the 6-hourly reconcile
   brings every untouched copy forward.
2. **So it cannot happen again:** a test that builds every default as of the
   previous commit that changed `default-emails-silica.ts` (or its kit) and
   fails when its fingerprint is neither the current one nor on the list. Or
   store, on each row, the fingerprint of the body it was given, so
   "untouched" stops depending on a hand-kept list at all.

Not made here: `email-default-refresh.ts` and `default-emails-silica.ts` both
hold another session's change in progress (issue 064), and two people
appending to the same list at once is how one of them loses a set.

## Rating effect

Not scored. Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
