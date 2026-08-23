# 119 — The search only finds you what you already know the name of

**Status:** fixed
**Severity:** minor
**Found by:** P02 · Halo & Hem · act 8
**Surface:** mypiggles › the search box in the top bar
**Filed:** 2026-08-22
**Fixed:** 2026-08-23 (act 9, when it failed on the word "reminder")
**Confirmed by:** see below

## What happened

The box across the top of the console says **"What do you want to do?"** Nia
wanted to take a payment, so she typed:

> take a payment

> **Nothing matches that. Try a different word.**

There is a screen called "How you take payment". Typing `payment` finds it.
Typing `take payment` finds it. Typing `take a payment` does not, because the
word "a" is not in the title and the whole query is matched as one literal
substring.

The same shape makes it over-match. Typing `sale` — a hairdresser's word for what
she just did — returns, in this order: Wholesale price, Wholesale customers,
Wholesale orders, Wholesale invoices, Wholesale prices, then Orders. Five B2B
screens above the one she wanted, because "sale" sits inside "wholesale".

## What should have happened

A box that asks what you want to DO should take a phrase. At minimum, a query
whose words all appear should match.

## How to reproduce

1. Press ⌘K, type `take a payment`. Every time: nothing matches.
2. Type `sale`. Every time: five wholesale screens first.

## Why it matters

It is the fastest route in the product and the one a person reaches for when they
do not know where something lives — which is exactly when they will phrase it as
a sentence. Cosmetic in the sense that everything is reachable another way; not
cosmetic in that the box invites the phrasing it then rejects.

## Where it lives

[components/launcher.tsx](../../../apps/workbench/components/launcher.tsx),
`score()`. The ladder it implements is careful and correct — exact name, then
prefix, then word-start, then anywhere, then keywords, then the app it lives in,
with a comment explaining why a group match must never outrank a real name. The
only fault is that it scores the WHOLE query as one string.

## What act 9 added to it

The same box, asked the most obvious word in the module she was working in:

> reminder

> **Customers** — Things to do

One result: a to-do list. Not **Booking rules**, which owns when a reminder goes
out; not **Email designs**, which owns what it says. Neither carries the word. A
grep of the whole surface catalog found `reminder` in exactly one place — the CRM
task list's keywords — so the scoring was never even reached. A ladder cannot rank
a screen that does not admit to being about the thing.

## The fix

Made as recommended above, plus the keywords.

`launcher.tsx` (425 lines) came apart into four: `launcher-match.ts` (what counts
as a match), `launcher-entries.ts` (what rows exist), `launcher-rows.tsx` (what a
row looks like), and the dialog itself. Per piggles RULE #0.5, which is why this
was deferred in act 8.

**Phrases.** `scoreQuery` runs the whole query through the existing ladder first,
unchanged. Only when that returns zero does it split on whitespace, require every
meaningful word to score, and rank by the weakest. Words of one or two letters are
dropped rather than required — "take a payment" is asking about taking and about
payment — so a single-word query behaves exactly as it always has.

**Coincidences below choices.** A tagged keyword now outranks a bare mid-name
substring: "sale" sits inside "wholesale" by accident while Orders carries it on
purpose, and a word somebody chose is evidence where a word that happens to be
inside another one is not.

**The word itself.** `reminder` / `reminders` added to Booking rules, and
`reminder` / `confirmation` / `receipt` / `wording` / `what it says` to Email
designs — the two screens that own the two halves of a reminder.

## Confirmed by

> Re-ran all three as Nia.
>
> `reminder` → **Things to do**, **Email designs**, **Booking rules**. Three
> results, all genuinely about reminders.
>
> `take a payment` → **How you take payment**, then **Take a sale**. It found
> nothing at all before.
>
> `sale` → **Take a sale**, **Orders**, Discounts, Tax, How selling is going, and
> only then the five Wholesale screens. They were the first five.
