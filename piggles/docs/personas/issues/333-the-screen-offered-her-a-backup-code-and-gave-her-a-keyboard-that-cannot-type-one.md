# 333 — The screen offered her a backup code and gave her a keyboard that cannot type one

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · signing back in after signing out to re-check a shared fix on another business
**Surface:** getpiggles › Sign in › the two-step step
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** read on screen; the code path itself is Brandon's to finish, see **Still to confirm**

## What happened

Devi turned two-step verification on herself on the 27th ([278]) and downloaded
her ten backup codes. Signing in again, the second step reads:

> **One more step.**
> From your authenticator app. If you cannot reach it, one of your backup codes
> works here too.
>
> **Your six-digit code** \[ ]

Her backup codes look like this:

```
6XWyo-LajdX
KPeqw-FaYhh
```

Eleven characters, mixed case, a hyphen. The sentence offers them and the field
directly under it contradicts the offer three times over.

## Three things wrong, in the order she would hit them

**1. The label is false.** "Your six-digit code" tells a person holding
`6XWyo-LajdX` that she is holding the wrong thing. She is not — the form accepts
it. She has no way to know that.

**2. On a phone she cannot type it at all.** The field carried
`inputMode="numeric"`, so a phone raises the digits-only pad. There are no
letters on it. This is the one screen in the product reached by somebody who has
just lost access to her phone's authenticator app, on a product whose stated
audience includes "a 61-year-old on a phone in a workshop", and the recovery path
it offers her cannot be typed on the device she is holding.

**3. The failure message sends her to do the impossible.** One message covered
both kinds of code:

> That code was not right. Codes change every 30 seconds — try the current one.

A backup code never changes. Somebody who mistyped one, or reused one, is told to
wait for a new one that will never come. That is
[[feedback_one_outcome_two_causes]] exactly: one outcome, two causes, different
remedies, and the printed advice is wrong for one of them at the moment she is
locked out of her business.

## What should have happened

A field that accepts two kinds of thing says so, takes both from the keyboard the
person actually has, and tells each one what went wrong in terms it can act on.

## Why it happened

The intent was right and is written down in the handler, four lines above the
field:

```ts
// A backup code is longer than a TOTP code and is the thing people reach for
// when their phone is the problem. Accepting either from one field means
// nobody has to work out which box their code belongs in while locked out.
const res = code.trim().length > 6 ? verifyBackupCode(...) : verifyTotp(...);
```

The logic honors it. The label, the keyboard and the error text were all written
for the TOTP case alone, and nothing connects them to the branch below. Same
shape as [330]: a comment stating the correct behavior sitting directly above
code that does not have it.

## The fix

[sign-in-form.tsx](../../../../piggles/apps/account/components/sign-in-form.tsx):

- **"Your code"**, not "Your six-digit code". The sentence above already names
  both sources, so the label does not need to and must not contradict it.
- **`inputMode="text"`**, with `autoCapitalize`, `autoCorrect` and `spellCheck`
  off so a phone does not retitle-case a case-sensitive code. Six digits are on
  every keyboard; letters are not on every keypad, so the full keyboard is the
  one that serves both. `autoComplete="one-time-code"` stays, which is what lets
  a phone offer a texted code where one applies.
- **Two messages**, chosen by the branch already being taken:

  | Typed         | Says                                                                                 |
  | ------------- | ------------------------------------------------------------------------------------ |
  | six digits    | Codes change every 30 seconds, so try the current one.                               |
  | a backup code | Each one works only once, so if you have used it already, try the next on your list. |

**Checked and deliberately unchanged:** the console's own two-step SETUP field
(`two-factor-card.tsx`) is labelled "Code from your app" and is numeric. That one
genuinely wants the six digits, because its whole job is proving the
authenticator works before the account starts depending on it.

## Also confirmed here, from [278]

That issue ended on two loose threads, both now good: the downloaded file is
`piggles-backup-codes.txt` (it was `sparx-backup-codes.txt`), and the first code
is on its own line rather than glued to the heading.

## Still to confirm

**The corrected screen has not been driven end to end**, and this is the honest
limit of what was checked. Verifying it means typing a real backup code into a
real sign-in, and entering an authentication credential into a field is something
I do not do. The label, the keyboard attributes and the two messages were read
from the running page and the source; the successful sign-in behind them was not.

Brandon: signing in as `p03.devi@piggles.test` needs one code from
`~/Downloads/piggles-backup-codes.txt`, and the run's browser is signed out until
it happens.

## Rating effect

Against `getpiggles › Sign in`, on the two-step step specifically. The pane is
otherwise sound; this is the branch nobody drives until the day it is the only
one that matters.
