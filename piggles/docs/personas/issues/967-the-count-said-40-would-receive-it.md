# 967 — The count said 40 would receive it

**Status:** fixed
**Severity:** major
**Found by:** P09 · The Marrow Review · act 10
**Surface:** mypiggles › Campaigns › a broadcast › Who it goes to
**Filed:** 2026-10-09
**Fixed:** 2026-10-10
**Confirmed by:** P09, 2026-10-11, the Friday edition campaign
**Blocked on:** —

## What happened

With the "New Customers" group chosen, the campaign said **"About 40 people will
receive this."** One of the 40, Hugh Ashdown, is marked do not contact. The send skips
him, so 39 would receive it. "Newsletter Subscribers" happens to read 39 because Hugh is
not in it.

## Why

`estimateRecipients` counts the group's members. The send (`expandRecipients`, same
file) also skips anyone marked do not contact, anyone on the do-not-email list, anyone
with no email address, and repeats. The two disagree whenever any of those is in a
group.

## The fix to make

Count with the send's own rules: reuse its recipient filter (or a `count` form of it) in
`estimateRecipients`, so the number on screen is the number that will go out. A test: a
group of 40 with one do-not-contact reader estimates 39.

## The fix

The send's rule is one function now, `sendableRecipients` in
`wizeworks/packages/email-platform/src/services/audience-scope.ts` (no email, do not
contact, the do-not-email list, repeats). `broadcast-service.ts` reads one audience
(`audienceOf`) for both the send and `estimateRecipients`, so the count is the send's own
list, counted. The words in both consoles say "Right now, 39 people would receive this."
(a group can still change before a planned send), and a zero says "Nobody in this
audience can be emailed yet", because it now also means everyone is do not contact.
Test `audience-scope.test.ts`, 3 pass; the 40-with-one-do-not-contact case went red with
the do-not-contact check taken out. Lint and typecheck clean.

## Confirmed by

P09 on screen, 2026-10-11, as Rosalind, the "Friday edition, 10 October" campaign › Who it
goes to. Clare Whitlock had joined both groups since the filing (issue 976), so the
numbers moved by one. **New Customers**: 41 members, Hugh Ashdown do not contact; the
screen read "Right now, 40 people would receive this." (the old count would have said
41). **Newsletter Subscribers**: 40 members, nobody blocked, "Right now, 40 people would
receive this." Both match the send's own rules counted in the database. The audience was
put back and nothing was saved.
