# 247 — The newsletter picker offered to send "Payment failed" to the whole list

**Status:** fixed and confirmed
**Severity:** high
**Found by:** P03 · Juniper Row · act 10 — choosing what the broadcast sends
**Surface:** mypiggles › Messages › Broadcasts › the composer
**Filed:** 2026-08-26
**Fixed:** 2026-08-26
**Confirmed by:** P03 · Juniper Row · act 10 — the picker now offers seven emails, all of them hers

## What happened

Devi picked her audience — 23 newsletter subscribers — and opened "Designed
email" to choose what to send them. The list had **45 entries**:

```
Choose an email…
Welcome
Welcome (draft — not published)
Win-back
Abandoned cart
…
Order confirmation
Shipping confirmation
Order refunded
Payment failed                              ← two rows above the newsletter
Subscription payment failed
Subscription payment needs confirming
…
Monthly newsletter
Sale announcement
```

Thirty-nine of the forty-five are built-in transactional emails. The two she
actually wanted sat at positions 39 and 40.

## What should have happened

A broadcast can only send an email that makes sense to a whole audience.

## Why it matters

Choosing "Payment failed" and pressing Send would have told twenty-three people
who had bought nothing that their payment had failed. Nothing on the screen
warned her, the entries are alphabetically indistinguishable from her own, and
there was no confirmation step behind the button (see
[248](248-nothing-could-be-previewed-from-the-surface-that-sends.md)).

It would not even have rendered correctly. A built-in email is written ABOUT one
event and reads that event's data — `{{order.number}}`, `{{invoice.total}}`,
`{{booking.startsAt}}`. A broadcast has no order, no invoice and no booking, so
every one of those tokens resolves empty. The email that arrived would have been
a broken sentence about a payment failure.

A non-technical shop owner has no way to know which of forty-five names is safe.
The distinction lives in a database column she cannot see.

## Where it lives

[broadcast-detail.tsx](../../../apps/workbench/surfaces/email/broadcast-detail.tsx)
mapped the list straight through:

```tsx
{
  designedItems.map((email) => (
    <option key={email.id} value={email.id}>
      {email.name}
    </option>
  ));
}
```

`designedItems` is `GET /v1/builder/emails` — the whole catalog, the 39
provisioned defaults included.

The distinguishing field was already on the wire and already documented.
`BuilderEmail.key` is the built-in identity (`order-confirmation`,
`payment-failed`, …) and is **null for an email the owner wrote**. It rides on
`BuilderEmailDto`, so the client had it and ignored it — the same shape as
[246](246-delivered-nothing-a-minute-after-twenty-three-emails-went-out.md).

## The fix

`broadcastableEmails()` filters to `key === null`: only emails the owner wrote
herself. Devi's picker went from 45 entries to 7.

The empty state says why, rather than leaving the absence mysterious:

> You haven't written an email to send yet. Use "Design emails" above to write
> one, publish it, then choose it here. The ready-made ones Piggles sends for you
> — order confirmations, reminders — aren't offered, because each is written
> about one customer's order.

## What it looked like once fixed

```
Choose an email…
Welcome (draft — not published)
Welcome — day 3 (draft — not published)
Monthly newsletter
Sale announcement
Welcome (Fashion Boutique (Minimal)) (draft — not published)
We saved your spot (draft — not published)
Autumn drop
```

## Noted, not fixed

Two of those entries are both called **Welcome** — one is the provisioned
default, one came from a blueprint install — and in the Email designs list they
are also identical in subject and scope, so there is no way to tell them apart.
Not filed as its own issue yet; recorded here because the picker fix removes it
from THIS list but not from the designer's.

## Related

[248](248-nothing-could-be-previewed-from-the-surface-that-sends.md) is why
choosing the wrong one would not have been caught before it went out.

## Rating effect

`Messages › Broadcasts` in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
