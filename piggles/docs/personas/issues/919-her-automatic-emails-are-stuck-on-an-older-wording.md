# 919 — Her automatic emails are stuck on an older wording

**Status:** fixed (act 325)
**Severity:** major (every business's automatic emails, and every fix made to them since September 16)
**Found by:** P03 · Juniper Row · act 324, while confirming [129](129-the-email-editor-draws-her-button-black-and-the-preview-draws-it-brown.md)
**Surface:** mypiggles › My Site › Email designs, and every automatic email sent
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** one real pass of the 6-hourly refresh in dev (765 refreshed); Juniper Row's booking reminder on today's wording; 2 new tests, each proven red
**Blocked on:** —

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

## What changed

The other session's issue 064 work landed in `c5eca5886`, so the file was free.

- **Every past body, from the code.** The bodies are built by three files
  (`default-emails-silica.ts`, `silica-email-kit.ts`, `email-silica.ts`). 18
  commits changed them. Each commit's version was built in a scratch folder and
  every default's fingerprint taken with today's `bodyFingerprint`. 55 shipped
  bodies across 31 kinds were missing from `PRIOR_DEFAULT_BODY_FINGERPRINTS`;
  each one is added with the commits it shipped in.
- **Three bodies the code never held.** The three return emails from issue 448
  (exchanged, denied, replacement shipped) were copied into every dev business on
  2026-09-08 and 09-09 with an em dash after the greeting, a week before the
  sweep removed it in the commit that first held them. The same body sat at 25
  businesses each, which is a machine copy, not an edit. Read from those rows
  and added, as the receipt's never-released body was.
- **A note that was wrong.** `subscription-authentication-required` and
  `subscription-invoice` were listed empty, "only ever had one body". They had
  three. Fixed, and the note now says why the history file exists.
- **So it cannot slip again.** `email-default-history.json` lists every body
  each default has shipped, oldest first, ending on today's. Two new tests in
  `email-default-refresh.test.ts`:
  - the history ends on the body each default ships today. Changing one word of
    the booking reminder turns it red, and the message names the outgoing and
    the new fingerprint to paste.
  - every earlier body in the history is one the refresh recognizes. Against the
    old list it is red on the first missing body.

## Proof

Read-only recount of the dev database, same rule as the refresh:

|        | Rows stuck |
| ------ | ---------- |
| Before | 870        |
| After  | 82         |

The 82 left are rows the refresh is right to leave:

- 21 are the old `appointment-*` emails. No default has those keys any more and
  nothing sends them, so the refresh skips them.
- 58 are bodies converted from the old editor in July at four old test
  businesses (wizeworks, harbor-pine, seedcheck, sunny-grove-1079). The refresh
  is written to leave converted bodies alone.
- 3 are single rows, each different: one-off edits.

The other 788 are picked up by the next reconcile, which runs 6 hours after the
API starts and every 6 hours after. Devi's booking reminder changes then, not
before. Builder: 149 tests, typecheck, ESLint, prettier clean.

## Applied, act 325

With dev stopped, one pass of `reconcileEmailProvisioning`, the function api-rest
runs every 6 hours, was run by hand. Before and after, counted the same way:

| Default emails, live body                          | Before | After     |
| -------------------------------------------------- | ------ | --------- |
| On today's wording                                 | 241    | **1,006** |
| An earlier shipped body, which the refresh updates | 789    | 24        |
| Not recognised (edited, old editor, dead keys)     | 82     | 82        |

The pass reported 25 businesses and 765 refreshed. The 24 left all belong to the
platform's own `wizeworks` account, which has no email app switched on, so the
refresh does not visit it, by design. Juniper Row's booking reminder now opens
"Hi {{customer.greeting}}: a friendly reminder about your upcoming booking",
the current wording, where it said "Hi Alex — a friendly reminder".

## Rating effect

Not scored. Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
