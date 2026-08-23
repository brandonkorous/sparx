# 119 — The search only finds you what you already know the name of

**Status:** open
**Severity:** minor
**Found by:** P02 · Halo & Hem · act 8
**Surface:** mypiggles › the search box in the top bar
**Filed:** 2026-08-22
**Fixed:** —
**Confirmed by:** —
**Blocked on:** — (small, but it needs its file split first; see below)

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

## The fix (recommended, not yet made)

Keep the ladder exactly as it is for the whole query. When it returns zero, fall
back to splitting the query on whitespace and requiring EVERY word to score above
zero, ranking by the weakest word — so "take a payment" finds "How you take
payment" and single-word queries behave identically to today.

Word-boundary preference would also demote the wholesale results under `sale`
without hiding them, since `startsAWord` already exists in that file.

Not made in this pass only because `launcher.tsx` is 425 lines and piggles
RULE #0.5 requires splitting it before it is edited — worth doing, but not ahead
of the money defects act 8 was actually about.
