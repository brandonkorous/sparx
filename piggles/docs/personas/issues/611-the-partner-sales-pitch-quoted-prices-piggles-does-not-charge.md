# 611 — The partner sales pitch quoted prices Piggles does not charge

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 207 (while scanning surface copy for jargon)
**Surface:** mypiggles › Partners › Resources, Referrals, Commissions, Your listing, Bootcamps
**Filed:** 2026-09-17
**Fixed:** 2026-09-17

## What happened

I was looking for technical words on my own screens when the scan turned up
something else: **Piggles screens that say "sparx" out loud.**

Not a stray mention. **Resources** is the screen a Piggles partner has open
while they are talking to a client. It is a pitch deck, and most of it was
still sparx's:

> **They only pay for what they switch on**
> sparx is modular. A publisher can run content-only, a services team
> customers-only, a shop the full commerce stack. … **Modules switch on
> independently, and a client pays for exactly the ones they use.**

That is not merely the wrong name. **Piggles does not sell modules and has no
per-module price.** It is one flat monthly price with every app included
(`piggles/CLAUDE.md` RULE #2). A partner reading that paragraph aloud is
promising a client a way of paying that does not exist, on the screen we gave
them to sell with.

The six playbooks under it were worse, because they are instructions:

> Switch on Commerce and connect the client's payment account.
> Switch on CMS and define the content types they need.
> Switch on CRM: site forms and orders start creating customer records.

Nothing is switched on. It is already on, and it is called **Sell**,
**Content** and **Customers**. "CMS" and "CRM" are both on the banned list.

## Why it survived

The seam was already there and already used. Two of the five pitch sections go
through `productCopy(key, fallback)`, and Piggles supplies its own wording in
`lib/console/copy.ts` — including one whose comment says exactly this:

> THE ONE THAT WAS FACTUALLY WRONG, not merely off-voice. … a partner repeating
> the sparx sentence would be misselling. This is why brand copy cannot be a
> name swap: the substituted sentence would have been grammatical, on-brand, and
> false.

Somebody found this precise failure, fixed **two paragraphs**, wrote the reason
down, and left the other three, the whole one-pager and all six playbooks
untouched. The same shape as 610: the diagnosis was right and the sweep stopped
at the part that was being looked at.

The guard did not catch it because the guard was already **carrying it as
debt**. `scripts/check-platform-brand.mjs` does scan both brand trees for the
other brand's name; these strings were in `foreign-brand-debt.txt`, banked, and
the check passes on banked debt by design.

Debt that may only shrink is a reasonable mechanism. It just means nothing will
ever make it shrink except somebody deciding to.

## What was fixed

**Resources, entirely.** Every sentence, bullet, heading and playbook now goes
through the adapter, and Piggles has its own:

| was (sparx)                                           | now (Piggles)                                               |
| :---------------------------------------------------- | :---------------------------------------------------------- |
| They only pay for what they switch on                 | Everything is included, from day one                        |
| sparx is modular … pays for exactly the ones they use | Piggles is not sold in pieces … One price, everything in it |
| Site Builder / Commerce / CMS / CRM / Email / B2B     | My Site / Sell / Content / Customers / Messages / Wholesale |
| Switch on Commerce and connect the payment account    | Connect the account their money will land in                |
| Get each module live                                  | Get each app working                                        |
| The sparx pitch                                       | The Piggles pitch                                           |

Lists go through the adapter too, newline-separated, so a brand can change how
many bullets there are rather than just their words.

**And the rest of the partner program**, which had the same leak in nine more
places: the referral link help, an unnamed referred account, the bank-connect
line, the commissions heading, the empty commissions list, the bootcamp sign-up
help, the draft-only notice, the directory intro and the pending-activation
notice. A Piggles partner is paid by **Piggles** and listed in the **Piggles**
directory.

One of those carried a banned word as well: "Sign-ups on sparx drop a lead
straight into your **CRM**" is now "Sign-ups on Piggles go straight into your
customer list."

## The debt, before and after

```
Foreign-brand check … 30 known   →  15 known
```

Fifteen remain, and every one of them is **dead text**, verified rather than
assumed:

| strings | where                                     | why it cannot be reached                                                                                                         |
| ------: | :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- |
|       6 | the marketplace                           | `commerce.market` is a hidden surface; the block on product-channels is behind `productHidesFeature('commerce.channels.market')` |
|       4 | sparx Pay                                 | behind `productHidesFeature('commerce.payments.sparx_pay')`                                                                      |
|       3 | "What you pay sparx" / invoice from sparx | `finance.subscription` is a hidden surface; what a business pays WizeWorks lives on getpiggles.com                               |
|       2 | "What sparx does"                         | a KEY in the section-rename table, renamed to "How Piggles is set up"                                                            |

These must not be "fixed": renaming another product's marketplace to Piggles'
invents something nobody can sign up for, which is worse than the leak because
then nothing looks wrong.

## Not filed, checked instead

**"API keys" on AI connections** reads as jargon but is right. The section
defines it in the next sentence ("For an AI app that can't sign in the usual
way, a key does the same job … Treat a key like a password"), which is what the
audience rule asks for, and it is the literal phrase the other app's own setup
screen will use. Renaming it would leave her unable to match the two.

**"over the API" on Stock › Your own columns** is a real one and is NOT fixed
here — see 612.

## Still open

Nothing from this issue. The 15 dead strings stay banked.
