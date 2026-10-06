# 918 — Her payment settings could not be opened from their own address

**Status:** fixed (act 324)
**Severity:** minor
**Found by:** P03 · Juniper Row · act 324, clearing old tabs out of her layout
**Surface:** mypiggles › Money › How you get paid › Your own Stripe
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** the address opened on screen; 1 test
**Blocked on:** —

## What happened

Her saved layout held a tab called **Broken link**, which said:

> That link doesn't open anything. There is nothing at
> "/commerce/payment-providers/stripe_direct".

That is the address the console itself writes into the bar while "Your own
Stripe" is open. Reloading the page with that pane in front, or sending the link
to someone, landed on "Broken link" instead. That is how the tab got into her
layout during act 323's Stripe work.

## Why

Since 2026-09-30, an address parameter called `:id` only matches a minted record
id, so a word like `scorecards` can no longer open a detail pane by mistake
(that fixed 22 addresses). A payment provider is named by a word,
`stripe_direct`, and its route still said `:id`, so the console's own address
for it no longer matched anything.

## What changed

- The route is `/commerce/payment-providers/:key`, the name the address table
  already uses for things named by a word (`:key`, `:slug`).
- Both consoles open it with `key`; the pane reads `key`, and still reads `id`
  so a tab saved before this opens.
- Swept every screen addressed under `:id` in both consoles for one opened with
  a word: 87 routes, 651 open calls. The provider was the only one; the rest
  are `new` or minted ids.

## Proof

`/commerce/payment-providers/stripe_direct` opens "Your own Stripe" on screen.
`links` test: the address resolves to the provider pane with `key`; against the
old route it fails. 66 links tests, route check, ESLint, prettier clean.

## Rating effect

Not scored. Recorded in the run log of [03-juniper-row.md](../03-juniper-row.md).
