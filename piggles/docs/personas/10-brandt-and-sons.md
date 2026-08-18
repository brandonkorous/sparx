# P10 — Ida Brandt · Brandt & Sons Joinery

**Version:** 1.0
**Author:** Brandon Korous
**Last Updated:** 2026-08-18

**Status:** not started
**Run:** —
**Trade:** Something else (`generic`) · **Rail groups:** web · money · run

## Account

| Field         | Value                  |
| ------------- | ---------------------- |
| Email         | `p10.ida@piggles.test` |
| Tenant id     | —                      |
| Subdomain     | —                      |
| Published URL | —                      |
| Custom domain | —                      |

## Read this before starting

**This is the conditions run, not another trade.** Its subject is the commercial
edge of the product: every capacity meter, seat expansion, a custom domain, the
trial ending, and a card being entered.

Much of that surface is **known not to be built** — STATUS.md is explicit that
the meters record and nothing reads them yet, and FOLLOW_UPS #1 and #2 are open.
So this run is not expected to be clean. Its job is to establish **exactly where
the surface stops**, and — more importantly — that nothing already shipped
violates the rules in RULE #2 of piggles/CLAUDE.md while the rest is missing:

- a capacity limit **never stops work in progress** and never degrades what
  exists
- expansion is **one tap, in place, with the price on the button** — never a trip
  to Settings, never a redirect to another domain
- **the console never knows a price**
- transactional mail is **never** capacity-gated

An absence is a finding. A rule broken while the surface is absent is a worse
one. Both get filed.

**Run this persona last.** It needs a business with enough in it to hit limits.

## The person

Ida Brandt, 61, she/her. Took over her father's joinery three years ago when he
died. She runs the office; her son Mattias and two fitters do the work.

She does everything on a phone, standing in a workshop, with sawdust on the
screen. She types slowly, she loses passwords, and she has never once read a
sentence in a settings screen. She is the person every "just go to Settings →
Billing → Subscription" flow was not designed for.

**What made her look:** she is still invoicing from her father's carbon-copy pad.

## The business

**Brandt & Sons Joinery** — fitted kitchens, staircases and bespoke furniture.
Three staff plus Ida. One workshop.

- Jobs are **quoted, deposited, built and installed** over six to ten weeks
- 1,400 customers going back to 1998, in a card index her father kept
- Hundreds of **job photographs** — before, during, after — which is how she sells
- She wants a **second site** for the furniture range, which is a different
  business in every way but the bank account
- She wants **brandtandsons.test** as the address, because that is on her van

## Why she is here today

1. "Get my father's card index off cardboard."
2. "Photographs of our work, on a website with our own name."
3. "Stop the invoicing pad."

## Onboarding answers

| Question       | Answer                                                   |
| -------------- | -------------------------------------------------------- |
| Business name  | `Brandt & Sons Joinery`                                  |
| Trade          | Something else                                           |
| What do you do | I need a website · I invoice people · I work with a team |
| Look           | first option offered; record which                       |

**Sign up on a phone.** 390px, whole flow, start to finish. Not desktop, not
"then check it narrow" — the whole account is created on a phone, because that is
who she is.

## The data

### Customers

**1,400 contacts imported from a CSV**, with real variety: missing emails,
duplicate names, one address with a line break in it, four with the same phone
number, two obvious duplicates of the same person. This is a card index, not a
clean export.

### Jobs and money

| Customer           | Job                                 | Value   | State                     |
| ------------------ | ----------------------------------- | ------- | ------------------------- |
| Halvard Sjögren    | Fitted kitchen, oak, 14 units       | $28,400 | 40% deposit paid          |
| Neve Kilbride      | Oak staircase with turned balusters | $11,900 | quoted, awaiting yes      |
| Toft Farm Holdings | Six bedroom wardrobe sets           | $42,000 | in build, staged bills    |
| Rosaleen McQuaid   | Dining table, elm, 2.4m             | $3,850  | complete, unpaid, 40 days |
| Emeka Nwachukwu    | Kitchen island and pantry           | $9,200  | deposit invoice due       |

### Photographs

**At least 300 job photographs**, real files, uploaded through the UI — enough
that storage becomes a real number rather than a hypothesis.

### People

Ida, plus **Mattias Brandt**, plus fitters **Kev Doorley** and **Suna Aydın**.
That is four people on a plan that includes three.

## The run

### Act 1 — Sign up on a phone

The entire spine at 390px, in an iframe. Every tap. Note anything that needs two
hands, a zoom, or a horizontal scroll.

**Done when:** the account exists and she is in the console, having never seen a
desktop.

### Act 2 — Lose the password

Sign out. Forget the password. Use the recovery path.

Dev mail is a silent no-op, so the reset link will not arrive — read the token
out of `verifications` and complete the reset yourself, then **record that the
email was never actually sent** and that the screen claimed success anyway
(FOLLOW_UPS #8). If the screen claims an email was sent when nothing was, that is
a `major` on its own.

**Done when:** she is back in, and what the screen told her is written down
against what actually happened.

### Act 3 — Two devices

Sign in on a laptop while the phone session is live. Both must work. Then sign
out on the laptop and confirm what happens to the phone — and whether "keep me
signed in" survived the domain boundary (FOLLOW_UPS #7).

**Done when:** both sessions' behaviour is recorded.

### Act 4 — The card index

Import all 1,400 contacts. Then:

- Find the duplicates the software can find, and merge two of them
- Fix the address with the line break
- Search for `McQuaid` and get there in one action
- Confirm the count is 1,400 and says where the other rows went if it is not

**Done when:** the import is complete and its losses, if any, are known and
stated. Silent row loss is a **blocker**.

### Act 5 — The contacts meter

1,400 contacts is a real number against a metered allowance. Find out, as Ida
would:

- Is she told anywhere how many she is allowed?
- Was she warned before, during or after the import?
- **Did the import complete?** Under RULE #2 it must — work in progress is never
  stopped, and this is the exact case that rule was written for
- If she is over, are her contacts still all there and still usable?

**Done when:** each question has an answer, including "there is no such screen".

### Act 6 — 300 photographs

Upload the photographs across several jobs. This is the storage meter.

- Does the upload get slower, warn, or stop?
- If a limit is reached mid-upload, does the file in flight finish?
- **Nothing already published may be degraded or unpublished** — check the site
  after
- Is she offered more storage in place, with the price on the button?

**Done when:** the storage meter's real behaviour is documented, including
whether any of it is visible to her at all.

### Act 7 — The fourth person

Invite Mattias, then Kev, then Suna. The third invitation takes her past the
three included seats.

What must be true:

- She is told, in plain words, before it costs her anything
- The offer to add a seat is **right there**, with the price on it
- Taking it does not send her to another domain or a settings tree
- The **console did not compute the price** — it rendered a label the account
  service handed it

Then verify the reverse: can she remove a seat and reduce her bill herself? "One
tap to buy" is only honest if leaving is equally self-serve.

**Done when:** all four are confirmed or filed, with attention to which side of
the getpiggles/mypiggles line each thing lives on.

### Act 8 — The team's boundaries

Set what each person sees: fitters see jobs and customers, not money. Mattias
sees everything except the plan.

Verify by **signing in as Kev**, not by reading a permissions screen.

**Done when:** verified from the restricted user's own session.

### Act 9 — Money, and a chase

Raise the five invoices above, including a **staged bill** on the Toft Farm job
and a **deposit invoice** for Emeka. Take the Sjögren deposit. Chase Rosaleen's
40-day-old $3,850.

**Done when:** every balance is right and the overdue one is visibly overdue.

### Act 10 — Her own address

Connect **brandtandsons.test** as the site's domain.

- Are the DNS instructions readable by somebody who has never seen a DNS record?
- Does it tell her to point at **`customers.piggles.site`** and never at another
  brand's hostname?
- Does it say what to do while it propagates?
- Does the site keep working on the `piggles.site` address throughout?

Verification will stop where local DNS stops; say exactly where, and check the
instructions and copy regardless.

**Done when:** the flow is walked as far as it can go and the stopping point is
named.

### Act 11 — The second site

She wants a separate site for the furniture range. The plan includes **one
primary site**.

- Can she create a second one at all?
- Is she told the price before she commits, in place?
- If she adds it, does the first site keep working and does the switcher appear?
- Does the second site have its **own identity** — name, look, logo, socials —
  rather than inheriting the joinery's?

**Done when:** either the second site exists with its own identity, or exactly
where it stops is filed.

### Act 12 — The trial ends

Move the trial to its end (or verify what is scheduled to happen if you cannot).

- Is she warned before the day, somewhere she will see it — the console, not only
  an email that does not send?
- On the day, what stops? Under RULE #2 nothing already made may be degraded, and
  her site must not go dark
- Enter a card on **getpiggles** and confirm the subscription is **one flat
  $49 plan**, not fifteen module line items (FOLLOW_UPS #1 — this is the check
  that item exists for)
- Confirm no module line items were synced

**Done when:** the lifecycle notice's presence or absence is recorded, and the
Stripe subscription's shape is verified in the data.

### Act 13 — Leaving

She decides to cancel. Take it as far as the product allows.

- Can she cancel herself, without an email to support?
- Is she told what happens to her site, her invoices, her 1,400 customers?
- Can she get her data out first?

**Done when:** the path is walked or its absence is filed. A product that cannot
be left without a phone call is a finding, not a feature.

## What only this persona proves

Everything commercial: **all four meters** (contacts, storage, seats, email),
seat expansion with the price on the button and the console not knowing it,
the trial ending, a flat $49 subscription with no module line items, a custom
domain, a second site, and cancellation. Plus the whole product driven from a
**phone**, a password recovery through the path that does not send mail, and a
1,400-row import of genuinely dirty data.

## Verification

| Check                                                        | Result |
| ------------------------------------------------------------ | ------ |
| Whole signup completed on a 390px screen                     | —      |
| Password recovery: what the screen claimed vs what happened  | —      |
| 1,400 contacts imported with no silent row loss              | —      |
| No capacity limit stopped work already in progress           | —      |
| Nothing published was degraded or unpublished by a limit     | —      |
| Transactional mail was never capacity-gated                  | —      |
| Seat expansion offered in place, price on the button         | —      |
| Console did not compute or hardcode a price                  | —      |
| Reducing capacity is as self-serve as adding it              | —      |
| Restricted fitter view verified from his own session         | —      |
| Custom domain instructions point at `customers.piggles.site` | —      |
| Second site has its own identity, first site unaffected      | —      |
| Trial end warned in the console, not only by email           | —      |
| Stripe subscription is one flat plan, zero module line items | —      |
| Cancellation is self-serve and says what happens to her data | —      |

## Run log

| Date | Act | What happened |
| ---- | --- | ------------- |
| —    | —   | —             |

## Issues found

| #   | Severity | What |
| --- | -------- | ---- |
| —   | —        | —    |
