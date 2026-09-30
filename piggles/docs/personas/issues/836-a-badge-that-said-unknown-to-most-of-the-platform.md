# 836 — A badge that said "unknown" to most of the platform

**Status:** fixed (the upstream ask filed here was withdrawn on re-measurement)
**Severity:** correctness + copy
**Found by:** P03 · Juniper Row · act 282
**Surface:** getpiggles — account home, sign up, password reset
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** read on screen as Devi at full width and at 360px

## "unknown", in a warning pill, under "Your plan"

The account page drew the stored value:

```tsx
<Badge color={tenant?.subscriptionStatus === 'active' ? 'success' : 'warning'}>
  {tenant?.subscriptionStatus ?? 'unknown'}
</Badge>
```

Three separate faults, and the worst is the one that looks like a safety net.

**The fallback is the common case.** Measured on the dev database:

| `subscription_status` | Tenants | What the badge said     |
| --------------------- | ------: | ----------------------- |
| NULL                  |  **81** | **unknown**, in warning |
| `trialing`            |      31 | Free trial: N days left |
| `active`              |       1 | active                  |

**72% of businesses opened their own account page and were told their plan was
"unknown", in a warning color.** "unknown" is a programmer's word for "we did
not record this". It is not a state a business is in.
[[feedback_never_present_absence_as_measurement]]

**The value that did render is the database's word.** `active` is lower case and
chosen to match a payment provider. The set is
`trialing | active | past_due | canceled | unpaid | paused`, and not one of the
six is a sentence. Same shape as issue 833. [[feedback_status_badges_semantic_color]]

**And nothing about paying depended on it.** The Payment section said, for every
state:

> There is nothing to pay while you are on the trial, and no card on file.

Devi's status is `active` and her trial ended on **2026-09-06**, nineteen days
before this pass. So the badge said one thing and the paragraph four inches
below it said the opposite, about the same business, on the same screen.
[[feedback_a_promise_in_copy_is_a_contract]]

`planState(status, trialEndsAt)` returns the label, the tone and the payment
sentence together, so the two halves of the page cannot drift:

| Stored                     | Badge                        | Tone      |
| -------------------------- | ---------------------------- | --------- |
| `trialing`, days remaining | Free trial: N days left      | success   |
| `trialing`, date passed    | Free trial finished          | warning   |
| `active`                   | Your plan is running         | success   |
| `past_due`                 | A payment did not go through | danger    |
| `unpaid`                   | Not paid                     | danger    |
| `canceled`                 | Canceled                     | warning   |
| `paused`                   | Paused                       | warning   |
| NULL                       | No billing set up yet        | colorless |

Two notes on that table.

**`active` is not "Paid up."** That was the first draft, and it is a claim
nobody can make: measured, **no tenant has a card on file**, and the Payment
section on the same page says taking a payment is still being built. A badge
saying somebody is paid up, directly above a sentence saying there is nothing to
pay with, is the contradiction this file exists to remove.

**NULL is colorless, not grey.** It needs nothing from her, so it carries no
`tone`, which renders a badge with no `color` prop at all. That is a different
thing from naming `neutral` and is sanctioned without asking (RULE #4).

The trial branches read off the **date**, not the status word: a row can sit at
`trialing` with the date long past, and measured, **all 31 of them do**.

## "Locations 2", not 3

Under "What you are using" — the card headed _"What changes your bill is scale"_
— Devi's business read **Locations 3**. She has a workshop and a storeroom.

The third was **"In transit"**: `is_system = true`, `type = 'virtual'`, a
bookkeeping bucket the platform creates for stock that has left one place and
not arrived at the other. It is not somewhere she has.

```ts
safe(() => withTenant(ctx, (tx) => tx.warehouse.count())),
```

Two filters missing, in both the nightly snapshot and the live report:

- **`isSystem: false`** — 2 rows across 87 warehouses today, on the meter a bill
  is one day worked out from.
- **`deletedAt: null`** — 0 rows today, so this half is a bug waiting rather
  than a bug landed. It is worth more than the first: **every other reader of
  this model already filters it** (`universal-projection.ts`,
  `inventory-levels.ts`), so a deleted location would have vanished from the
  screen that lists locations and gone on being metered forever.

## What the page gets right, and is worth not breaking

- **"Your first overnight count has not run yet, so some of these are still
  blank."** Customers and Photos and files read **Not measured yet** rather than
  0, and the page says why. A value nobody took is never drawn as one.
- The business address is READ from the `domains` row rather than composed from
  the slug, so the console and this page cannot quote two addresses (issue 089).
- `mypiggles.com` is plain text, not a link, so nothing on a dev machine sends
  anybody to production.

## The one button this page exists for, hanging off the screen

At 360px the page had **32px of sideways scroll**, and the thing over the edge
was **Go to my business**.

The header row wrapped, so the logo dropped to its own line and the three
controls landed together on the next one: 349px of buttons in a 341px column.
The outer row had `flex-wrap`; the inner group had not. Its own comment calls
that button "the one button this page exists for".

`flex-wrap` and `justify-end` on the inner group. Re-measured at 360px:
`scrollWidth` equals `clientWidth`, and nothing on the page is wider than its
container.

## Sign up: a rule that only ever arrived as a refusal

The sign-up form is otherwise careful and it is worth saying why before the
defect:

- The analytics checkbox is **unticked**, and its own comment explains that a
  pre-ticked consent box collects an agreement nobody made.
- The business name is deliberately **absent** — it is asked in onboarding,
  where somebody has seen the product.
- `autocomplete` is right on all three fields (`name`, `email`, `new-password`),
  and the password field has a reveal toggle.

The defect: **the 8-character minimum is enforced twice and stated nowhere.**
`minLength={8}` on the input and `password.length < 8` in the server action, and
the field says nothing until somebody has already typed something shorter and
pressed the button. Three new-password fields across two screens were doing it.

It matters more on **password reset** than on sign-up, because that form is
reached from an emailed link that expires: being sent back to think again costs
the link. Both now carry `<FieldDescription>At least 8 characters.</FieldDescription>`

## Withdrawn: the `PasswordInput` accessibility ask was a bad measurement

**This section originally filed an upstream silicaui ask, and it was wrong.**
It is kept rather than deleted because the way it went wrong is the useful part.

The reading was: `FieldControl render={<PasswordInput/>}` in the account app
renders `aria-describedby="null"`, while the console's `render={<Input/>}` wires
it, therefore `PasswordInput` swallows the attribute. Re-measured 2026-09-25 on
the same page, same token, same code:

| Address                                 | `aria-describedby` on the password input |
| --------------------------------------- | ---------------------------------------- |
| `localhost:3021/reset-password?token=…` | the description element's id             |
| `127.0.0.1:3021/reset-password?token=…` | **null**                                 |

`PasswordInput` is fine. Base UI's `Field` mints the association **on the
client**, so the server HTML never carries it and a page that has not hydrated
reports null for every control in it.

The original reading was taken on `127.0.0.1:3021`, which was being used to get
a signed-out render without signing the persona out (the session cookie is
scoped to `localhost`, so the other spelling is a different host). It does that
correctly. What it also does is serve HTML that **never hydrates**: on that
address React attaches no fiber to anything, so the notice bar's close button
does nothing, the reset form submits natively, and every client-wired attribute
reads null. The console's `<Input/>` case "wired it" only because the console
was being read on `localhost`. The contrast in the table was not between two
components; it was between a live page and a dead one.

**The rule that falls out of it:** `127.0.0.1` is sound for READING a signed-out
page and unsound for measuring anything the browser does after load. Anything
clicked, focused, announced or validated has to be measured on `localhost`.
[[feedback_verify_capability_in_code_not_docs]]

The graceful-degradation note stands on its own terms and is worth keeping: the
input carries `required` and `minlength`, so a screen reader gets the RULE from
the browser's own validation even where the wording is not associated.

## Files

- `piggles/apps/account/lib/plan-state.ts` (new)
- `piggles/apps/account/app/account/page.tsx`
- `piggles/apps/account/components/{signup-form,password-reset-forms}.tsx`
- `wizeworks/packages/usage/src/{index,report}.ts`

## Not pinned by a test, and why

`planState` has nine branches and a date boundary, and **the account app has no
test seat**: no `test` script, no vitest, and no piggles PACKAGE has one either.
Adding the dependency would change `package.json` without the lockfile, which
fails `pnpm install --frozen-lockfile` in the pre-push hook and would break the
next push.

All nine branches were run directly instead and read back, which is a
measurement rather than a guard. Same gap rating.md already records for
`@piggles/console`. It is worth closing with a real seat next time the lockfile
is being regenerated anyway.

## The thing to remember

**A fallback is a state, and somebody is in it.** `?? 'unknown'` reads as
defensive programming and rendered to 72% of the platform. Whenever a nullable
column reaches a screen, count how many rows are null before deciding what the
empty case should say — it is regularly the commonest case, not the rare one.
