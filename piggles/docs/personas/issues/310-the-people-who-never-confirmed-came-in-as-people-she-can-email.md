# 310 — The people who never confirmed came in as people she can email

**Status:** fixed, confirmed
**Severity:** major (an unconfirmed mailing-list subscriber lands contactable and
in ordinary segments, against the explicit intent of the code that imports them)
**Found by:** P03 · Juniper Row · while fixing [309]
**Surface:** the console — Move in from somewhere else › a Mailchimp audience export
**Filed:** 2026-08-28
**Fixed:** 2026-08-28

## What happened

A Mailchimp audience export marks a double opt-in by carrying a `CONFIRM_TIME`.
Someone who signed up but never clicked the confirmation link has an `OPTIN_TIME`
and no `CONFIRM_TIME` — they are on the list, and they are the one group a shop
must not mail.

Brought a two-row export in as Devi. Piggles recognised it:

    This is a Mailchimp audience export
    We can tell because it has the "Email Address" and "OPTIN_TIME" columns
    and 4 of 4 columns only Mailchimp writes.

Both came across. What landed:

| Contact         | CONFIRM_TIME | Consent record | Do not send marketing |
| --------------- | ------------ | -------------- | --------------------- |
| Hester Pryn     | yes          | marketing      | off                   |
| **Callum Ives** | **none**     | **none**       | **off**               |

Callum never confirmed anything, and he arrived as somebody she can email. He is
already a member of the ordinary **New Customers** segment, and the send path
excludes a recipient only for `doNotContact`, an explicit suppression, or a
missing address — none of which he has.

The built-in **Newsletter Subscribers** segment does hold the line: it wants a
consent record as well as the flag, so Callum is not in it and Hester is. The
gap is every OTHER segment, which is most of them, and which is what a broadcast
usually goes to.

## Why

The adapter is trying to do the right thing and says so twice
([mailchimp.ts](../../../../wizeworks/packages/migration/src/vendors/mailchimp.ts)):

> The one thing that must not be lost is consent. `CONFIRM_TIME` being present is
> the record that this person double-opted-in, and **a list imported without it
> is a list the tenant cannot legally mail.**

> Only a confirmed opt-in is imported as consent. **An unconfirmed row lands
> without marketing permission**, which is recoverable; the reverse is not.

And then it writes that intent as an empty string:

```ts
accepts_marketing: confirmed ? 'true' : '',
```

Empty is the one value that cannot carry it. Canonical rows are assembled by
`row()` in [\_helpers.ts](../../../../wizeworks/packages/migration/src/vendors/_helpers.ts),
whose whole job is to drop empties, for a good reason it states itself:

> Empty keys matter: `{ price: '' }` and `{}` mean different things to an upsert
> — the first says "set the price to nothing", the second says "leave it alone."

So `''` means **leave it alone** — no opinion. Callum's row reaches the importer
with no opt-in field at all, the create path reads that as "the file did not say",
and not saying is treated as contactable. The adapter's careful sentence is
deleted one layer down by a helper doing exactly what it is documented to do.

HubSpot's adapter, four files away, gets the same decision right by inverting it:

```ts
accepts_marketing:
  pick(source, 'Marketing contact status') === 'Non-marketing contact' ? 'false' : '',
```

An explicit `'false'` survives `row()` and suppresses; `''` is reserved for "the
export did not say". Mailchimp uses `''` for both.

This is [[feedback_never_present_absence_as_measurement]] with the sign flipped:
a permission nobody gave is being stored as a permission nobody withheld, and
the two look identical on the record.

## The fix

Say the negative out loud: `confirmed ? 'true' : 'false'`. An explicit `'false'`
survives `row()`, so the importer sees it, and "not a yes" has always meant
do-not-contact once it gets there.

The distinction that had to survive is **"this export has no opinion about
marketing"** (leave the contact alone) versus **"this export says this person
never confirmed"** (do not mail them). Only an explicit value can carry the
second, which is why HubSpot's adapter reads correctly and this one did not.
Pinned by two tests in
[vendors.test.ts](../../../../wizeworks/packages/migration/src/vendors/vendors.test.ts).

## Confirmed as Devi, 2026-08-28

Brought the same two-row export in again. Nothing else changed:

| Contact     | CONFIRM_TIME | Do not send marketing — before | after  |
| ----------- | ------------ | ------------------------------ | ------ |
| Hester Pryn | yes          | off                            | off    |
| Callum Ives | none         | off                            | **on** |

Callum's record now says it on his card, in Devi's words rather than a flag:

    Left out of marketing emails. Order and account messages still reach them.

Hester is untouched and still holds her consent record.

**A shop that already imported a Mailchimp list can repair it by importing the
same export again.** That works because of the one-way rule from [309]: a file
saying "not confirmed" may switch suppression ON, and no file may switch it off.
The two fixes were found in the same hour and each is what makes the other safe.

## Not checked

- **Whether a broadcast would actually have reached Callum.** He was in the
  ordinary **New Customers** segment with nothing set against him, and the send
  path drops a recipient only for `doNotContact`, an explicit suppression or a
  missing address — so the conclusion follows from reading `expandRecipients`
  rather than from a send. The built-in **Newsletter Subscribers** segment does
  want a consent record as well, and correctly never held him.
- **The other adapters.** Only Mailchimp computes a negative and writes it as an
  empty string; Shopify, BigCommerce, GoDaddy, Magento and Ghost read the column
  straight, and HubSpot and Klaviyo already say `'false'` out loud. None was
  driven.
