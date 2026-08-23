# 124 — Checking what an email says shows the labels and none of the facts

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 9
**Surface:** mypiggles › My Site › Email designs › Preview
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** see below

## What happened

Nia pressed Preview on the booking reminder to read it the way a client would. The
subject line at the top of the pane stopped mid-sentence:

> Reminder: your booking on

and the card in the middle of the email — the part the whole email exists for —
rendered like this:

> **Upcoming**
> Service
> When

A label with nothing beside it, twice, and the Duration, Location and With rows
gone entirely. In the editor beside it the same card showed five rows.

The rail on the right had the matching hole. **Things you can drop in** lists
sixteen groups of merge tags with a sample value against each — Order number 1042,
Total $84.00, Carrier UPS, Tracking 1Z999AA10123456784, Invoice INV-204, "Summer
Sale / 20% off this week". On a BOOKING email, the **Booking** group is the tenth
one down and every one of its fields is blank: Service, Date, Time, When, Duration,
Location, Staff. The one entity the email is about is the one entity with no sample.

## What should have happened

A preview of an email nobody has received yet should read like an email.

## Why it matters

The preview declares itself the authority — its own file says "If the two ever
disagree, this one is right" — so an author proofreading her wording is shown a
broken version of it and told that is the truth. She cannot check whether her
sentence reads well around the date, because there is no date. And the rail teaches
her which tags are worth using by showing what they look like, so the ones with no
sample look like the ones that do not work.

## Where it lives

- [packages/builder-schemas/src/email-tokens.ts](../../../../wizeworks/packages/builder-schemas/src/email-tokens.ts) — `SAMPLE_EMAIL_DATA`, `withSampleEmailData`
- [packages/email-platform/src/services/builder-email-service.ts](../../../../wizeworks/packages/email-platform/src/services/builder-email-service.ts) — `renderPreview`

## The cause, which is two things

**1. Five of the sixteen sources had no sample at all**, and two of those were
samples pointing at retired names:

| Catalog key    | Sample present as | Result                                             |
| -------------- | ----------------- | -------------------------------------------------- |
| `booking`      | `appointment`     | all five booking emails resolved nothing           |
| `b2bAccount`   | `company`         | the account-approved email had no company or terms |
| `waitlist`     | —                 | the waitlist offer resolved nothing                |
| `subscription` | —                 | the seven subscription emails resolved nothing     |
| `return`       | —                 | the three return emails resolved nothing           |

`appointment` was the B2B-only source retired on 2026-07-14; `binding.ts` says so
in a comment. Its sample stayed behind, still describing an oil change on a Toyota
Corolla, resolving for nothing.

**2. The preview resolved against no recipient.** `resolveSilicaEmailData` is
documented as "references without a ref resolve empty (render-once / preview)",
and the preview route passes no ref — correctly, because there is nobody to preview
as. So every per-recipient source came back empty and the render printed the labels.

## The fix

The five missing samples were written, deliberately industry-neutral (a
"Consultation" at 2:30 PM with Sam Whitfield in the Main room, read by a salon and
a plumber alike), and the two misnamed ones renamed to the keys the templates
actually use.

`withSampleEmailData()` then lays the samples **under** the resolved data, leaf by
leaf, for the preview only. Anything genuinely resolved — the site's own name, its
support address — still wins; only the gaps fill. `prepareTestSend` and the real
send never see it, because a real send has its recipient and must never print a
sample.

Fixed alongside, on the same screen: the Copy field's hint told authors to type
`{{customer.firstName ?? "there"}}`, which is developer syntax in a product for
business owners AND the one tag shape the canvas cannot draw — so somebody who
followed the instruction correctly still saw raw braces while they worked. The
codebase already knew: `deriveCustomerNames` exists precisely so templates can say
`{{customer.greeting}}`, and its own comment says why. The hint now says that.

## Confirmed by

> Re-ran the preview as Nia. Subject: "Reminder: your booking on **Sat, Jun 14,
> 2026**". The card: Consultation · Sat, Jun 14, 2026 at 2:30 PM · 45 min · Main
> room · Sam Whitfield, all five rows. The editor canvas draws the same values in
> place of raw braces, and the **Booking** group in the rail now shows what each tag
> looks like.
