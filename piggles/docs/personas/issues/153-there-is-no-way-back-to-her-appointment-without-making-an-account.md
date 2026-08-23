# 153 — There is no way back to her appointment without making an account

**Status:** fixed
**Severity:** blocker
**Found by:** P02 · Halo & Hem · standing check — the buyer's side
**Surface:** haloandhem.com › booking confirmation, and the confirmation email
**Filed:** 2026-08-23
**Fixed:** 2026-08-23
**Confirmed by:** see below

## What happened

This is the thing Nia bought the software for. Her own site says so, on the page
she wrote:

> **Standard booking**
> No deposit to book. **Change or cancel free up to 24 hours before.**

Imani booked. Her confirmation, on screen, said this and only this:

> **You're booked**
> Blow dry with Nia Okafor is confirmed for Tuesday, August 25 at 3:00 PM.
> Halo & Hem, 214 Bower Street, Suite B, Sacramento, CA 95811
> Add to calendar · Google · Outlook · Apple / .ics

Three ways to put it in a calendar. **No way to change it.** Nothing on the page
she is looking at, at the moment she is most likely to notice she has picked the
wrong day.

Her email offered one button, **Manage booking**, and it went to
`/account/bookings`. That is behind a sign-in, and she has no account — she
booked a haircut, and nothing in that flow ever asked her to make one. What she
got instead was this:

> **Welcome back**
> Sign in to track orders and check out faster.

She has never been here, so "Welcome back" is wrong. She is trying to move a hair
appointment, so "track orders" is wrong. The salon sells nothing at all, so
"check out faster" is wrong. And when she took the hint and clicked Create
account:

> **Create your account**
> Save your details for a faster checkout next time.

Three sentences in a row about a shop, at a two-chair salon on Bower Street.

Her actual options were: make an account she did not want, or phone Nia. The
standing check names both and rules them out, because both are the thing self
service is supposed to replace.

## Why it happened

The customer booking portal was built as part of the commerce account area
(docs/79 §15 Phase 3c) and inherited its front door. `booking.manageUrl` in
`services/api-rest/src/lib/email-data.ts` resolved to `/account/bookings`, and
the guest who books without an account was never given a door of her own.

The sign-in copy is the commerce copy because that surface only ever had commerce
in it. It says nothing wrong to a shopper. It has simply never been read by
somebody who arrived from a booking.

## The fix

**The link in the email opens her booking, not a login.**
`booking.manageUrl` is now a signed, per-booking address: `/booking/<token>`.
The token is the same HMAC scheme the per-booking `.ics` download has used since
docs/79 §8.1, carried in the same emails, to the same address — with its own
scope letter, so a calendar link can read but never cancel, and a manage link is
not a calendar feed. It is a capability sent to the customer's own inbox, which
is what every "manage your booking" link in the trade is, and the booking's own
state machine still gates it: a past, cancelled or completed booking opens
read-only.

**The page shows her the appointment and lets her act on it.** Change the time
against the salon's real open slots, or cancel, under the same rules the front of
the site enforces — Nia's lunch, her closures, her notice period. No account, no
password, no phone call.

**The confirmation carries the link too**, so the way back exists while she is
still looking at what she just booked, not only in an email she has to go and
find.

**The sign-in wall stops talking about shopping to people who do not shop.** The
copy on `/account/login` now reads from what the business actually does: a tenant
running Scheduling and no Commerce says so.

## Still open

The confirmation email's wording is Nia's to write, in her own editor. What is
fixed here is where its button goes, and that it works when pressed.

## Confirmed by

Re-run as Imani on `haloandhem.com`, after the fix:

- The confirmation panel carries the manage link, and it opens the booking.
- The same link opens in a browser with no session at all.
- Changed the time from that page, with no account. Nia's diary moved.
- Cancelled from that page. Nia's diary showed it cancelled.
